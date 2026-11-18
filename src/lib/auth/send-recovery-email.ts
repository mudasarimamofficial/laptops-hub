import { createServiceClient } from "@/lib/supabase/server";
import { emailConfigured, sendEmail } from "@/lib/notify/send-email";
import { RECOVERY_CONFIRM_PATH } from "@/lib/auth/recovery";
import { siteUrl } from "@/lib/site-url";

export type RecoveryDispatch =
  | { ok: true; via: "resend" | "supabase_mailer" }
  | { ok: false; throttled: boolean; detail: string };

/**
 * Prefer Resend-delivered recovery (Auth Admin generateLink) when Resend is configured.
 * Falls back to Supabase Auth's built-in resetPasswordForEmail mailer.
 * Never throws; callers always return a generic client response.
 */
export async function dispatchStaffRecoveryEmail(
  email: string,
  resetPasswordForEmail: (email: string, opts: { redirectTo: string }) => Promise<{ error: { status?: number; code?: string; message?: string } | null }>,
): Promise<RecoveryDispatch> {
  const redirectTo = `${siteUrl()}${RECOVERY_CONFIRM_PATH}`;

  if (emailConfigured()) {
    try {
      const admin = createServiceClient();
      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      if (error) {
        const throttled = /rate.?limit|over_email_send/i.test(`${error.status ?? ""} ${error.code ?? ""} ${error.message ?? ""}`);
        return { ok: false, throttled, detail: error.code || error.message || "generate_link_failed" };
      }
      const tokenHash = data.properties?.hashed_token;
      if (!tokenHash) {
        return { ok: false, throttled: false, detail: "missing_token" };
      }
      // Build our confirm URL ourselves — never log or return the token.
      const confirmUrl = `${siteUrl()}${RECOVERY_CONFIRM_PATH}?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
      const sent = await sendEmail({
        to: email,
        subject: "Reset your Laptops HUB admin password",
        text: [
          "Use this link to set a new password for your Laptops HUB admin account.",
          "The link expires in about one hour. If you did not request this, you can ignore this email.",
          "",
          confirmUrl,
          "",
          "Your role and access stay the same. After saving a new password, every device is signed out.",
        ].join("\n"),
        idempotencyKey: `auth-recovery-${email}-${Math.floor(Date.now() / (15 * 60 * 1000))}`,
      });
      if (!sent.ok) {
        const throttled = /429|rate/i.test(sent.error);
        return { ok: false, throttled, detail: sent.error };
      }
      return { ok: true, via: "resend" };
    } catch (e) {
      return { ok: false, throttled: false, detail: e instanceof Error ? e.message : "recovery_dispatch_failed" };
    }
  }

  const { error } = await resetPasswordForEmail(email, { redirectTo });
  if (error) {
    const throttled = /rate.?limit|over_email_send/i.test(`${error.status ?? ""} ${error.code ?? ""} ${error.message ?? ""}`);
    return { ok: false, throttled, detail: error.code || error.message || "supabase_mailer_failed" };
  }
  return { ok: true, via: "supabase_mailer" };
}
