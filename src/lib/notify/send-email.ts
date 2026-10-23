/**
 * Email delivery through Resend's REST API (https://resend.com/docs/api-reference/emails/send-email).
 * Owner-owned account required: RESEND_API_KEY and a verified sender STORE_FROM_EMAIL. Without them nothing is sent
 * and nothing is reported as sent. RESEND_API_URL exists only for local tests against a fake endpoint.
 */
export type SendResult = { ok: true; id: string } | { ok: false; error: string; retryable: boolean };

export function emailConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.STORE_FROM_EMAIL);
}

/** Provider errors can echo addresses; keep logs free of personal data and short. */
export function safeError(message: string) {
  return message.replace(/[^\s@<>"]+@[^\s@<>"]+/g, "<email>").slice(0, 200);
}

export async function sendEmail(msg: { to: string; subject: string; text: string; idempotencyKey: string }): Promise<SendResult> {
  if (!emailConfigured()) return { ok: false, error: "not_configured", retryable: true };
  const base = (process.env.RESEND_API_URL || "https://api.resend.com").replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        // Provider-side de-duplication: a retry of the same message is not delivered twice.
        "Idempotency-Key": msg.idempotencyKey,
      },
      body: JSON.stringify({ from: process.env.STORE_FROM_EMAIL, to: [msg.to], subject: msg.subject, text: msg.text }),
      signal: AbortSignal.timeout(Number(process.env.NOTIFY_TIMEOUT_MS) || 15_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (res.ok && body.id) return { ok: true, id: body.id };
    // 409: the same idempotency key is still being processed by the provider — retry later with the same key.
    return { ok: false, error: safeError(`${res.status} ${body.name || ""} ${body.message || ""}`.trim()), retryable: res.status === 409 || res.status === 429 || res.status >= 500 };
  } catch (e) {
    return { ok: false, error: safeError(e instanceof Error ? e.message : "network_error"), retryable: true };
  }
}
