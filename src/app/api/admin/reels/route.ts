import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { REEL_STAFF_ROLES } from "@/lib/content/admin-roles";
import { reelRowFromInput, replaceReelProducts } from "./shared";

/** Staff: create a reel. Publishing requires cleared rights (validated here and by a DB constraint). */
export async function POST(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(REEL_STAFF_ROLES);
    const built = await reelRowFromInput(supabase, await request.json().catch(() => null));
    if (!built.ok) return NextResponse.json(built.body, { status: built.status });
    const { data, error } = await supabase
      .from("reels")
      .insert({ ...built.row, created_by: staff.userId })
      .select("id")
      .single();
    if (error || !data) return NextResponse.json({ error: "save_failed", message: "Could not save the reel." }, { status: 500 });
    const linked = await replaceReelProducts(supabase, data.id, built.productIds);
    if (linked.error) {
      return NextResponse.json({ error: "save_failed", message: "Reel saved but product links failed. Edit and save again." }, { status: 500 });
    }
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "reel.create",
      entity_type: "reels",
      entity_id: data.id,
      after: { title: built.row.title, status: built.row.status, rights_status: built.row.rights_status, product_count: built.productIds.length },
    });
    revalidateTag("reels", { expire: 0 });
    revalidatePath("/");
    return NextResponse.json({ ok: true, id: data.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
