import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";
import { pkrMajorToPaisa } from "@/lib/money";

const schema = z.object({
  orderNumber: z.string().trim().min(4),
  amountPkr: z.number().positive().max(10_000_000),
  collectorRef: z.string().trim().max(120).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
});

export async function POST(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient([
      "owner",
      "admin",
      "manager",
      "fulfillment",
    ]);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    }

    const amount = pkrMajorToPaisa(parsed.data.amountPkr);
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, total_due_paisa, amount_collected_paisa, payment_status, order_number")
      .eq("order_number", parsed.data.orderNumber)
      .maybeSingle();
    if (error || !order) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const nextCollected = order.amount_collected_paisa + amount;
    if (nextCollected > order.total_due_paisa) {
      return NextResponse.json(
        { error: "over_collection", message: "Collected amount would exceed total due." },
        { status: 409 },
      );
    }

    const paymentStatus =
      nextCollected >= order.total_due_paisa
        ? "collected"
        : nextCollected > 0
          ? "partially_collected"
          : order.payment_status;

    const { error: colErr } = await supabase.from("cod_collections").insert({
      order_id: order.id,
      amount_paisa: amount,
      collector_ref: parsed.data.collectorRef,
      recorded_by: staff.userId,
      note: parsed.data.note,
    });
    if (colErr) return NextResponse.json({ error: colErr.message }, { status: 500 });

    await supabase
      .from("orders")
      .update({ amount_collected_paisa: nextCollected, payment_status: paymentStatus })
      .eq("id", order.id);

    await supabase.from("order_events").insert({
      order_id: order.id,
      event_type: "cod_collected",
      actor_user_id: staff.userId,
      note: parsed.data.note || "",
      meta: { amount_paisa: amount, payment_status: paymentStatus },
    });

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "cod.collect",
      entity_type: "orders",
      entity_id: order.id,
      after: { amount_paisa: amount, payment_status: paymentStatus },
    });

    return NextResponse.json(
      { ok: true, amountCollectedPaisa: nextCollected, paymentStatus },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
