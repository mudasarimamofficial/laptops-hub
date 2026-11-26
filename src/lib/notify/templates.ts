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

/** Merchant wording from Settings › Notifications ("" = built-in wording). */
export type TemplateOptions = { subject?: string; intro?: string };

/** New-order alert for the store inbox: what staff need to call the customer and confirm availability. */
export function businessOrderAlert(o: NotifyOrder, adminUrl: string, opts: TemplateOptions = {}): EmailMessage {
  return {
    subject: opts.subject || `New COD order ${o.orderNumber} — ${formatPkr(o.totalDuePaisa)}`,
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
export function customerOrderConfirmation(o: NotifyOrder, orderUrl: string, opts: TemplateOptions = {}): EmailMessage {
  return {
    subject: opts.subject || `Laptops HUB order ${o.orderNumber} received`,
    text: [
      `Hello ${o.customerName},`,
      "",
      // Built-in wording is kept byte-identical so in-flight retries keep the same provider idempotency payload.
      ...(opts.intro
        ? [`We have received your order ${o.orderNumber}.`, ...opts.intro.split("\n")]
        : [
            `We have received your order ${o.orderNumber}. Our team reviews every order and confirms availability with you`,
            "by phone before dispatch. You pay in cash when the parcel arrives.",
          ]),
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

export type NotifyInquiry = {
  name: string;
  phone: string | null;
  email: string | null;
  subject: string;
  message: string;
  createdAt: string;
};

/** New website inquiry alert for the staff recipients (Settings › Notifications › inquiry alerts). */
export function businessInquiryAlert(q: NotifyInquiry, adminUrl: string): EmailMessage {
  const subject = q.subject.replace(/[\r\n]+/g, " ").trim();
  return {
    subject: `New website inquiry${subject ? ` — ${subject.slice(0, 90)}` : ""}`,
    text: [
      `New inquiry (${new Date(q.createdAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}).`,
      "",
      `From: ${q.name}`,
      ...(q.phone ? [`Phone: ${q.phone}`] : []),
      ...(q.email ? [`Email: ${q.email}`] : []),
      ...(subject ? [`Subject: ${subject}`] : []),
      "",
      q.message.length > 2000 ? `${q.message.slice(0, 2000)}…` : q.message,
      "",
      `Reply and update the status in admin: ${adminUrl}`,
    ].join("\n"),
  };
}

/** Staff-only test message from Settings › Notifications (never sent to customers). */
export function testMessage(sentBy: string): EmailMessage {
  return {
    subject: "Laptops HUB test notification",
    text: [
      "This is a test message from Laptops HUB admin › Settings › Notifications.",
      `Requested by: ${sentBy}`,
      "",
      "If you received it, order and inquiry alerts can reach this inbox. No customer was emailed.",
    ].join("\n"),
  };
}
