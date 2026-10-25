import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { isCrossSite } from "@/lib/validation/contact";
import { isFreshRecoverySession, newPasswordProblem } from "@/lib/auth/recovery";

/**
 * Set a new password from a fresh recovery session (see src/lib/auth/recovery.ts), then end every session of the
 * user so the old password and any other device are logged out. Changes nothing but the password: same UID, and
 * admin_memberships (role, active state) are not touched.
 */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (isCrossSite(request.headers.get("origin"), request.url, request.headers.get("x-forwarded-host") || request.headers.get("host"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  // getUser() verified the user with the Auth server; the session token is only read for its sign-in methods.
  if (!user || !session || session.user.id !== user.id || !isFreshRecoverySession(session.access_token)) {
    return NextResponse.json(
      { error: "recovery_required", message: "This reset link has expired. Request a new one." },
      { status: 401, headers },
    );
  }

  const limited = await rateLimit(`password:${user.id}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited", message: "Too many attempts. Please try again later." }, { status: 429, headers });
  }

  const body = (await request.json().catch(() => null)) as { password?: unknown; confirm?: unknown } | null;
  const problem = newPasswordProblem(body?.password, body?.confirm, user.email);
  if (problem) return NextResponse.json({ error: "validation_failed", message: problem }, { status: 400, headers });

  const { error } = await supabase.auth.updateUser({ password: body!.password as string });
  if (error) {
    const message = /same|different from the old/i.test(error.message)
      ? "Choose a password you have not used for this account."
      : /weak|pwned|leaked/i.test(error.message)
        ? "This password is too weak or has appeared in a data breach. Choose another."
        : "The password could not be changed. Request a new link and try again.";
    return NextResponse.json({ error: "update_failed", message }, { status: 400, headers });
  }

  // Audit only when merchant side-effects are allowed (never Preview→Production).
  const { canPersistMerchantSideEffects } = await import("@/lib/security/merchant-write-guard");
  if (canPersistMerchantSideEffects()) {
    await createServiceClient()
      .from("audit_logs")
      .insert({
        actor_user_id: user.id,
        action: "auth.password_reset",
        entity_type: "auth_user",
        entity_id: user.id,
        after: { via: "recovery_email" },
      });
  }
  await supabase.auth.signOut({ scope: "global" });
  return NextResponse.json({ ok: true }, { headers });
}
