# Auth SMTP + owner DELETE investigation — 2026-11-18

## Auth email rate limit (`over_email_send_rate_limit`)

Supabase Auth was using the **built-in** mailer (not Resend). Built-in Auth SMTP is rate-limited (team-only recipients + low hourly caps). Application `RESEND_API_KEY` does **not** configure Auth email.

**Code fix (this release):** `POST /api/admin/account/recover` prefers Auth Admin `generateLink({ type: "recovery" })` and delivers the confirm URL through the existing Resend sender (`STORE_FROM_EMAIL` on `send.laptopshub.pk`). That bypasses the built-in Auth mailer when Resend is configured.

**Platform fix (completed 2026-11-18):** Authentication → Email → SMTP Settings saved via Management API:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` (SSL) |
| Username | `resend` |
| Password | Dedicated Resend API key `laptops-hub-supabase-auth-smtp` (sending_access; **not** the Vercel order-notification key) |
| Sender email | `auth@send.laptopshub.pk` |
| Sender name | `Laptops HUB` |
| `rate_limit_email_sent` | `30` / hour (raised after custom SMTP enabled) |

Do not print or commit the SMTP password. App recovery via `generateLink` + Resend REST remains the primary staff recovery path; native Auth SMTP is now configured for built-in Auth mailer flows.

## Change password

Admin → Settings → Security (`#security`) lets a signed-in staff member change password with current-password verification. No recovery email required.

## Owner Auth DELETE attempt (~2026-11-18 14:38 UTC)

Auth Admin DELETE on owner UUID `cc603db4-…` failed with a foreign-key constraint (memberships / related rows). Application `audit_logs` has **no** successful delete. This matches migration tooling that briefly probed removing/recreating Auth users during the permanent-email cutover — **not** a completed deletion. Owner account remains active with `infolaptopshub@gmail.com`. Do not retry DELETE.
