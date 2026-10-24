import { z } from "zod";

const PHONE_RE = /^\+?[0-9][0-9\s-]{9,14}$/;

/** Homepage inquiry options (labels are stored as written). WhatsApp is offered only once a business line is verified. */
export const INQUIRY_TOPICS = ["Laptop recommendation", "Specific model inquiry", "Order question", "General inquiry"] as const;
export const INQUIRY_BUDGETS = ["Under Rs 40,000", "Rs 40,000 – 60,000", "Rs 60,000 – 100,000", "Over Rs 100,000"] as const;
export const INQUIRY_CONTACT = ["call", "email"] as const;

export const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: z
      .string()
      .trim()
      .max(30)
      .refine((v) => v === "" || PHONE_RE.test(v), "invalid_phone")
      .optional(),
    email: z.string().trim().email().max(254).optional().or(z.literal("")),
    subject: z.string().trim().max(160).optional().default(""),
    message: z.string().trim().min(5).max(4000),
    /** Which form sent it. Only the homepage form sets "home"; its subject is then built here, not by the client. */
    source: z.enum(["contact", "home"]).optional().default("contact"),
    topic: z.enum(INQUIRY_TOPICS).optional(),
    budget: z.enum(INQUIRY_BUDGETS).optional(),
    useCase: z.string().trim().max(120).optional().or(z.literal("")),
    preferred: z.enum(INQUIRY_CONTACT).optional(),
    /** Honeypot — bots fill this; humans leave empty */
    company: z.string().optional(),
  })
  // A reply needs at least one way to reach the sender, and the preferred way must be one they gave.
  .refine((d) => !!(d.email || d.phone), "contact_required")
  .refine((d) => d.preferred !== "call" || !!d.phone, "preferred_call_needs_phone")
  .refine((d) => d.preferred !== "email" || !!d.email, "preferred_email_needs_email");

export type ContactRow = { name: string; phone: string | null; email: string | null; subject: string; message: string };

export type ContactDeps = {
  rateLimit: (key: string) => Promise<{ ok: true } | { ok: false; retryAfterSec: number }>;
  /** Persists the inquiry; resolves with an error message when the insert failed. */
  insert: (row: ContactRow) => Promise<{ error: string | null }>;
};

export type ContactResult = { status: number; body: Record<string, unknown>; headers?: Record<string, string> };

/**
 * Browsers always send Origin on cross-site POSTs; reject those that are not this site. "This site" is the host the
 * request was addressed to (X-Forwarded-Host / Host) or the host in `request.url` — servers can build the URL from a
 * different name for the same host (e.g. `localhost` for a server bound to 127.0.0.1).
 */
export function isCrossSite(origin: string | null, requestUrl: string, requestHost?: string | null) {
  if (!origin) return false;
  try {
    const from = new URL(origin).host;
    const own = new Set([new URL(requestUrl).host]);
    for (const h of (requestHost || "").split(",")) if (h.trim()) own.add(h.trim().toLowerCase());
    return !own.has(from.toLowerCase());
  } catch {
    return true;
  }
}

/**
 * Contact / inquiry submission. `ok: true` is returned only after the insert succeeded — except for honeypot
 * fills, which are dropped without storing (bots get no signal).
 */
export async function processContact(input: { origin: string | null; url: string; host?: string | null; ip: string; body: unknown }, deps: ContactDeps): Promise<ContactResult> {
  if (isCrossSite(input.origin, input.url, input.host)) return { status: 403, body: { error: "forbidden_origin" } };
  const limited = await deps.rateLimit(`contact:${input.ip}`);
  if (!limited.ok) {
    return { status: 429, body: { error: "rate_limited", message: "Too many requests. Try again later." }, headers: { "Retry-After": String(limited.retryAfterSec) } };
  }
  const parsed = contactSchema.safeParse(input.body);
  if (!parsed.success) return { status: 400, body: { error: "validation_failed", message: "Invalid submission." } };
  if (parsed.data.company) return { status: 200, body: { ok: true } };
  const d = parsed.data;
  const home = d.source === "home";
  // Homepage inquiries: provenance and options are written by the server from validated values, so staff can tell
  // them apart in /admin/inquiries (subject) and see every answer (message), without a schema change.
  const details = home
    ? [
        d.budget ? `Budget: ${d.budget}` : null,
        d.useCase ? `Use: ${d.useCase}` : null,
        d.preferred ? `Preferred contact: ${d.preferred === "call" ? "phone call" : "email"}` : null,
      ].filter(Boolean)
    : [];
  const { error } = await deps.insert({
    name: d.name,
    phone: d.phone || null,
    email: d.email || null,
    subject: home ? `Homepage inquiry · ${d.topic ?? "General inquiry"}` : d.subject || "",
    message: details.length ? `${d.message}\n\n${details.join("\n")}` : d.message,
  });
  if (error) return { status: 500, body: { error: "submit_failed", message: "Could not save your message." } };
  return { status: 200, body: { ok: true } };
}
