import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { pkrMajorToPaisa } from "@/lib/money";

const schema = z.object({
  orderNumber: z.string().trim().min(4),
  amountPkr: z.number().positive().max(10_000_000),
  collectorRef: z.string().trim().max(120).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export async function POST(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter([
      "owner",
      "admin",
      "manager",
      "fulfillment",
    ]);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", message: "Amount, order number, and idempotency key are required." },
        { status: 400 },
      );
    }

    const amount = pkrMajorToPaisa(parsed.data.amountPkr);
    const { data, error } = await supabase.rpc("record_cod_collection", {
      payload: {
        actor_user_id: staff.userId,
        order_number: parsed.data.orderNumber,
        amount_paisa: amount,
        idempotency_key: parsed.data.idempotencyKey,
        collector_ref: parsed.data.collectorRef,
        note: parsed.data.note,
      },
    });

    if (error) {
      const msg = error.message || "";
      if (msg.includes("not_found")) return NextResponse.json({ error: "not_found" }, { status: 404 });
      if (msg.includes("over_collection")) {
        return NextResponse.json(
          { error: "over_collection", message: "Collected amount would exceed total due." },
          { status: 409 },
        );
      }
      if (msg.includes("idempotency_conflict")) {
        return NextResponse.json(
          {
            error: "idempotency_conflict",
            message: "This collection key was already used for a different order or amount. Nothing was recorded.",
          },
          { status: 409 },
        );
      }
      if (msg.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      if (msg.includes("idempotency_required") || msg.includes("validation_failed")) {
        return NextResponse.json({ error: "validation_failed" }, { status: 400 });
      }
      return NextResponse.json({ error: "server_error", message: "Could not record collection." }, { status: 500 });
    }

    const result = data as {
      ok: boolean;
      idempotent_replay?: boolean;
      amount_collected_paisa: number;
      payment_status: string;
      collection_id: string;
    };

    return NextResponse.json(
      {
        ok: true,
        idempotentReplay: !!result.idempotent_replay,
        amountCollectedPaisa: result.amount_collected_paisa,
        paymentStatus: result.payment_status,
        collectionId: result.collection_id,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
