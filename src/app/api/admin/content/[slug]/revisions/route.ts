import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffWriter, requireStaff, staffErrorResponse } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { LEGAL_CONTENT_SLUGS } from "@/lib/security/sanitize-html";
import { revalidateContent, saveErrorResponse } from "@/lib/content/admin-save";

type Ctx = { params: Promise<{ slug: string }> };

const EDITORS = ["owner", "admin", "manager", "editor"] as const;

/** G19: the page's saved versions, newest first (staff who can edit content). */
export async function GET(_request: Request, ctx: Ctx) {
  try {
    await requireStaff([...EDITORS]);
    const { slug } = await ctx.params;
    const supabase = createServiceClient();
    const { data: page } = await supabase.from("content_pages").select("id, version").eq("slug", slug).maybeSingle();
    if (!page) return NextResponse.json({ error: "not_found", message: "Page not found." }, { status: 404 });
    const { data, error } = await supabase
      .from("content_page_revisions")
      .select("version, action, slug, title, body_html, status, legal_approved, seo_title, seo_description, saved_by, saved_at, note, restored_from")
      .eq("page_id", page.id)
      .order("version", { ascending: false })
      .limit(50);
    if (error) {
      return NextResponse.json({ error: "not_available", message: "Page history is not switched on yet (database update pending)." }, { status: 503 });
    }
    const ids = [...new Set((data || []).map((r) => r.saved_by).filter(Boolean))] as string[];
    const { data: roles } = ids.length ? await supabase.from("admin_memberships").select("user_id, role").in("user_id", ids) : { data: [] };
    const roleOf = new Map((roles || []).map((r) => [r.user_id as string, r.role as string]));
    return NextResponse.json(
      {
        currentVersion: page.version,
        revisions: (data || []).map((r) => ({
          ...r,
          savedBy: r.saved_by ? roleOf.get(r.saved_by) || "former staff" : "system",
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}

const restoreSchema = z.object({ version: z.number().int().min(1), expectedVersion: z.number().int().min(1) });

/**
 * G19: restore an earlier version's title, body and search fields as a new version. Status, legal approval and the
 * address stay as they are now, so a restore never publishes, unpublishes or re-approves a page by itself.
 */
export async function POST(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter([...EDITORS]);
    const { slug } = await ctx.params;
    const parsed = restoreSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "validation_failed", message: "Choose a version to restore." }, { status: 400 });

    const { data: page } = await supabase.from("content_pages").select("id, status, version").eq("slug", slug).maybeSingle();
    if (!page) return NextResponse.json({ error: "not_found", message: "Page not found." }, { status: 404 });
    if (LEGAL_CONTENT_SLUGS.has(slug) && page.status === "published" && staff.role === "editor") {
      return NextResponse.json(
        { error: "legal_forbidden", message: "Only the owner, an admin or a manager can change the wording of a published policy." },
        { status: 403 },
      );
    }
    const { data: rev } = await supabase
      .from("content_page_revisions")
      .select("version, title, body_html, seo_title, seo_description")
      .eq("page_id", page.id)
      .eq("version", parsed.data.version)
      .maybeSingle();
    if (!rev) return NextResponse.json({ error: "not_found", message: "That version was not found." }, { status: 404 });

    const { data: saved, error } = await supabase.rpc("save_content_page", {
      payload: {
        actor_user_id: staff.userId,
        slug,
        expected_version: parsed.data.expectedVersion,
        title: rev.title,
        body_html: rev.body_html,
        status: page.status,
        seo_title: rev.seo_title || "",
        seo_description: rev.seo_description || "",
        action: "restore",
        restored_from: rev.version,
        note: `Restored version ${rev.version}`,
      },
    });
    if (error) return saveErrorResponse(error);
    revalidateContent();
    const r = saved as { version: number };
    return NextResponse.json(
      { ok: true, version: r.version, message: `Version ${rev.version} restored as version ${r.version}.` },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
