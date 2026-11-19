import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { BADGE_STAFF_ROLES } from "@/lib/content/admin-roles";
import { editorialBadgeInputSchema } from "@/lib/content/social-proof";
import { suppressFeaturedFlameProduct } from "@/lib/content/featured-flame-preset-server";

function refresh() {
  revalidateTag("product-badges", { expire: 0 });
  revalidateTag("featured-flame-preset", { expire: 0 });
  revalidatePath("/", "layout");
  revalidatePath("/admin/merchandising");
}

/** Staff: set (create or replace) the editorial badge of one product. Sales claims ("Top seller") cannot be set here. */
export async function PUT(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(BADGE_STAFF_ROLES);
    const parsed = editorialBadgeInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = String(i.path[0] ?? "form");
        if (!fieldErrors[k]) fieldErrors[k] = i.message;
      }
      return NextResponse.json({ error: "validation_failed", message: "Check the highlighted fields.", fieldErrors }, { status: 400 });
    }
    const v = parsed.data;
    const { data: product } = await supabase.from("products").select("id").eq("handle", v.productHandle).is("deleted_at", null).maybeSingle();
    if (!product) {
      return NextResponse.json({ error: "validation_failed", message: "Check the highlighted fields.", fieldErrors: { productHandle: "No product with this handle." } }, { status: 400 });
    }
    const { data: before } = await supabase.from("product_badges").select("kind, starts_at, ends_at").eq("product_id", product.id).maybeSingle();
    const row = {
      product_id: product.id,
      kind: v.kind,
      starts_at: v.startsAt || null,
      ends_at: v.endsAt || null,
      note: v.note,
      updated_by: staff.userId,
      ...(before ? {} : { created_by: staff.userId }),
    };
    const { error } = await supabase.from("product_badges").upsert(row, { onConflict: "product_id" });
    if (error) return NextResponse.json({ error: "save_failed", message: "Could not save the badge." }, { status: 500 });
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: before ? "product_badge.update" : "product_badge.create",
      entity_type: "product_badges",
      entity_id: product.id,
      before: before ?? null,
      after: { kind: row.kind, starts_at: row.starts_at, ends_at: row.ends_at },
    });
    refresh();
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

const deleteSchema = z.object({ productId: z.string().uuid() });

/** Staff: remove a product's editorial badge. */
export async function DELETE(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(BADGE_STAFF_ROLES);
    const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { data: before } = await supabase
      .from("product_badges")
      .select("kind, starts_at, ends_at, note")
      .eq("product_id", parsed.data.productId)
      .maybeSingle();
    if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { error } = await supabase.from("product_badges").delete().eq("product_id", parsed.data.productId);
    if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    await suppressFeaturedFlameProduct(parsed.data.productId);
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "product_badge.delete",
      entity_type: "product_badges",
      entity_id: parsed.data.productId,
      before,
    });
    refresh();
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
