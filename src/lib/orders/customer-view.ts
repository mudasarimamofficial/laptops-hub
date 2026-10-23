import { createServiceClient } from "@/lib/supabase/server";

/**
 * What a customer may see about their own order. Read server-side with the service role, keyed by the secret
 * access token (confirmation link) or by order number + phone (lookup). Never includes the delivery address, email,
 * staff ids or internal notes.
 */
export type CustomerOrder = {
  orderNumber: string;
  accessToken: string;
  placedAt: string;
  status: string;
  statusLabel: string;
  paymentLabel: string;
  items: { title: string; variant: string; quantity: number; lineTotalPaisa: number }[];
  subtotalPaisa: number;
  shippingPaisa: number;
  codFeePaisa: number;
  totalDuePaisa: number;
  amountCollectedPaisa: number;
  deliveryOption: string | null;
  city: string | null;
  tracking: { carrier: string; trackingNumber: string } | null;
};

export const STATUS_LABEL: Record<string, string> = {
  placed: "Received — awaiting confirmation",
  pending_confirmation: "Being confirmed",
  confirmed: "Confirmed",
  packing: "Being packed",
  shipped: "Dispatched",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  delivery_failed: "Delivery attempt failed",
  cancelled: "Cancelled",
  returned: "Returned",
  return_requested: "Return requested",
};

export const PAYMENT_LABEL: Record<string, string> = {
  unpaid_cod: "Pay cash on delivery",
  collection_pending: "Payment being recorded",
  collected: "Paid — cash collected",
  partially_collected: "Partly paid",
  collection_failed: "Payment not collected",
  refunded_or_adjusted: "Refunded / adjusted",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  order_number: string;
  access_token: string;
  created_at: string;
  status: string;
  payment_status: string;
  subtotal_paisa: number;
  shipping_paisa: number;
  cod_fee_paisa: number;
  total_due_paisa: number;
  amount_collected_paisa: number;
  shipping_zones: { name: string } | { name: string }[] | null;
  order_addresses: { city: string } | { city: string }[] | null;
  order_items: { title_snapshot: string; variant_title_snapshot: string; quantity: number; line_total_paisa: number }[];
  fulfillments: { carrier: string; tracking_number: string; created_at: string }[];
};

const SELECT =
  "id, order_number, access_token, created_at, status, payment_status, subtotal_paisa, shipping_paisa, cod_fee_paisa, total_due_paisa, amount_collected_paisa, shipping_zones(name), order_addresses(city), order_items(title_snapshot, variant_title_snapshot, quantity, line_total_paisa), fulfillments(carrier, tracking_number, created_at)";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

function toCustomer(r: Row): CustomerOrder {
  const latest = [...(r.fulfillments || [])]
    .filter((f) => f.carrier || f.tracking_number)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  return {
    orderNumber: r.order_number,
    accessToken: r.access_token,
    placedAt: r.created_at,
    status: r.status,
    statusLabel: STATUS_LABEL[r.status] || r.status,
    paymentLabel: PAYMENT_LABEL[r.payment_status] || r.payment_status,
    items: (r.order_items || []).map((i) => ({ title: i.title_snapshot, variant: i.variant_title_snapshot, quantity: i.quantity, lineTotalPaisa: i.line_total_paisa })),
    subtotalPaisa: r.subtotal_paisa,
    shippingPaisa: r.shipping_paisa,
    codFeePaisa: r.cod_fee_paisa,
    totalDuePaisa: r.total_due_paisa,
    amountCollectedPaisa: r.amount_collected_paisa,
    deliveryOption: one(r.shipping_zones)?.name ?? null,
    city: one(r.order_addresses)?.city ?? null,
    tracking: latest ? { carrier: latest.carrier, trackingNumber: latest.tracking_number } : null,
  };
}

export async function getOrderByToken(token: string): Promise<CustomerOrder | null> {
  if (!UUID_RE.test(token)) return null;
  const { data } = await createServiceClient().from("orders").select(SELECT).eq("access_token", token).maybeSingle();
  return data ? toCustomer(data as unknown as Row) : null;
}

/** Lookup by order number + the phone used at checkout (normalised, e.g. 923001234567). */
export async function getOrderByNumberAndPhone(orderNumber: string, phoneNormalized: string): Promise<CustomerOrder | null> {
  const { data } = await createServiceClient()
    .from("orders")
    .select(SELECT)
    .eq("order_number", orderNumber.trim().toUpperCase())
    .eq("customer_phone_normalized", phoneNormalized)
    .maybeSingle();
  return data ? toCustomer(data as unknown as Row) : null;
}
