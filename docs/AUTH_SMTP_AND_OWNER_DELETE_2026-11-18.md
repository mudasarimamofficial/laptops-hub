# Auth SMTP + owner DELETE investigation — 2026-11-18

## Auth email rate limit (`over_email_send_rate_limit`)

Supabase Auth was using the **built-in** mailer (not Resend). Built-in Auth SMTP is rate-limited (team-only recipients + low hourly caps). Application `RESEND_API_KEY` does **not** configure Auth email.

**Code fix (this release):** `POST /api/admin/account/recover` prefers Auth Admin `generateLink({ type: "recovery" })` and delivers the confirm URL through the existing Resend sender (`STORE_FROM_EMAIL` on `send.laptopshub.pk`). That bypasses the built-in Auth mailer when Resend is configured.

**Platform fix (operator):** Authentication → Email → SMTP Settings:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` (SSL) |
| Username | `resend` |
| Password | Resend API key (same sending key family as production `RESEND_API_KEY`) |
| Sender | `orders@send.laptopshub.pk` / name `Laptops HUB` |

**Status 2026-11-18 evening:** Custom SMTP toggle was enabled in the Supabase dashboard and non-secret fields were filled (`smtp.resend.com:465`, user `resend`, sender above). Production `RESEND_API_KEY` cannot be decrypted via Vercel MCP/`env pull` (secret vault), so **Save** still needs the operator to paste the production Resend API key once and save. App recovery already bypasses built-in Auth mailer via `generateLink` + Resend REST — production `POST /api/admin/account/recover` returned `ok: true` for the owner mailbox after `#40` shipped.

Keep rate limits enabled; raise Auth email rate modestly after custom SMTP is on (do not disable globally).

## Change password

Admin → Settings → Security (`#security`) lets a signed-in staff member change password with current-password verification. No recovery email required.

## Owner Auth DELETE attempt (~2026-11-18 14:38 UTC)

Auth Admin DELETE on owner UUID `cc603db4-…` failed with a foreign-key constraint (memberships / related rows). Application `audit_logs` has **no** successful delete. This matches migration tooling that briefly probed removing/recreating Auth users during the permanent-email cutover — **not** a completed deletion. Owner account remains active with `infolaptopshub@gmail.com`. Do not retry DELETE.
