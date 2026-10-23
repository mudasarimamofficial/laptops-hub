import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";
import { processOutbox } from "@/lib/notify/outbox";

const schema = z.object({ orderNumber: z.string().trim().min(3).max(40) });

/** Staff: deliver an order's pending/failed notifications now. */
export async function POST(request: Request) {
  try {
    const { supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "fulfillment"]);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    const { data: order } = await supabase.from("orders").select("id").eq("order_number", parsed.data.orderNumber).maybeSingle();
    if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const result = await processOutbox({ orderId: order.id, manual: true });
    if (!result.configured) {
      return NextResponse.json(
        { error: "not_configured", message: "Email delivery is not configured (RESEND_API_KEY, STORE_FROM_EMAIL, STORE_NOTIFY_EMAIL)." },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
