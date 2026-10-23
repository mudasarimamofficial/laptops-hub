import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizePakistanMobile } from "@/lib/phone";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { isCrossSite } from "@/lib/validation/contact";
import { getOrderByNumberAndPhone } from "@/lib/orders/customer-view";

export const runtime = "nodejs";

const schema = z.object({
  orderNumber: z.string().trim().min(6).max(40).regex(/^[A-Za-z0-9-]+$/),
  phone: z.string().trim().min(10).max(20),
});

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Customer order lookup: order number + the phone used at checkout. Both must match; the same 404 is returned
 * whichever is wrong, and attempts are rate-limited per IP so numbers cannot be enumerated.
 */
export async function POST(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (isCrossSite(request.headers.get("origin"), request.url, host)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403, headers: NO_STORE });
  }
  const limited = await rateLimit(`order-lookup:${clientIp(request)}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many attempts. Try again later." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(limited.retryAfterSec) } },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400, headers: NO_STORE });
  const phone = normalizePakistanMobile(parsed.data.phone);
  if (!phone.ok) return NextResponse.json({ error: "invalid_phone", message: phone.error }, { status: 400, headers: NO_STORE });

  const order = await getOrderByNumberAndPhone(parsed.data.orderNumber, phone.normalized).catch(() => null);
  if (!order) {
    return NextResponse.json(
      { error: "not_found", message: "No order matches that order number and phone." },
      { status: 404, headers: NO_STORE },
    );
  }
  return NextResponse.json({ ok: true, url: `/order/success/${order.accessToken}` }, { headers: NO_STORE });
}
