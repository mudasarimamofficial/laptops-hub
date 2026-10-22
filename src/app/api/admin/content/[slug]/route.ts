import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createAuthorizedStaffClient, staffErrorResponse, type StaffRole } from "@/lib/auth/staff";
import { LEGAL_CONTENT_SLUGS, sanitizeCmsHtml } from "@/lib/security/sanitize-html";

const schema = z.object({
  title: z.string().trim().min(2).max(200),
  /** Editorial workflow only. Legal pages cannot go public via editor publish alone. */
  status: z.enum(["pending", "draft", "published"]),
  bodyHtml: z.string().max(100_000),
  /** Only owner/admin/manager may set true on legal policy pages. */
  legalApproved: z.boolean().optional(),
});

type Ctx = { params: Promise<{ slug: string }> };

const LEGAL_APPROVERS: StaffRole[] = ["owner", "admin", "manager"];

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const { slug } = await ctx.params;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed" }, { status: 400 });
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
    const { data: existing, error: findErr } = await supabase
      .from("content_pages")
      .select("slug, title, status, legal_approved")
      .eq("slug", slug)
      .maybeSingle();
    if (findErr || !existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const patch: Record<string, unknown> = {
      title: parsed.data.title,
      status: parsed.data.status,
      body_html,
      updated_at: new Date().toISOString(),
    };

    if (isLegal && canApproveLegal && parsed.data.legalApproved !== undefined) {
      patch.legal_approved = parsed.data.legalApproved;
      patch.legal_approved_at = parsed.data.legalApproved ? new Date().toISOString() : null;
      patch.legal_approved_by = parsed.data.legalApproved ? staff.userId : null;
    }

    // Publishing a legal page requires legal_approved already true (or being set now)
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

    const { error } = await supabase.from("content_pages").update(patch).eq("slug", slug);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "content.patch",
      entity_type: "content_pages",
      entity_id: slug,
      before: existing,
      after: {
        title: parsed.data.title,
        status: parsed.data.status,
        legal_approved: patch.legal_approved ?? existing.legal_approved,
      },
    });

    // Public /pages, /guides and the sitemap read published rows through a 60s cache; expire it now so an
    // unpublish (or legal approval withdrawal) takes effect on the next request.
    revalidateTag("content", { expire: 0 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
