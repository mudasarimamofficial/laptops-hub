import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";

const schema = z.object({
  toStatus: z.string().trim().min(2),
  note: z.string().trim().max(500).optional().default(""),
  carrier: z.string().trim().max(120).optional().default(""),
  trackingNumber: z.string().trim().max(120).optional().default(""),
  /** Optimistic concurrency: reject if order moved since the UI loaded. */
  expectedFromStatus: z.string().trim().optional(),
});

type Ctx = { params: Promise<{ orderNumber: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter([
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

    const { data, error } = await supabase.rpc("transition_order_status", {
      payload: {
        actor_user_id: staff.userId,
        order_number: orderNumber,
        to_status: parsed.data.toStatus,
        note: parsed.data.note,
        carrier: parsed.data.carrier,
        tracking_number: parsed.data.trackingNumber,
        expected_from_status: parsed.data.expectedFromStatus || null,
      },
    });

    if (error) {
      const msg = error.message || "";
      if (msg.includes("not_found")) return NextResponse.json({ error: "not_found" }, { status: 404 });
      if (msg.includes("invalid_transition")) {
        return NextResponse.json(
          { error: "invalid_transition", message: "That status change is not allowed from the current state." },
          { status: 409 },
        );
      }
      if (msg.includes("stale_status")) {
        return NextResponse.json(
          { error: "stale_status", message: "Order status changed. Refresh and try again." },
          { status: 409 },
        );
      }
      if (msg.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      return NextResponse.json({ error: "server_error", message: "Could not update status." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ...(data as object) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
