import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  address: z.object({
    city: z.string().trim().min(2).max(80),
    province: z.string().trim().min(2).max(80),
  }),
  shippingZoneId: z.string().uuid().optional(),
  lines: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(20)
    .optional(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = rateLimit(`quote:${clientIp(request)}`, { limit: 30, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec), "Cache-Control": "no-store" } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("quote_cod_shipping", {
    payload: {
      address: parsed.data.address,
      shipping_zone_id: parsed.data.shippingZoneId ?? null,
    },
  });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Optional: reprice lines server-side when provided
  let subtotalPaisa = 0;
  if (parsed.data.lines?.length) {
    for (const line of parsed.data.lines) {
      const { data: variant } = await supabase
        .from("product_variants")
        .select("price_paisa, purchasable, product_id, products!inner(status)")
        .eq("id", line.variantId)
        .maybeSingle();
      const product = variant?.products as { status?: string } | { status?: string }[] | null;
      const status = Array.isArray(product) ? product[0]?.status : product?.status;
      if (!variant || !variant.purchasable || status !== "active" || variant.price_paisa <= 0) {
        return NextResponse.json(
          { error: "product_not_purchasable" },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
      subtotalPaisa += variant.price_paisa * line.quantity;
    }
  }

  const options = (data?.options ?? []) as {
    id: string;
    name: string;
    flat_fee_paisa: number;
    cod_fee_paisa: number;
    notes: string;
  }[];

  const selectedId = parsed.data.shippingZoneId ?? options[0]?.id;
  const selected = options.find((o) => o.id === selectedId) ?? options[0];
  const shippingPaisa = selected?.flat_fee_paisa ?? 0;
  const codFeePaisa = selected?.cod_fee_paisa ?? 0;

  return NextResponse.json(
    {
      ok: data?.ok === true,
      error: data?.error ?? null,
      message: data?.message ?? null,
      options: options.map((o) => ({
        id: o.id,
        name: o.name,
        flatFeePaisa: o.flat_fee_paisa,
        codFeePaisa: o.cod_fee_paisa,
        notes: o.notes,
      })),
      quote:
        data?.ok === true && selected
          ? {
              shippingZoneId: selected.id,
              subtotalPaisa,
              shippingPaisa,
              codFeePaisa,
              totalDuePaisa: subtotalPaisa + shippingPaisa + codFeePaisa,
              currency: "PKR",
            }
          : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
