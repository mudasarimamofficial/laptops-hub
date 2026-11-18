# Final cloud configuration audit — 2026-11-18

Evidence-based inventory. No secret values. Mandate baseline `3a00091` / 30 migrations is **superseded**.

## Identity (verified now)

| Surface | Value | Verdict |
|---|---|---|
| GitHub | `mudasarimamofficial/laptops-hub` `main` | PASS |
| Production commit | `c0125853dcc4937d7993a35cc3f93584250200e5` | PASS |
| Vercel | `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` / `dpl_46n9waS5kkd5q7QQsP5s8yiQisJV` READY | PASS |
| Node / region | 24.x / `sin1` | PASS |
| Supabase | `xvmmjkrkgznnakcobmww` ap-southeast-1 ACTIVE_HEALTHY | PASS |
| Migrations | 31 local = 31 remote | PASS |
| CRM | `app.laptopshub.pk` untouched | PASS |

## GitHub

| Setting | After | Verdict |
|---|---|---|
| Ruleset Protect main | `deletion`, `non_fast_forward`, required status **`quality`**, admin bypass | PASS |
| CI workflow | `.github/workflows/ci.yml` — green on main | PASS |
| notification-retry | `NOTIFY_CRON_URL` → www; uses GH `CRON_SECRET` | PASS |
| Actions secret `CRON_SECRET` | Present (rotated with Vercel; value never printed) | PASS |
| Variable | `NOTIFY_CRON_URL=https://www.laptopshub.pk/api/cron/notifications` | PASS |
| Controlled workflow run | `44240955449` success · `configured=true` | PASS |

## Vercel

| Area | Finding | Verdict |
|---|---|---|
| Framework / build / regions | Next.js; `vercel.json`; `sin1` | PASS |
| Domains | www canonical; apex 308 → www; `app` / `www.app` A → Hostinger CRM | PASS |
| Cron | `/api/cron/notifications` `0 6 * * *`; unauth **401**; auth **200** `configured=true` | PASS |
| Env — email | `RESEND_API_KEY`, `STORE_FROM_EMAIL`, `STORE_NOTIFY_EMAIL` Production Secret | PASS |
| Env — cron | `CRON_SECRET` Production Secret (coordinated with GH) | PASS |
| Env — commerce | Prod COD true; Preview COD false + `MERCHANT_MUTATIONS_DISABLED=1` | PASS |
| DNS for Resend | TXT `resend._domainkey.send`; MX+TXT `send.send`; CNAME `rsend.send` | PASS |

## Resend

| Check | Verdict |
|---|---|
| CLI | v2.28.2; OAuth secure_storage; doctor Domains pass | PASS |
| Domain | `send.laptopshub.pk` verified · region `ap-northeast-1` | PASS |
| API key | Production `sending_access` domain-scoped (admin OAuth retained for CLI) | PASS |
| Limits (observed) | Daily 100 / monthly 3000 emails (free-tier style quota) | PASS |
| Suppressions | Empty | PASS |

## Supabase

| Check | Verdict |
|---|---|
| COD enabled; All Over PK 36000/5000 paisa | PASS |
| Data: 226 products, 0 orders, 0 outbox rows | PASS |
| Advisors: DEFINER RPCs intentional; leaked-password disabled | PASS / BLOCKED |
| RLS initplan migration applied | PASS |

## Email / cron

Unauthorized → 401. Authorized → 200 configured. Staff invite uses app Resend path (not Supabase Auth SMTP). Outbox idle until first COD order.

## Backup / recovery

Platform backups/PITR plan-dependent (not over-claimed). Vercel rollback candidates available. CRM independent.
