# Owner email migration — 2026-11-18

## Authoritative identity

| Field | Value |
|---|---|
| Permanent owner email | `infolaptopshub@gmail.com` |
| Legacy owner email (retired login) | `laptopshubofficial@gmail.com` |
| Auth user UUID (preserved) | `cc603db4-d291-4dc1-a401-b04ffbeff86c` |
| Membership | `admin_memberships.role = owner`, `is_active = true` |

## What changed

1. **Supabase Auth** — existing owner user email updated via Auth Admin API (`updateUserById`). Same UUID. Legacy address no longer attached to any Auth user.
2. **Vercel Production** — `STORE_NOTIFY_EMAIL` set to `infolaptopshub@gmail.com` (recipient). Sender remains `orders@send.laptopshub.pk` via `STORE_FROM_EMAIL`.
3. **Code** — `src/lib/auth/owner-identity.ts` documents the permanent owner address for tests and future checks. The retired mailbox is not kept as an active code constant.

## What was not rewritten

- Git history and past audit report narratives that name the legacy address as a historical session.
- Immutable audit_logs rows.
- Past certification reports (historical evidence).

## Rollback

1. Auth Admin: `updateUserById(cc603db4-…, { email: "laptopshubofficial@gmail.com", email_confirm: true })` after confirming mailbox control of the legacy inbox.
2. Vercel: restore Production `STORE_NOTIFY_EMAIL` to the previous recipient and redeploy.
3. Force a fresh login; revoke global sessions if needed.

## Operator note

Password is unchanged on the Auth user. Sign in with the **new** email and the existing password, or use password recovery to the new mailbox. Existing browser sessions may still show the previous email until a full sign-out / fresh login.
