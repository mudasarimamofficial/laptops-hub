import { formatPkr } from "@/lib/money";

/** Order facts needed by notification templates (read server-side by the outbox worker). */
export type NotifyOrder = {
  orderNumber: string;
  placedAt: string;
  customerName: string;
  phoneNational: string;
  city: string;
  province: string;
  items: { title: string; variant: string; quantity: number; lineTotalPaisa: number }[];
  subtotalPaisa: number;
  shippingPaisa: number;
  codFeePaisa: number;
  totalDuePaisa: number;
  deliveryOption: string | null;
  customerNote: string;
};

export type EmailMessage = { subject: string; text: string };

const lines = (o: NotifyOrder) =>
  o.items.map((i) => `- ${i.title}${i.variant && i.variant !== "Default" ? ` (${i.variant})` : ""} × ${i.quantity} — ${formatPkr(i.lineTotalPaisa)}`);

const totals = (o: NotifyOrder) => [
  `Items: ${formatPkr(o.subtotalPaisa)}`,
  `Delivery${o.deliveryOption ? ` (${o.deliveryOption})` : ""}: ${formatPkr(o.shippingPaisa)}`,
  ...(o.codFeePaisa > 0 ? [`COD fee: ${formatPkr(o.codFeePaisa)}`] : []),
  `Cash due on delivery: ${formatPkr(o.totalDuePaisa)}`,
];

/** New-order alert for the store inbox: what staff need to call the customer and confirm availability. */
export function businessOrderAlert(o: NotifyOrder, adminUrl: string): EmailMessage {
  return {
    subject: `New COD order ${o.orderNumber} — ${formatPkr(o.totalDuePaisa)}`,
    text: [
      `New order ${o.orderNumber} (${new Date(o.placedAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}).`,
      "",
      `Customer: ${o.customerName} · ${o.phoneNational}`,
      `Deliver to: ${o.city}, ${o.province}`,
      ...(o.customerNote ? [`Customer note: ${o.customerNote}`] : []),
      "",
      ...lines(o),
      "",
      ...totals(o),
      "",
      "Confirm availability with the customer before marking the order confirmed.",
      `Open in admin: ${adminUrl}`,
    ].join("\n"),
  };
}

/** Customer confirmation (only when the customer gave an email and the owner enabled customer emails). */
export function customerOrderConfirmation(o: NotifyOrder, orderUrl: string): EmailMessage {
  return {
    subject: `Laptops HUB order ${o.orderNumber} received`,
    text: [
      `Hello ${o.customerName},`,
      "",
      `We have received your order ${o.orderNumber}. Our team reviews every order and confirms availability with you`,
      "by phone before dispatch. You pay in cash when the parcel arrives.",
      "",
      ...lines(o),
      "",
      ...totals(o),
      "",
      `Check your order at any time: ${orderUrl}`,
      "",
      "Laptops HUB",
    ].join("\n"),
  };
}
