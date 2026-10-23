import { z } from "zod";

const PHONE_RE = /^\+?[0-9][0-9\s-]{9,14}$/;

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
    /** Honeypot — bots fill this; humans leave empty */
    company: z.string().optional(),
  })
  // A reply needs at least one way to reach the sender.
  .refine((d) => !!(d.email || d.phone), "contact_required");

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
  const { error } = await deps.insert({
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    subject: parsed.data.subject || "",
    message: parsed.data.message,
  });
  if (error) return { status: 500, body: { error: "submit_failed", message: "Could not save your message." } };
  return { status: 200, body: { ok: true } };
}
