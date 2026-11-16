import { NextResponse } from "next/server";
import { refreshStorefrontCatalog } from "@/lib/catalog/refresh";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { INVENTORY_ADJUST_ROLES, INVENTORY_REASONS, inventoryProblemMessage } from "@/lib/commerce/inventory-adjust";
import { isCrossSite } from "@/lib/validation/contact";

const headers = { "Cache-Control": "no-store" };

const schema = z.discriminatedUnion("mode", [
  z.object({
    variantId: z.string().uuid(),
    mode: z.literal("delta"),
    amount: z.number().int().min(-100_000).max(100_000),
    reason: z.enum(INVENTORY_REASONS),
    note: z.string().trim().max(300).default(""),
  }),
  z.object({
    variantId: z.string().uuid(),
    mode: z.literal("set"),
    amount: z.number().int().min(0).max(100_000),
    expectedQuantity: z.number().int(),
    reason: z.enum(INVENTORY_REASONS),
    note: z.string().trim().max(300).default(""),
  }),
]);

/** Inventory desk: add/remove units or set a counted quantity. Atomic in the database (adjust_inventory), audited. */
export async function POST(request: Request) {
  try {
    if (isCrossSite(request.headers.get("origin"), request.url, request.headers.get("x-forwarded-host") || request.headers.get("host"))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
    }
    const { staff, supabase } = await createAuthorizedStaffWriter(INVENTORY_ADJUST_ROLES);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed", message: "Enter a whole number and choose a reason." }, { status: 400, headers });
    }
    const b = parsed.data;
    const { data, error } = await supabase.rpc("adjust_inventory", {
      payload: {
        variant_id: b.variantId,
        mode: b.mode,
        amount: b.amount,
        reason: b.reason,
        actor_user_id: staff.userId,
        expected_quantity: b.mode === "set" ? b.expectedQuantity : null,
      },
    });
    if (error) {
      const code = (error.message || "").match(/[a-z_]+/)?.[0] ?? "adjust_failed";
      const known = inventoryProblemMessage(code);
      return NextResponse.json({ error: known ? code : "adjust_failed", message: known ?? "The stock could not be changed. Nothing was saved." }, { status: known ? 409 : 500, headers });
    }
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "inventory.adjust",
      entity_type: "product_variants",
      entity_id: b.variantId,
      before: { quantity: data?.quantity_before },
      after: { quantity: data?.quantity_after, reason: b.reason, note: b.note || null },
    });
    refreshStorefrontCatalog();
    return NextResponse.json({ ok: true, quantityAfter: data?.quantity_after, delta: data?.delta }, { headers });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
