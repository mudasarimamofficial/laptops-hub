import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { POST_STAFF_ROLES } from "@/lib/content/admin-roles";
import { postRowFromInput } from "../shared";

type Ctx = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();

function refresh() {
  revalidateTag("content", { expire: 0 });
  revalidatePath("/", "layout");
}

/** Staff: update a post. `published_at` is set the first time a post is published and kept afterwards. */
export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(POST_STAFF_ROLES);
    const { id } = await params;
    if (!uuid.safeParse(id).success) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { data: before } = await supabase
      .from("articles")
      .select("slug, status, published_at, title, excerpt, body_html, seo_title, seo_description")
      .eq("id", id)
      .maybeSingle();
    if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const built = postRowFromInput(await request.json().catch(() => null));
    if (!built.ok) return NextResponse.json(built.body, { status: built.status });
    if (built.row.slug !== before.slug) {
      const { data: clash } = await supabase.from("articles").select("id").eq("slug", built.row.slug).neq("id", id).maybeSingle();
      if (clash) {
        return NextResponse.json(
          { error: "validation_failed", message: "Check the highlighted fields.", fieldErrors: { slug: "A post with this address already exists." } },
          { status: 409 },
        );
      }
    }
    const now = new Date().toISOString();
    const published_at = built.row.status === "published" ? before.published_at || now : before.published_at;
    // Revision history before overwrite (record-level undo support).
    await supabase.from("article_revisions").insert({
      article_id: id,
      title: before.title,
      excerpt: before.excerpt || "",
      body_html: before.body_html || "",
      status: before.status,
      seo_title: before.seo_title,
      seo_description: before.seo_description,
      created_by: staff.userId,
    });
    const { error } = await supabase.from("articles").update({ ...built.row, published_at, updated_at: now }).eq("id", id);
    if (error) return NextResponse.json({ error: "save_failed", message: "Could not save the post." }, { status: 500 });
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "post.update",
      entity_type: "articles",
      entity_id: id,
      before: { slug: before.slug, status: before.status },
      after: { slug: built.row.slug, status: built.row.status },
    });
    refresh();
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

/** Staff: delete a post (audited). */
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(POST_STAFF_ROLES);
    const { id } = await params;
    if (!uuid.safeParse(id).success) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { data: before } = await supabase.from("articles").select("slug, status, title").eq("id", id).maybeSingle();
    if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { error } = await supabase.from("articles").delete().eq("id", id);
    if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    await supabase.from("audit_logs").insert({ actor_user_id: staff.userId, action: "post.delete", entity_type: "articles", entity_id: id, before });
    refresh();
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
