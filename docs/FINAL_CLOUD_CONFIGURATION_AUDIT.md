# Final cloud configuration audit — 2026-11-18

Evidence-based inventory. No secret values. Mandate baseline `3a00091` / 30 migrations is **superseded**.

## Identity (verified now)

| Surface | Value | Verdict |
|---|---|---|
| GitHub | `mudasarimamofficial/laptops-hub` `main` | PASS |
| Production commit | `db7d26393164b8d64b5e706b3cc56811bbd7f4e2` | PASS |
| Vercel | `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` / `dpl_EncXa4CfSW6bHEAPdWo5PYwd1cKb` READY | PASS |
| Node / region | 24.x / `sin1` | PASS |
| Supabase | `xvmmjkrkgznnakcobmww` ap-southeast-1 ACTIVE_HEALTHY | PASS |
| Migrations | 31 local = 31 remote | PASS |
| CRM | `app.laptopshub.pk` untouched | PASS |

## GitHub

| Setting | After | Verdict |
|---|---|---|
| Ruleset Protect main | `deletion`, `non_fast_forward`, required status **`quality`**, admin bypass | PASS |
| CI workflow | `.github/workflows/ci.yml` — green on main | PASS |
| notification-retry | Points at `NOTIFY_CRON_URL` / www; skips without GH `CRON_SECRET` | PASS by design |
| Actions secrets | Empty until Resend | PASS |
| Variable | `NOTIFY_CRON_URL=https://www.laptopshub.pk/api/cron/notifications` | PASS |

## Vercel

| Area | Finding | Verdict |
|---|---|---|
| Framework / build / regions | Next.js; `vercel.json`; `sin1` | PASS |
| Domains | www canonical; apex 308 → www; dashboard env page opened (authenticated) | PASS |
| Cron | `/api/cron/notifications` `0 6 * * *`; live no-auth **401** | PASS |
| Env matrix | Supabase triad all scopes; Prod COD true; Preview COD false + `MERCHANT_MUTATIONS_DISABLED=1`; `SITE_URL`; `CRON_SECRET` Prod; branch `SITE_PRELAUNCH` retained; Resend/`STORE_*` **missing** | PASS / BLOCKED email |

## Supabase

| Check | Verdict |
|---|---|
| COD enabled; All Over PK 36000/5000 paisa | PASS |
| Data: 226 products, 37 testimonials, 4 guides, 8 pages, 0 reels, 0 orders | PASS |
| Advisors: DEFINER RPCs intentional; rate_limit_buckets no-policy intentional; leaked-password disabled | PASS / BLOCKED |
| RLS initplan migration applied | PASS |

## Email / cron

Unauthorized cron → 401. Authorized outbox delivery BLOCKED without Resend. GH 15‑min retry inactive until GH secret.

## Backup / recovery

Platform backups/PITR plan-dependent (not over-claimed). Vercel rollback candidates available. CRM independent.
