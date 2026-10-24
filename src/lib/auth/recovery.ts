/**
 * Staff password recovery (Supabase Auth). Pure helpers — the routes are:
 *   POST /api/admin/account/recover   request a recovery email (generic answer, rate-limited)
 *   GET  /admin/auth/confirm          verify the email link (token_hash or PKCE code) → recovery session
 *   GET  /admin/reset-password        new-password form (only with a fresh recovery session)
 *   POST /api/admin/account/password  set the password, then sign out every session
 * Recovery only proves control of the mailbox and changes the password of that same Auth user (same UID). It never
 * reads or writes admin_memberships: role and active state are unchanged, and a deactivated member stays forbidden.
 */

export const RECOVERY_WINDOW_SECONDS = 15 * 60;
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

/** Auth methods that prove control of the mailbox (recovery link, email OTP). A password sign-in is not one. */
const RECOVERY_METHODS = new Set(["recovery", "otp"]);

type Amr = { method?: string; timestamp?: number };

function jwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * True when the access token's authentication methods include a recovery/OTP sign-in from the last
 * RECOVERY_WINDOW_SECONDS. Call only with a token whose user was verified by `auth.getUser()`.
 */
export function isFreshRecoverySession(accessToken: string | undefined, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!accessToken) return false;
  const amr = jwtPayload(accessToken)?.amr;
  if (!Array.isArray(amr)) return false;
  return (amr as Amr[]).some(
    (a) => !!a?.method && RECOVERY_METHODS.has(a.method) && typeof a.timestamp === "number" && nowSeconds - a.timestamp <= RECOVERY_WINDOW_SECONDS,
  );
}

/** Returns a user-facing problem, or null when the new password is acceptable. */
export function newPasswordProblem(password: unknown, confirm: unknown, email?: string | null): string | null {
  if (typeof password !== "string" || typeof confirm !== "string") return "Enter the new password twice.";
  if (password !== confirm) return "The two passwords do not match.";
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  if (!/\S/.test(password) || password.trim() !== password) return "The password cannot start or end with a space.";
  if (email && password.toLowerCase().includes(email.split("@")[0].toLowerCase()) && email.split("@")[0].length >= 4) {
    return "Do not use your email name in the password.";
  }
  if (new Set(password).size < 6) return "Use a less repetitive password.";
  return null;
}

/** Normalised email, or null when it is not a plausible address (the answer to the client is generic anyway). */
export function recoveryEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/** The link in the email must come back to this exact path; no caller-supplied redirect is honoured. */
export const RECOVERY_CONFIRM_PATH = "/admin/auth/confirm";
export const RESET_PASSWORD_PATH = "/admin/reset-password";
