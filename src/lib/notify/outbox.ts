import { createServiceClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { emailConfigured, safeError, sendEmail, type SendResult } from "./send-email";
import { businessOrderAlert, customerOrderConfirmation, type NotifyOrder } from "./templates";

/**
 * Delivers `notification_outbox` rows (one per new order, written by create_cod_order; never for replays).
 *
 * - Claim: `claim_notifications()` (migration 20261024100000) atomically leases due rows (FOR UPDATE SKIP LOCKED)
 *   with a fresh claim token. Every later write is conditional on that token, so a worker whose lease expired cannot
 *   overwrite the result of the worker that took over. Abandoned claims are recovered by lease age.
 * - Recipients: business alert and customer confirmation are tracked separately; an accepted recipient is never
 *   sent again. Each send carries the provider idempotency key `outbox-<id>-<recipient>` (Resend keeps keys for
 *   24 h; automatic retries stop after RETRY_WINDOW_HOURS so they stay inside that window).
 * - `accepted` means the provider accepted the message — not confirmed delivery to the inbox.
 * - Failures back off (BACKOFF_MIN) and stop after MAX_ATTEMPTS; staff can retry manually from the order page.
 * - Without provider settings nothing is claimed and nothing is reported as sent.
 */
export const MAX_ATTEMPTS = 5;
export const LEASE_SECONDS = 300;
export const RETRY_WINDOW_HOURS = 23;
const BACKOFF_MIN = [1, 5, 30, 120, 360];

export type OutboxRunResult = { configured: boolean; processed: number; accepted: number; failed: number; lost: number };

type Recipient = "business" | "customer";
export type OutboxRow = {
  id: string;
  order_id: string | null;
  template: string;
  attempts: number;
  claim_token: string;
  business_status: string;
  customer_status: string;
};

/** Test seams only (isolated tests inject provider calls and simulated crashes); production passes nothing. */
export type OutboxDeps = {
  send?: typeof sendEmail;
  afterAccepted?: (row: OutboxRow, recipient: Recipient) => void | Promise<void>;
};

type LoadedOrder = NotifyOrder & { email: string | null; accessToken: string };

async function loadOrder(orderId: string): Promise<LoadedOrder | null> {
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

/** Write while still holding the lease; false = another worker owns the row now. */
async function leased(row: OutboxRow, patch: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .from("notification_outbox")
    .update(patch)
    .eq("id", row.id)
    .eq("claim_token", row.claim_token)
    .eq("status", "sending")
    .select("id");
  if (error) throw new Error(`outbox update failed: ${error.message}`);
  return !!data?.length;
}

const backoff = (attempts: number) =>
  new Date(Date.now() + BACKOFF_MIN[Math.min(attempts, BACKOFF_MIN.length) - 1] * 60_000).toISOString();

/** Delivers one claimed row. Returns the final state, or "lost" when the lease was taken over. */
async function deliverRow(row: OutboxRow, deps: OutboxDeps): Promise<"accepted" | "failed" | "lost"> {
  const send = deps.send ?? sendEmail;
  const fail = async (error: string) =>
    (await leased(row, { status: "failed", claim_token: null, last_error: safeError(error), next_attempt_at: backoff(row.attempts) }))
      ? ("failed" as const)
      : ("lost" as const);

  if (row.template !== "order_placed_cod") return fail("unknown_template");
  if (!row.order_id) return fail("order_not_found");
  const order = await loadOrder(row.order_id);
  if (!order) return fail("order_not_found");
  const to = process.env.STORE_NOTIFY_EMAIL;
  if (!to) return fail("STORE_NOTIFY_EMAIL not set");
  const base = siteUrl();

  const attempt = async (recipient: Recipient, address: string, msg: { subject: string; text: string }): Promise<"ok" | "failed" | "lost"> => {
    const r: SendResult = await send({ to: address, ...msg, idempotencyKey: `outbox-${row.id}-${recipient}` });
    if (!r.ok) {
      if (!(await leased(row, { [`${recipient}_status`]: "failed", last_error: safeError(`${recipient}: ${r.error}`) }))) return "lost";
      return "failed";
    }
    // A crash between provider acceptance and this write leaves the recipient pending; the retry reuses the same
    // idempotency key inside the provider's retention window, so it is not delivered twice.
    await deps.afterAccepted?.(row, recipient);
    const ok = await leased(row, {
      [`${recipient}_status`]: "accepted",
      [`${recipient}_message_id`]: r.id,
      [`${recipient}_accepted_at`]: new Date().toISOString(),
    });
    return ok ? "ok" : "lost";
  };

  let failure: string | null = null;
  if (row.business_status !== "accepted") {
    const r = await attempt("business", to, businessOrderAlert(order, `${base}/admin/orders/${encodeURIComponent(order.orderNumber)}`));
    if (r === "lost") return "lost";
    if (r === "failed") failure = "business";
  }

  const customerWanted = process.env.NOTIFY_CUSTOMER_EMAIL === "1" && !!order.email;
  let customerDone = row.customer_status === "accepted" || row.customer_status === "skipped";
  if (!customerDone && !customerWanted) {
    if (!(await leased(row, { customer_status: "skipped" }))) return "lost";
    customerDone = true;
  } else if (!customerDone && order.email) {
    const r = await attempt("customer", order.email, customerOrderConfirmation(order, `${base}/order/success/${order.accessToken}`));
    if (r === "lost") return "lost";
    if (r === "ok") customerDone = true;
    else failure = failure ? "business+customer" : "customer";
  }

  if (failure || !customerDone) {
    const ok = await leased(row, { status: "failed", claim_token: null, next_attempt_at: backoff(row.attempts) });
    return ok ? "failed" : "lost";
  }
  const ok = await leased(row, { status: "accepted", claim_token: null, sent_at: new Date().toISOString(), last_error: null });
  return ok ? "accepted" : "lost";
}

/**
 * Claim and deliver due rows. `manual` (staff retry) ignores backoff, attempt limit and retry window for the given
 * order — the staff member decides; a recipient already accepted is still never resent.
 */
export async function processOutbox(
  opts: { orderId?: string; limit?: number; manual?: boolean } = {},
  deps: OutboxDeps = {},
): Promise<OutboxRunResult> {
  const result: OutboxRunResult = { configured: emailConfigured() && !!process.env.STORE_NOTIFY_EMAIL, processed: 0, accepted: 0, failed: 0, lost: 0 };
  if (!result.configured) return result;
  const { data: rows, error } = await createServiceClient().rpc("claim_notifications", {
    p_limit: opts.limit ?? 10,
    p_lease_seconds: LEASE_SECONDS,
    p_order_id: opts.orderId ?? null,
    p_max_attempts: MAX_ATTEMPTS,
    p_retry_window_hours: RETRY_WINDOW_HOURS,
    p_manual: !!opts.manual,
  });
  if (error) throw new Error(`claim_notifications failed: ${error.message}`);

  for (const row of (rows || []) as OutboxRow[]) {
    result.processed++;
    let outcome: "accepted" | "failed" | "lost";
    try {
      outcome = await deliverRow(row, deps);
    } catch {
      // Database or unexpected error mid-row: leave the lease to expire; recovery reclaims it by lease age.
      outcome = "lost";
    }
    result[outcome]++;
  }
  return result;
}
