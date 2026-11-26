import { z } from "zod";

/**
 * G24 — merchant notification settings (`store_settings` key `notifications`; staff-only, not in the public read
 * policy). The email provider itself (RESEND_API_KEY, STORE_FROM_EMAIL) stays in the hosting environment and is never
 * editable or readable from the admin.
 *
 * Without a stored row the previous environment behaviour applies unchanged: STORE_NOTIFY_EMAIL receives order
 * alerts and NOTIFY_CUSTOMER_EMAIL=1 turns on customer confirmations.
 */
export const NOTIFICATIONS_KEY = "notifications";
export const MAX_RECIPIENTS = 5;
export const SUBJECT_MAX = 150;
export const INTRO_MAX = 600;

/** off = customers get no email; test = the customer copy goes to the staff recipients only; on = customers get it. */
export const CUSTOMER_MODES = ["off", "test", "on"] as const;
export type CustomerMode = (typeof CUSTOMER_MODES)[number];

export type NotificationSettings = {
  recipients: string[];
  customerMode: CustomerMode;
  inquiryAlerts: boolean;
  /** "" = built-in wording. Subjects accept {order} and {total}. */
  orderSubject: string;
  customerSubject: string;
  customerIntro: string;
  /** Where the recipients came from: the saved settings, or the hosting environment fallback. */
  source: "settings" | "env";
};

const emailRe = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

/** One line of plain text: no control characters or line breaks (mail headers). */
export function cleanLine(v: string, max: number) {
  return v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
/** Plain paragraph text: keeps line breaks, drops other control characters. */
export function cleanParagraph(v: string, max: number) {
  return v
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export function normaliseRecipients(list: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    const e = raw.trim().toLowerCase();
    if (e && emailRe.test(e) && !out.includes(e)) out.push(e);
  }
  return out.slice(0, MAX_RECIPIENTS);
}

export const notificationSettingsSchema = z.object({
  recipients: z
    .array(z.string().trim().max(160))
    .max(MAX_RECIPIENTS)
    .refine((l) => l.every((e) => e === "" || emailRe.test(e.trim().toLowerCase())), "invalid_email"),
  customerMode: z.enum(CUSTOMER_MODES),
  inquiryAlerts: z.boolean(),
  orderSubject: z.string().max(SUBJECT_MAX * 2),
  customerSubject: z.string().max(SUBJECT_MAX * 2),
  customerIntro: z.string().max(INTRO_MAX * 2),
});
export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;

/** Stored shape (what the PUT route writes). */
export function toStored(d: NotificationSettingsInput) {
  return {
    recipients: normaliseRecipients(d.recipients),
    customer_mode: d.customerMode,
    inquiry_alerts: d.inquiryAlerts,
    order_subject: cleanLine(d.orderSubject, SUBJECT_MAX),
    customer_subject: cleanLine(d.customerSubject, SUBJECT_MAX),
    customer_intro: cleanParagraph(d.customerIntro, INTRO_MAX),
  };
}

type Env = { STORE_NOTIFY_EMAIL?: string; NOTIFY_CUSTOMER_EMAIL?: string; [k: string]: string | undefined };

/** Effective settings from the stored value (or null) with the environment fallback. */
export function parseNotificationSettings(value: unknown, env: Env = process.env): NotificationSettings {
  const envRecipients = normaliseRecipients((env.STORE_NOTIFY_EMAIL || "").split(","));
  const v = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  if (!v) {
    return {
      recipients: envRecipients,
      customerMode: env.NOTIFY_CUSTOMER_EMAIL === "1" ? "on" : "off",
      inquiryAlerts: false,
      orderSubject: "",
      customerSubject: "",
      customerIntro: "",
      source: "env",
    };
  }
  const stored = normaliseRecipients(Array.isArray(v.recipients) ? v.recipients.filter((x): x is string => typeof x === "string") : []);
  const mode = CUSTOMER_MODES.includes(v.customer_mode as CustomerMode) ? (v.customer_mode as CustomerMode) : "off";
  const str = (x: unknown) => (typeof x === "string" ? x : "");
  return {
    // An empty saved list keeps using the hosting fallback, so alerts are never silenced by accident.
    recipients: stored.length ? stored : envRecipients,
    customerMode: mode,
    inquiryAlerts: v.inquiry_alerts === true,
    orderSubject: cleanLine(str(v.order_subject), SUBJECT_MAX),
    customerSubject: cleanLine(str(v.customer_subject), SUBJECT_MAX),
    customerIntro: cleanParagraph(str(v.customer_intro), INTRO_MAX),
    source: stored.length ? "settings" : "env",
  };
}

/** Replace {order} / {total} in a merchant subject; "" when no custom subject is set. */
export function fillSubject(template: string, vars: { order: string; total?: string }) {
  if (!template) return "";
  return cleanLine(template.replace(/\{order\}/g, vars.order).replace(/\{total\}/g, vars.total ?? ""), SUBJECT_MAX);
}

/** Short, stable fingerprint (FNV-1a) used to version provider idempotency keys when merchant settings change. */
export function fingerprint(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** "a***@example.com" — for showing the hosting fallback address without exposing it in full. */
export function maskEmail(e: string) {
  const [user, domain] = e.split("@");
  if (!domain) return "";
  return `${user.slice(0, 1)}***@${domain}`;
}
