import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { POST_STAFF_ROLES } from "@/lib/content/admin-roles";
import { revalidatePath, revalidateTag } from "next/cache";

type Ctx = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { supabase } = await createAuthorizedStaffClient(POST_STAFF_ROLES);
    const { id } = await params;
    if (!uuid.safeParse(id).success) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { data, error } = await supabase
      .from("article_revisions")
      .select("id, title, status, created_at, seo_title")
      .eq("article_id", id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return NextResponse.json({ error: "database_error", message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, revisions: data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

/** Restore a prior revision onto the live article (creates another revision of current first). */
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(POST_STAFF_ROLES);
    const { id } = await params;
    if (!uuid.safeParse(id).success) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const body = await request.json().catch(() => null);
    const revisionId = z.string().uuid().safeParse(body?.revisionId);
    if (!revisionId.success) return NextResponse.json({ error: "validation_failed", message: "revisionId required" }, { status: 400 });

    const { data: current } = await supabase
      .from("articles")
      .select("title, excerpt, body_html, status, seo_title, seo_description")
      .eq("id", id)
      .maybeSingle();
    if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const { data: rev } = await supabase.from("article_revisions").select("*").eq("id", revisionId.data).eq("article_id", id).maybeSingle();
    if (!rev) return NextResponse.json({ error: "not_found", message: "Revision not found" }, { status: 404 });

    await supabase.from("article_revisions").insert({
      article_id: id,
      title: current.title,
      excerpt: current.excerpt || "",
      body_html: current.body_html || "",
      status: current.status,
      seo_title: current.seo_title,
      seo_description: current.seo_description,
      created_by: staff.userId,
    });

    const { error } = await supabase
      .from("articles")
      .update({
        title: rev.title,
        excerpt: rev.excerpt,
        body_html: rev.body_html,
        status: rev.status,
        seo_title: rev.seo_title,
        seo_description: rev.seo_description,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "restore_failed", message: error.message }, { status: 500 });

    revalidateTag("content", { expire: 0 });
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
