import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { POST_STAFF_ROLES } from "@/lib/content/admin-roles";
import { postRowFromInput } from "./shared";

/** Staff: create a blog post (row in public.articles). Body HTML is sanitised before it is stored. */
export async function POST(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(POST_STAFF_ROLES);
    const built = postRowFromInput(await request.json().catch(() => null));
    if (!built.ok) return NextResponse.json(built.body, { status: built.status });
    const { data: clash } = await supabase.from("articles").select("id").eq("slug", built.row.slug).maybeSingle();
    if (clash) {
      return NextResponse.json(
        { error: "validation_failed", message: "Check the highlighted fields.", fieldErrors: { slug: "A post with this address already exists." } },
        { status: 409 },
      );
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("articles")
      .insert({ ...built.row, published_at: built.row.status === "published" ? now : null, updated_at: now })
      .select("id")
      .single();
    if (error || !data) return NextResponse.json({ error: "save_failed", message: "Could not save the post." }, { status: 500 });
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "post.create",
      entity_type: "articles",
      entity_id: data.id,
      after: { slug: built.row.slug, status: built.row.status },
    });
    revalidateTag("content", { expire: 0 });
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, id: data.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
