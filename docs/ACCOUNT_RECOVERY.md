# Staff password recovery

Code: `src/lib/auth/recovery.ts` (rules), `src/app/api/admin/account/recover` (request), `src/app/admin/auth/confirm`
(email link), `src/app/admin/reset-password` + `src/app/api/admin/account/password` (new password).
Tests: `tests/unit/recovery.test.ts`, `tests/e2e-isolated/password-recovery.spec.ts` (local Supabase + Mailpit).

## How it works

1. Staff → **Forgot password?** on `/admin/login` → email. The answer is the same for every address (no account
   discovery); 3 requests per address per hour and 5 per IP per 15 minutes.
2. Supabase Auth emails a link to `/admin/auth/confirm` (fixed path; no caller-supplied redirect).
3. The link opens `/admin/reset-password` only with a **fresh recovery session** (recovery/OTP sign-in in the last
   15 minutes). A normal password sign-in cannot use it. Used or expired links go back to the request page.
4. New password: 12–128 characters, typed twice, not the email name, not trivially repetitive.
5. On success: the same Auth user (same UID) gets the new password, an `audit_logs` entry `auth.password_reset` is
   written, and **every session of that user is ended** (other devices too). The user signs in again.
6. `admin_memberships` is never read or written by recovery: role and active state are unchanged, and a deactivated
   or non-staff user is still refused by `/admin` after resetting.

## Production settings required (Supabase dashboard → Authentication)

| Setting | Value | Why |
|---|---|---|
| **SMTP** (Emails → SMTP Settings) | Custom SMTP, e.g. Resend: host `smtp.resend.com`, port `465`, user `resend`, password = a Resend API key, sender = the verified sender address | Supabase's built-in email service only delivers to the project's team members and a few emails per hour — staff would not receive reset emails |
| URL Configuration → Site URL | `https://laptops-hub.vercel.app` (custom domain later) | links in emails |
| URL Configuration → Redirect URLs | `https://laptops-hub.vercel.app/admin/auth/confirm` | the only page recovery links may return to |
| Emails → Templates → **Reset password** (recommended) | link `{{ .SiteURL }}/admin/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` | works when the email is opened on another device; the default template's link works only in the browser that requested it |
| Sign In / Providers → allow new users to sign up | **Off** | no self-registration |

With the default template the flow still works when the email is opened in the same browser.

## Verification after deployment (no staff account is created by engineering)

1. `/admin/login` shows **Forgot password?**; `/admin/forgot-password` returns the generic message for any address.
2. The owner requests a reset for their own account, opens the email, sets a new password, signs in again; the
   overview still shows **role owner**.
3. Read-only: `audit_logs` has one `auth.password_reset` row for the owner; `admin_memberships` unchanged.
