import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";

const ALLOWED: Record<string, string[]> = {
  placed: ["pending_confirmation", "confirmed", "cancelled"],
  pending_confirmation: ["confirmed", "cancelled"],
  confirmed: ["packing", "cancelled"],
  packing: ["shipped", "cancelled"],
  shipped: ["out_for_delivery", "delivery_failed"],
  out_for_delivery: ["delivered", "delivery_failed"],
  delivered: ["returned"],
  delivery_failed: ["shipped", "cancelled", "returned"],
  cancelled: [],
  returned: [],
  return_requested: ["returned", "cancelled"],
};

const schema = z.object({
  toStatus: z.string(),
  note: z.string().trim().max(500).optional().default(""),
  carrier: z.string().trim().max(120).optional(),
  trackingNumber: z.string().trim().max(120).optional(),
});

type Ctx = { params: Promise<{ orderNumber: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient([
      "owner",
      "admin",
      "manager",
      "fulfillment",
    ]);
    const { orderNumber } = await ctx.params;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    }

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, status, order_number")
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (error || !order) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const allowed = ALLOWED[order.status] || [];
    if (!allowed.includes(parsed.data.toStatus)) {
      return NextResponse.json(
        { error: "invalid_transition", message: `Cannot move ${order.status} → ${parsed.data.toStatus}` },
        { status: 409 },
      );
    }

    const { error: updErr } = await supabase
      .from("orders")
      .update({ status: parsed.data.toStatus })
      .eq("id", order.id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    await supabase.from("order_events").insert({
      order_id: order.id,
      event_type: "status_change",
      from_status: order.status,
      to_status: parsed.data.toStatus,
      actor_user_id: staff.userId,
      note: parsed.data.note || "",
    });

    if (parsed.data.carrier || parsed.data.trackingNumber) {
      await supabase.from("fulfillments").insert({
        order_id: order.id,
        carrier: parsed.data.carrier || "",
        tracking_number: parsed.data.trackingNumber || "",
        dispatched_at: ["shipped", "out_for_delivery"].includes(parsed.data.toStatus) ? new Date().toISOString() : null,
        delivered_at: parsed.data.toStatus === "delivered" ? new Date().toISOString() : null,
      });
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "order.status",
      entity_type: "orders",
      entity_id: order.id,
      before: { status: order.status },
      after: { status: parsed.data.toStatus },
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
