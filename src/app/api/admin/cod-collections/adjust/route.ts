import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { pkrMajorToPaisa } from "@/lib/money";

/**
 * G22: reverse one COD collection, or record a signed correction, with a reason. Owners, admins and managers only.
 * The database function keeps the ledger append-only, idempotent and within 0…total due; order totals never change.
 * Before the production migration (20261126140000) is applied the function does not exist and this answers 503.
 */
const schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("reversal"),
    orderNumber: z.string().trim().min(4),
    collectionId: z.string().uuid(),
    reason: z.string().trim().min(5).max(500),
    idempotencyKey: z.string().trim().min(8).max(120),
  }),
  z.object({
    kind: z.literal("correction"),
    orderNumber: z.string().trim().min(4),
    deltaPkr: z
      .number()
      .refine((n) => Number.isFinite(n) && n !== 0 && Math.abs(n) <= 10_000_000, "Enter a non-zero amount."),
    reason: z.string().trim().min(5).max(500),
    idempotencyKey: z.string().trim().min(8).max(120),
  }),
]);

const MESSAGES: Record<string, [number, string]> = {
  reason_required: [400, "Write a reason of at least 5 characters."],
  validation_failed: [400, "Check the amount and try again. Nothing was changed."],
  idempotency_required: [400, "Missing request key. Reload the page and try again."],
  not_found: [404, "That order or collection was not found. Reload the page."],
  already_reversed: [409, "That collection has already been reversed."],
  below_zero: [409, "That would take the collected amount below zero. Nothing was changed."],
  over_collection: [409, "That would take the collected amount above the total due. Nothing was changed."],
  idempotency_conflict: [409, "This request key was already used for a different change. Reload the page and try again."],
  forbidden: [403, "Only the owner, an admin or a manager can correct collections."],
};

export async function POST(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin", "manager"]);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const reasonIssue = parsed.error.issues.some((i) => i.path[0] === "reason");
      return NextResponse.json(
        {
          error: "validation_failed",
          message: reasonIssue ? MESSAGES.reason_required[1] : "Choose a collection or enter a non-zero amount, and give a reason.",
        },
        { status: 400 },
      );
    }
    const body = parsed.data;
    const { data, error } = await supabase.rpc("adjust_cod_collection", {
      payload: {
        actor_user_id: staff.userId,
        order_number: body.orderNumber,
        kind: body.kind,
        idempotency_key: body.idempotencyKey,
        reason: body.reason,
        ...(body.kind === "reversal" ? { collection_id: body.collectionId } : { delta_paisa: Math.sign(body.deltaPkr) * pkrMajorToPaisa(Math.abs(body.deltaPkr)) }),
      },
    });

    if (error) {
      const msg = `${error.code || ""} ${error.message || ""}`;
      if (error.code === "PGRST202" || error.code === "42883" || /adjust_cod_collection/.test(error.message || "")) {
        return NextResponse.json(
          { error: "not_available", message: "Collection corrections are not switched on yet (database update pending)." },
          { status: 503 },
        );
      }
      const key = Object.keys(MESSAGES).find((k) => msg.includes(k));
      if (key) {
        const [status, message] = MESSAGES[key];
        return NextResponse.json({ error: key, message }, { status });
      }
      return NextResponse.json({ error: "server_error", message: "Could not record the correction. Nothing was changed." }, { status: 500 });
    }

    const r = data as { idempotent_replay?: boolean; delta_paisa: number; amount_collected_paisa: number; payment_status: string; adjustment_id: string };
    return NextResponse.json(
      {
        ok: true,
        idempotentReplay: !!r.idempotent_replay,
        adjustmentId: r.adjustment_id,
        deltaPaisa: r.delta_paisa,
        amountCollectedPaisa: r.amount_collected_paisa,
        paymentStatus: r.payment_status,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
