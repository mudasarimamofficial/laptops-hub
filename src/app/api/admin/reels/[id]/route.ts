import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { REEL_STAFF_ROLES } from "@/lib/content/admin-roles";
import { reelRowFromInput } from "../shared";

type Ctx = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();

function refresh() {
  revalidateTag("reels", { expire: 0 });
  revalidatePath("/");
}

/** Staff: update a reel (audited, with before/after status and rights). */
export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(REEL_STAFF_ROLES);
    const { id } = await params;
    if (!uuid.safeParse(id).success) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { data: before } = await supabase.from("reels").select("title, status, rights_status").eq("id", id).maybeSingle();
    if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const built = await reelRowFromInput(supabase, await request.json().catch(() => null));
    if (!built.ok) return NextResponse.json(built.body, { status: built.status });
    const { error } = await supabase.from("reels").update(built.row).eq("id", id);
    if (error) return NextResponse.json({ error: "save_failed", message: "Could not save the reel." }, { status: 500 });
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "reel.update",
      entity_type: "reels",
      entity_id: id,
      before,
      after: { title: built.row.title, status: built.row.status, rights_status: built.row.rights_status },
    });
    refresh();
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

/** Staff: delete a reel (the video file itself is not touched). */
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(REEL_STAFF_ROLES);
    const { id } = await params;
    if (!uuid.safeParse(id).success) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { data: before } = await supabase.from("reels").select("title, status, video_url").eq("id", id).maybeSingle();
    if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { error } = await supabase.from("reels").delete().eq("id", id);
    if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    await supabase.from("audit_logs").insert({ actor_user_id: staff.userId, action: "reel.delete", entity_type: "reels", entity_id: id, before });
    refresh();
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
