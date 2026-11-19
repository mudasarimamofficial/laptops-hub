# Resend / Supabase SMTP / PR acceptance — 2026-11-19

## Resend account verification

| Check | Result |
|---|---|
| Correct workspace found | **YES** — `infolaptopshub` |
| Correct account confirmed | **YES** — owner Chrome profile `infolaptopshub` |
| `send.laptopshub.pk` present | **YES** |
| Domain verification | **VERIFIED** |
| Account/workspace mismatch confirmed | **YES** — prior Cursor session used a Resend workspace with empty Domains; SMTP key was created there → Auth `550 The send.laptopshub.pk domain is not verified` |

Credential rotation: created sending-only key `laptops-hub-supabase-auth-smtp-v2` in the **verified** workspace; applied to Supabase Auth SMTP via Management API (secret not logged). Production Vercel `RESEND_API_KEY` / order-notification credential left intact (same correct workspace).

Legacy incorrect-workspace key `laptops-hub-supabase-auth-smtp`: **PENDING** revoke (do not revoke production order-notification key).

## Supabase SMTP

| Check | Result |
|---|---|
| SMTP saved | **PASS** — host `smtp.resend.com`, port `465`, user `resend`, sender `auth@send.laptopshub.pk`, name `Laptops HUB` |
| Correct Resend team | **PASS** — verified `infolaptopshub` workspace |
| Recovery request | **PASS** — `POST /recover` `2026-11-19T04:10:12Z` HTTP **200**, `user_recovery_requested` (prior fail `02:11:57Z` HTTP 500 / 550) |
| Provider (Resend) | **PASS** — Delivered, FROM `auth@send.laptopshub.pk` |
| Inbox delivery | **PASS** — Gmail `infolaptopshub@gmail.com` received 09:10 PKT “Reset your password” |
| Reset link → production | **PASS** — verify → `laptopshub.pk` / `www.laptopshub.pk` with `type=recovery` |
| Password form via native hash | **PARTIAL** — tokens landed on Site URL hash; reset form needs cookies. Hash→session bridge shipped after this observation. Prior link’s 15‑minute recovery window elapsed before form use. |
| Owner password change / re-login / role+UUID | **OWNER VERIFICATION REQUIRED** — owner UUID `cc603db4-d291-4dc1-a401-b04ffbeff86c` confirmed in Auth log; password entry is private. Prefer fresh link via `/admin/forgot-password` (app confirm path) or one new native recover **after** hash-bridge deploy. |

## Application operations

| Channel | Result |
|---|---|
| Order notifications | **PASS** — same verified Resend workspace; history shows merchant/order sends |
| Staff invitations | **PASS** — same workspace |
| Application recovery (`generateLink` + Resend) | **PASS** — independent of Auth SMTP; uses verified domain |
| Owner recipient | **PASS** — `infolaptopshub@gmail.com` (not reverted) |

QA COD order `LH-261118-77C0F6`: **untouched**.

## PR #43

| Item | Value |
|---|---|
| Status | **MERGED** |
| Merge commit | `008565e77fc5ed2a1999e9f5951d2ad3663ec6b4` |
| Production deploy | `dpl_HR9UtZannsKHtDyX43Q218iQzsWQ` **READY** |
| Aliases | `www.laptopshub.pk`, `laptopshub.pk` |

## PR #44 (blog E2E + viewport honesty)

| Item | Value |
|---|---|
| Status | **MERGED** |
| Merge commit | `3483603197292f20db64b008df03bcfa9d696591` |
| CI quality | **PASS** |
| Production deploy | follow `dpl_CMBFHte8XXf7xQXzQXuVZa3ueyoH` (building at report draft time) |

## Product QA

| Area | Label |
|---|---|
| Reels / shoppable E2E (PR #43) | **PASS** (CI + preview) |
| Blog create E2E (Visibility / Create post) | **PASS** on isolated after selector update (PR #44) |
| Viewport JSON (80 checks) | **PARTIAL** — smoke only; see `docs/VIEWPORT_QA_HONESTY_NOTE_2026-11-19.md` |
| Checkout `hasH1: false` | **PARTIAL** — empty-cart path lacks `h1`; cart path has `h1` |
| Interactive/a11y/admin matrix expansion | **NOT TESTED** (beyond honesty note scope) |
| Client readiness claim | **Do not claim complete** while owner password-change remains OWNER VERIFICATION REQUIRED |

## Root cause (SMTP 550)

Wrong Resend **workspace** (empty Domains), not missing DNS on the real business account. Fix = key from workspace that owns verified `send.laptopshub.pk`.
