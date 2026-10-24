import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { isCrossSite } from "@/lib/validation/contact";
import { siteUrl } from "@/lib/site-url";
import { RECOVERY_CONFIRM_PATH, recoveryEmail } from "@/lib/auth/recovery";

// Same answer whether or not the address belongs to a staff account (no account discovery).
const GENERIC = {
  ok: true,
  message: "If this email belongs to a staff account, a password reset link is on its way. It is valid for one hour.",
};

/** Staff: request a password-recovery email. */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
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
    return NextResponse.json(
      { error: "rate_limited", message: "Too many reset requests. Please try again later." },
      { status: 429, headers: { ...headers, "Retry-After": String(retry) } },
    );
  }

  // Anon server client: the PKCE verifier (for links using the default email template) is stored in this browser's
  // cookies. The redirect is fixed to this site's confirm path — never taken from the request.
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl()}${RECOVERY_CONFIRM_PATH}` });
  if (error) console.warn("password recovery request failed", error.status ?? "", error.code ?? "");
  return NextResponse.json(GENERIC, { headers });
}
