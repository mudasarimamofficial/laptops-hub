import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse, type StaffRole } from "@/lib/auth/staff";
import { LEGAL_CONTENT_SLUGS, sanitizeCmsHtml } from "@/lib/security/sanitize-html";
import { templateHasPending } from "@/lib/content/resolve";
import { V5_CONTENT } from "@/lib/content/v5-content";
import { revalidateContent, saveErrorResponse } from "@/lib/content/admin-save";

const schema = z.object({
  title: z.string().trim().min(2).max(200),
  /** Editorial workflow only. Legal pages cannot go public via editor publish alone. */
  status: z.enum(["pending", "draft", "published"]),
  bodyHtml: z.string().max(100_000),
  /** Only owner/admin/manager may set true on legal policy pages. */
  legalApproved: z.boolean().optional(),
  /** Publishing with an empty body publishes the V5 template copy; that needs this explicit approval. */
  approveTemplate: z.boolean().optional(),
  /** G19: the version the editor loaded; a save from an out-of-date tab is refused instead of overwriting. */
  expectedVersion: z.number().int().min(1),
  seoTitle: z.string().trim().max(120, "Search title is limited to 120 characters.").optional().default(""),
  seoDescription: z.string().trim().max(320, "Search description is limited to 320 characters.").optional().default(""),
  /** G19: new address for merchant-made pages (never policies or built-in template pages). */
  newSlug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lower-case letters, numbers and single hyphens for the address.")
    .min(2, "The address needs at least 2 characters.")
    .max(80, "The address is limited to 80 characters.")
    .optional(),
  note: z.string().trim().max(500).optional().default(""),
});

type Ctx = { params: Promise<{ slug: string }> };

const LEGAL_APPROVERS: StaffRole[] = ["owner", "admin", "manager"];

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin", "manager", "editor"]);
    const { slug } = await ctx.params;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: "validation_failed", message: issue?.message && issue.code !== "invalid_type" ? issue.message : "Check the fields and try again." },
        { status: 400 },
      );
    }

    const isLegal = LEGAL_CONTENT_SLUGS.has(slug);
    const canApproveLegal = LEGAL_APPROVERS.includes(staff.role);

    if (isLegal && parsed.data.legalApproved === true && !canApproveLegal) {
      return NextResponse.json(
        {
          error: "forbidden_role",
          message: "Only owner, admin, or manager can legally approve policy pages.",
        },
        { status: 403 },
      );
    }

    // Editors may save draft/pending; publishing legal pages without approval is blocked at DB policy + here
    if (isLegal && parsed.data.status === "published" && staff.role === "editor") {
      return NextResponse.json(
        {
          error: "forbidden_role",
          message: "Editors cannot publish legal/policy pages. Save as draft for owner review.",
        },
        { status: 403 },
      );
    }

    const body_html = sanitizeCmsHtml(parsed.data.bodyHtml);
    const tpl = V5_CONTENT.pages[slug];

    // An empty body publishes the V5 template. Never with unresolved owner facts, never implicitly. Pages without a
    // template (made in admin) need a body to be published.
    if (parsed.data.status === "published" && !body_html.trim()) {
      if (!tpl || templateHasPending(tpl)) {
        return NextResponse.json(
          {
            error: "template_pending",
            message: tpl
              ? "This page's V5 template still has sections waiting for business details. Write the approved page body before publishing."
              : "Write the page body before publishing.",
          },
          { status: 409 },
        );
      }
      if (parsed.data.approveTemplate !== true) {
        return NextResponse.json(
          {
            error: "template_approval_required",
            message: "Publishing an empty body publishes the V5 template copy. Confirm that copy is approved.",
          },
          { status: 409 },
        );
      }
    }

    // Built-in template pages and policies keep their address: header, footer and product pages link to them.
    const newSlug = parsed.data.newSlug && parsed.data.newSlug !== slug ? parsed.data.newSlug : undefined;
    if (newSlug && (tpl || isLegal)) {
      return NextResponse.json({ error: "slug_locked", message: "Built-in and policy pages keep their address." }, { status: 409 });
    }
    if (newSlug && V5_CONTENT.pages[newSlug]) {
      return NextResponse.json({ error: "slug_taken", message: "That address belongs to a built-in page." }, { status: 409 });
    }

    const { data: existing, error: findErr } = await supabase
      .from("content_pages")
      .select("slug, legal_approved")
      .eq("slug", slug)
      .maybeSingle();
    if (findErr || !existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Publishing a legal page requires legal_approved already true (or being set now). The database checks it again.
    if (isLegal && parsed.data.status === "published") {
      const approved =
        parsed.data.legalApproved === true ||
        (parsed.data.legalApproved !== false && existing.legal_approved === true);
      if (!approved) {
        return NextResponse.json(
          {
            error: "legal_approval_required",
            message: "Legal/business pages need explicit owner approval before publish.",
          },
          { status: 409 },
        );
      }
    }

    // One locked database call: version check, page update, revision snapshot, redirect (on rename) and audit log.
    const { data: saved, error } = await supabase.rpc("save_content_page", {
      payload: {
        actor_user_id: staff.userId,
        slug,
        expected_version: parsed.data.expectedVersion,
        title: parsed.data.title,
        body_html,
        status: parsed.data.status,
        seo_title: parsed.data.seoTitle,
        seo_description: parsed.data.seoDescription,
        ...(isLegal && canApproveLegal && parsed.data.legalApproved !== undefined ? { legal_approved: parsed.data.legalApproved } : {}),
        ...(newSlug ? { new_slug: newSlug } : {}),
        action: "save",
        note: parsed.data.note,
      },
    });
    if (error) return saveErrorResponse(error);

    // /pages and /guides read publication FRESH on every request (the security guarantee). Every other page shows
    // content links in its header/footer (and product pages link policies) from a 60s cache: expire the data tag and
    // all rendered pages so links follow the change on the next request.
    revalidateContent();
    const r = saved as { slug: string; version: number; action: string };
    return NextResponse.json({ ok: true, slug: r.slug, version: r.version, action: r.action }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
