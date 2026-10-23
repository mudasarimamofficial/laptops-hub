import { createServiceClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { emailConfigured, safeError, sendEmail } from "./send-email";
import { businessOrderAlert, customerOrderConfirmation, type NotifyOrder } from "./templates";

/**
 * Delivers `notification_outbox` rows (written by create_cod_order for every new order — never for replays).
 *
 * Row states: pending → sending → sent | failed (retried until MAX_ATTEMPTS). A row is claimed atomically
 * (UPDATE … WHERE status IN (pending, failed)), so concurrent runs never send it twice; provider idempotency keys
 * make a retry after a lost response safe too. A row is `sent` only after the provider accepted every message.
 * Without provider settings, rows stay `pending` (nothing is claimed, nothing is reported as sent).
 */
export const MAX_ATTEMPTS = 5;
const STALE_SENDING_MS = 15 * 60 * 1000;

export type OutboxRunResult = { configured: boolean; processed: number; sent: number; failed: number; skipped: number };

type OutboxRow = { id: string; order_id: string | null; template: string; attempts: number };

async function loadOrder(orderId: string): Promise<(NotifyOrder & { email: string | null; accessToken: string }) | null> {
  const { data } = await createServiceClient()
    .from("orders")
    .select(
      "order_number, created_at, customer_name, customer_phone_normalized, customer_email, customer_note, access_token, subtotal_paisa, shipping_paisa, cod_fee_paisa, total_due_paisa, shipping_zones(name), order_addresses(city, province), order_items(title_snapshot, variant_title_snapshot, quantity, line_total_paisa)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!data) return null;
  const d = data as unknown as {
    order_number: string; created_at: string; customer_name: string; customer_phone_normalized: string; customer_email: string | null;
    customer_note: string; access_token: string; subtotal_paisa: number; shipping_paisa: number; cod_fee_paisa: number; total_due_paisa: number;
    shipping_zones: { name: string } | { name: string }[] | null;
    order_addresses: { city: string; province: string } | { city: string; province: string }[] | null;
    order_items: { title_snapshot: string; variant_title_snapshot: string; quantity: number; line_total_paisa: number }[];
  };
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? (v[0] ?? null) : v);
  const addr = one(d.order_addresses);
  return {
    orderNumber: d.order_number,
    placedAt: d.created_at,
    customerName: d.customer_name,
    phoneNational: d.customer_phone_normalized.startsWith("92") ? "0" + d.customer_phone_normalized.slice(2) : d.customer_phone_normalized,
    city: addr?.city ?? "",
    province: addr?.province ?? "",
    items: (d.order_items || []).map((i) => ({ title: i.title_snapshot, variant: i.variant_title_snapshot, quantity: i.quantity, lineTotalPaisa: i.line_total_paisa })),
    subtotalPaisa: d.subtotal_paisa,
    shippingPaisa: d.shipping_paisa,
    codFeePaisa: d.cod_fee_paisa,
    totalDuePaisa: d.total_due_paisa,
    deliveryOption: one(d.shipping_zones)?.name ?? null,
    customerNote: d.customer_note || "",
    email: d.customer_email,
    accessToken: d.access_token,
  };
}

async function deliver(row: OutboxRow): Promise<{ ok: boolean; error?: string }> {
  if (row.template !== "order_placed_cod" || !row.order_id) return { ok: false, error: "unknown_template" };
  const order = await loadOrder(row.order_id);
  if (!order) return { ok: false, error: "order_not_found" };
  const to = process.env.STORE_NOTIFY_EMAIL;
  if (!to) return { ok: false, error: "STORE_NOTIFY_EMAIL not set" };
  const base = siteUrl();
  const biz = businessOrderAlert(order, `${base}/admin/orders/${encodeURIComponent(order.orderNumber)}`);
  const r1 = await sendEmail({ to, ...biz, idempotencyKey: `outbox-${row.id}-business` });
  if (!r1.ok) return { ok: false, error: `business: ${r1.error}` };
  if (process.env.NOTIFY_CUSTOMER_EMAIL === "1" && order.email) {
    const msg = customerOrderConfirmation(order, `${base}/order/success/${order.accessToken}`);
    const r2 = await sendEmail({ to: order.email, ...msg, idempotencyKey: `outbox-${row.id}-customer` });
    if (!r2.ok) return { ok: false, error: `customer: ${r2.error}` };
  }
  return { ok: true };
}

export async function processOutbox(opts: { orderId?: string; limit?: number } = {}): Promise<OutboxRunResult> {
  const result: OutboxRunResult = { configured: emailConfigured() && !!process.env.STORE_NOTIFY_EMAIL, processed: 0, sent: 0, failed: 0, skipped: 0 };
  if (!result.configured) return result;
  const sb = createServiceClient();

  // A run that crashed mid-send leaves rows in `sending`; hand old ones back to the retry path.
  await sb
    .from("notification_outbox")
    .update({ status: "failed", last_error: "interrupted" })
    .eq("status", "sending")
    .lt("created_at", new Date(Date.now() - STALE_SENDING_MS).toISOString())
    .lt("attempts", MAX_ATTEMPTS);

  let q = sb
    .from("notification_outbox")
    .select("id, order_id, template, attempts")
    .in("status", ["pending", "failed"])
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(opts.limit ?? 10);
  if (opts.orderId) q = q.eq("order_id", opts.orderId);
  const { data: rows } = await q;

  for (const row of (rows || []) as OutboxRow[]) {
    // Atomic claim: only one run moves a row to `sending`.
    const { data: claimed } = await sb
      .from("notification_outbox")
      .update({ status: "sending", attempts: row.attempts + 1 })
      .eq("id", row.id)
      .in("status", ["pending", "failed"])
      .eq("attempts", row.attempts)
      .select("id");
    if (!claimed?.length) {
      result.skipped++;
      continue;
    }
    result.processed++;
    let outcome: { ok: boolean; error?: string };
    try {
      outcome = await deliver(row);
    } catch (e) {
      outcome = { ok: false, error: safeError(e instanceof Error ? e.message : "error") };
    }
    if (outcome.ok) {
      await sb.from("notification_outbox").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", row.id);
      result.sent++;
    } else {
      await sb.from("notification_outbox").update({ status: "failed", last_error: safeError(outcome.error || "failed") }).eq("id", row.id);
      result.failed++;
    }
  }
  return result;
}
