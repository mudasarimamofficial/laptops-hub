import { createHash } from "crypto";
import { publicWriteBlockedResponse } from "@/lib/security/public-write-guard";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { isCrossSite } from "@/lib/validation/contact";
import { recoveryEmail } from "@/lib/auth/recovery";
import { dispatchStaffRecoveryEmail } from "@/lib/auth/send-recovery-email";

// Same answer whether or not the address belongs to a staff account (no account discovery),
// except when our own rate limiter or the email provider is clearly throttling — then we say so
// without revealing whether the address is registered.
const GENERIC = {
  ok: true,
  message: "If this email belongs to a staff account, a password reset link is on its way. It is valid for one hour.",
};

const THROTTLED = {
  error: "rate_limited" as const,
  message:
    "Too many reset emails were requested recently. Wait about an hour and try again, or sign in and change your password under Your account (at the bottom of the admin menu).",
};

/** Staff: request a password-recovery email. */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const blocked = publicWriteBlockedResponse();
  if (blocked) return blocked;
  if (isCrossSite(request.headers.get("origin"), request.url, request.headers.get("x-forwarded-host") || request.headers.get("host"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = recoveryEmail(body?.email);
  if (!email) return NextResponse.json({ error: "validation_failed", message: "Enter a valid email address." }, { status: 400, headers });

  const ip = clientIp(request);
  const byIp = await rateLimit(`recover:ip:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  const byEmail = await rateLimit(`recover:email:${createHash("sha256").update(email).digest("hex").slice(0, 32)}`, { limit: 3, windowMs: 60 * 60 * 1000 });
  if (!byIp.ok || !byEmail.ok) {
    const retry = Math.max(byIp.ok ? 0 : byIp.retryAfterSec, byEmail.ok ? 0 : byEmail.retryAfterSec);
    return NextResponse.json(THROTTLED, { status: 429, headers: { ...headers, "Retry-After": String(retry) } });
  }

  const supabase = await createClient();
  const result = await dispatchStaffRecoveryEmail(email, (addr, opts) => supabase.auth.resetPasswordForEmail(addr, opts));
  if (!result.ok) {
    console.warn("password recovery request failed", result.throttled ? "throttled" : "error", result.detail.slice(0, 80));
    if (result.throttled) {
      return NextResponse.json(THROTTLED, { status: 429, headers: { ...headers, "Retry-After": "3600" } });
    }
  }
  return NextResponse.json(GENERIC, { headers });
}
