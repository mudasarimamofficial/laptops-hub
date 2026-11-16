import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { REVIEW_STAFF_ROLES } from "@/lib/content/admin-roles";
import { moderationSchema } from "@/lib/validation/review";

/** Staff: approve / reject / return-to-queue a customer review (audited). Review text is never edited by staff. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(REVIEW_STAFF_ROLES);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = moderationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    const { data: before } = await supabase.from("product_reviews").select("status, product_id").eq("id", id).maybeSingle();
    if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { error } = await supabase
      .from("product_reviews")
      .update({
        status: parsed.data.status,
        moderation_note: parsed.data.note,
        moderated_by: staff.userId,
        moderated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "review.moderate",
      entity_type: "product_reviews",
      entity_id: id,
      before: { status: before.status },
      after: { status: parsed.data.status },
    });
    const { data: product } = await supabase.from("products").select("handle").eq("id", before.product_id).maybeSingle();
    if (product?.handle) revalidatePath(`/products/${product.handle}`);
    revalidateTag("reviews", { expire: 0 });
    return NextResponse.json({ ok: true, status: parsed.data.status }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
