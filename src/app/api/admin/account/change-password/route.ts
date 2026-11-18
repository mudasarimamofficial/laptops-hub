import { NextResponse } from "next/server";
import { publicWriteBlockedResponse } from "@/lib/security/public-write-guard";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { isCrossSite } from "@/lib/validation/contact";
import { MIN_PASSWORD_LENGTH, newPasswordProblem } from "@/lib/auth/recovery";

/**
 * Logged-in staff: change password with current-password verification.
 * Does not use recovery email. Same Auth UID; memberships unchanged.
 * Does not globally revoke other sessions (unlike recovery reset) so the active admin session continues.
 */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const blocked = publicWriteBlockedResponse();
  if (blocked) return blocked;
  if (isCrossSite(request.headers.get("origin"), request.url, request.headers.get("x-forwarded-host") || request.headers.get("host"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in again to change your password." }, { status: 401, headers });
  }

  const limited = await rateLimit(`change-password:${user.id}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many attempts. Please try again later." },
      { status: 429, headers: { ...headers, "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    currentPassword?: unknown;
    password?: unknown;
    confirm?: unknown;
  } | null;

  const current = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  if (!current || current.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: "validation_failed", message: "Enter your current password." },
      { status: 400, headers },
    );
  }

  const problem = newPasswordProblem(body?.password, body?.confirm, user.email);
  if (problem) return NextResponse.json({ error: "validation_failed", message: problem }, { status: 400, headers });

  if (current === body!.password) {
    return NextResponse.json(
      { error: "validation_failed", message: "Choose a password that is different from your current one." },
      { status: 400, headers },
    );
  }

  // Separate anon client so verification does not rewrite the logged-in session cookies.
  const { createClient: createBareClient } = await import("@supabase/supabase-js");
  const verifier = createBareClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: verifyError } = await verifier.auth.signInWithPassword({ email: user.email, password: current });
  if (verifyError) {
    return NextResponse.json(
      { error: "invalid_current", message: "Current password is incorrect." },
      { status: 400, headers },
    );
  }

  const { error } = await supabase.auth.updateUser({ password: body!.password as string });
  if (error) {
    const message = /same|different from the old/i.test(error.message)
      ? "Choose a password you have not used for this account."
      : /weak|pwned|leaked/i.test(error.message)
        ? "This password is too weak or has appeared in a data breach. Choose another."
        : "The password could not be changed. Try again, or use password recovery.";
    return NextResponse.json({ error: "update_failed", message }, { status: 400, headers });
  }

  const { canPersistMerchantSideEffects } = await import("@/lib/security/merchant-write-guard");
  if (canPersistMerchantSideEffects()) {
    await createServiceClient()
      .from("audit_logs")
      .insert({
        actor_user_id: user.id,
        action: "auth.password_change",
        entity_type: "auth_user",
        entity_id: user.id,
        after: { via: "settings_security" },
      });
  }

  return NextResponse.json({ ok: true, message: "Password updated." }, { headers });
}
