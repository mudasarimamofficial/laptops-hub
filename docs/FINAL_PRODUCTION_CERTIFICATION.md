# Final production certification — 2026-11-18

Honest operational certification for Laptops HUB after cloud hardening + authenticated admin smoke.

## Labels used

PASS · FAIL · BLOCKED · NOT TESTED · NOT APPLICABLE

## Release identity

| Item | Value | Verdict |
|---|---|---|
| GitHub `main` SHA (at certification write) | `db7d26393164b8d64b5e706b3cc56811bbd7f4e2` | PASS |
| App hardening baseline | `06b5ff3` via PR [#18](https://github.com/mudasarimamofficial/laptops-hub/pull/18) | PASS |
| Mandate baseline (stale) | `3a00091` / `dpl_2daEN1…` — superseded | NOT APPLICABLE |
| CI | `quality` success on main (`44236602968` and prior) | PASS |
| Vercel production | `dpl_EncXa4CfSW6bHEAPdWo5PYwd1cKb` READY @ `db7d263` | PASS |
| Aliases | `www.laptopshub.pk`, `laptopshub.pk` → www | PASS |
| Supabase | `xvmmjkrkgznnakcobmww` ACTIVE_HEALTHY; **31** migrations aligned | PASS |
| CRM `app.laptopshub.pk` | Untouched | PASS |

## Commerce readiness

| Gate | Verdict |
|---|---|
| Live COD (env + store_settings + admin readiness) | PASS — Ordering open |
| Shipping All Over PK Rs 360 + COD Rs 50 | PASS (DB + Settings UI + quote API + checkout) |
| Policies / catalog | PASS (8 pages, 226 active) |
| Isolated COD matrix | PASS (23/23) |
| Unit tests | PASS |
| Authenticated merchant Overview / Settings / Products SKU / Orders / Staff | PASS (read smoke) |
| Controlled live QA order | BLOCKED — no owner-controlled QA identity |
| Email / invites / GH notification-retry secret | BLOCKED — Resend + GH `CRON_SECRET` |
| Cron unauthorized gate | PASS (401) |

## Security

| Item | Verdict |
|---|---|
| Service role not public; Preview COD/mutations isolated | PASS |
| Protect main: deletion, non-fast-forward, required `quality` | PASS |
| Leaked-password protection | BLOCKED — not enabled (lockout risk without owner confirm) |
| SECURITY DEFINER storefront RPCs | PASS (intentional) |

## Client staff

| Item | Verdict |
|---|---|
| Active owner account | PASS |
| Additional client invite | BLOCKED — Resend required for invite delivery |

## Rollback

1. Promote prior READY production (e.g. `dpl_8sSU9AF…` @ `06b5ff3` or `dpl_2daEN1…` @ `3a00091`).
2. Revert `main` with admin bypass if needed.
3. Env restore by key; never paste secrets into chat.
4. CRM: no action.

## Remaining external dependencies

1. Resend + verified sender → `RESEND_API_KEY`, `STORE_FROM_EMAIL`, `STORE_NOTIFY_EMAIL` → redeploy → GH `CRON_SECRET` matching Vercel.
2. Owner-controlled QA COD identity for one labeled live order + cancel.
3. Optional leaked-password protection.
4. Licensed reel media.

## Overall

**Storefront + COD quoting + cloud gates + authenticated admin smoke: PASS.**  
**Email loop, live QA order, client invite: BLOCKED.**  
Do not treat BLOCKED / NOT TESTED as PASS.
