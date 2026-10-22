import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizePakistanMobile } from "@/lib/phone";
import { checkoutPayloadSchema } from "@/lib/validation/checkout";

export const runtime = "nodejs";

function hashIp(ip: string | null): string | undefined {
  if (!ip) return undefined;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function POST(request: Request) {
  if (process.env.COD_CHECKOUT_ENABLED !== "true") {
    return NextResponse.json(
      {
        error: "checkout_disabled",
        message:
          "COD checkout is not accepting live orders yet. Shipping zones and owner policies must be configured first.",
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = checkoutPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const phone = normalizePakistanMobile(data.customerPhone);
  if (!phone.ok) {
    return NextResponse.json({ error: "invalid_phone", message: phone.error }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: setting } = await supabase
    .from("store_settings")
    .select("value")
    .eq("key", "cod_checkout")
    .maybeSingle();

  if ((setting?.value as { enabled?: boolean } | null)?.enabled !== true) {
    return NextResponse.json(
      { error: "checkout_disabled", message: "COD checkout is disabled in store settings." },
      { status: 403 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip");

  const rpcPayload = {
    idempotency_key: data.idempotencyKey,
    customer_name: data.customerName,
    customer_phone_e164: phone.e164,
    customer_phone_normalized: phone.normalized,
    customer_email: data.customerEmail ?? null,
    customer_note: data.customerNote ?? "",
    shipping_zone_id: data.shippingZoneId,
    confirmation_version: "cod-v1-pending-legal",
    ip_hash: hashIp(ip ?? null) ?? null,
    user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    address: data.address,
    lines: data.lines.map((l) => ({
      variant_id: l.variantId,
      quantity: l.quantity,
    })),
  };

  let { data: result, error } = await supabase.rpc("create_cod_order", {
    payload: rpcPayload,
  });
  // A concurrent submit with the same idempotency key can lose the insert race (unique violation 23505).
  // The winner's order exists by then, so a second call returns it as a duplicate instead of an error.
  if (error?.code === "23505") {
    ({ data: result, error } = await supabase.rpc("create_cod_order", { payload: rpcPayload }));
  }

  if (error) {
    const msg = error.message || "order_failed";
    if (msg.includes("idempotency_conflict")) {
      return NextResponse.json(
        {
          error: "idempotency_conflict",
          message:
            "This checkout was already submitted with a different cart. Check Track order before ordering again, or reload checkout.",
        },
        { status: 409 },
      );
    }
    const status =
      msg.includes("checkout_disabled") || msg.includes("shipping")
        ? 403
        : msg.includes("not_found") || msg.includes("purchasable") || msg.includes("quantity")
          ? 409
          : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json({
    ok: true,
    orderNumber: result.order_number,
    accessToken: result.access_token,
    totalDuePaisa: result.total_due_paisa,
    duplicate: result.duplicate === true,
  });
}
