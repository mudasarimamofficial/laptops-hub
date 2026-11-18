# Final cloud configuration audit — 2026-11-18

Evidence-based inventory of GitHub, Vercel, and Supabase for Laptops HUB. No secret values.

## Identity (verified)

| Surface | Value | Verdict |
|---|---|---|
| GitHub | `mudasarimamofficial/laptops-hub`, default `main`, public | PASS |
| Production commit | `afed09a808d4357aeff2d9375b40fb797e68546d` | PASS |
| Vercel project | `laptops-hub` / `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` | PASS |
| Production deployment | `dpl_E22FfdsVi8KcEJiwqLnmfBNNKVmz` READY @ `afed09a` | PASS |
| Node / region | 24.x / `sin1` | PASS |
| Framework | Next.js | PASS |
| Supabase | `xvmmjkrkgznnakcobmww` (Laptops Hub, `ap-southeast-1`) ACTIVE_HEALTHY | PASS |
| Migrations | 31 local = 31 remote (ledger repaired; orphan `20261118040542` reverted, `20261118140000` marked applied — policies already matched) | PASS |
| CRM host | `app.laptopshub.pk` (Hostinger) — **not modified** | PASS |

## GitHub — before / after

| Setting | Before | After | Verdict |
|---|---|---|---|
| Branch protection / rulesets | None | Ruleset **Protect main**: `deletion`, `non_fast_forward`, **`required_status_checks` → `quality`**, admin RepositoryRole bypass | PASS |
| Required PR reviews | None | Not required (solo-owner hotfix via admin bypass) | PASS |
| Workflows | `notification-retry.yml` only | + `ci.yml` (tsc, lint, unit, build) — run `44235107324` success on `06b5ff3` | PASS |
| Actions secrets | Empty (`CRON_SECRET` absent) | Still empty — intentional until Resend is live | PASS |
| Actions variable | — | `NOTIFY_CRON_URL=https://www.laptopshub.pk/api/cron/notifications` | PASS |

## Vercel — settings

| Area | Finding | Verdict |
|---|---|---|
| Framework / build | Next.js; `vercel.json` install/build; regions `sin1` | PASS |
| Production branch | `main` | PASS |
| Deployment protection | SSO on non-custom hosts; custom domains open | PASS |
| Domains | `www.laptopshub.pk` (canonical), `laptopshub.pk` → 308 www, `laptopshubpk.vercel.app` | PASS |
| `laptops-hub.vercel.app` | **Not** a project alias (cron fallback was wrong → fixed) | FIXED in PR #18 |
| Cron route | `/api/cron/notifications` in `vercel.json` | PASS |
| Cron auth (live) | No bearer / wrong bearer → **401** `unauthorized` (secret bound; missing secret would be 503) | PASS |
| Authorized cron happy-path | Not exercised without printing secret; outbox empty + Resend absent | NOT TESTED (auth gate PASS) |

## Environment variable matrix (names only)

| Variable | Production | Preview | Development | Classification | Notes |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | yes | Required public | Present |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | yes | Required public | Present |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (sensitive) | yes (sensitive) | yes | Required server secret | Never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_COD_CHECKOUT_ENABLED` | `true` | `false` | encrypted | Required public | Preview correctly off |
| `COD_CHECKOUT_ENABLED` | yes (sensitive) | `false` | encrypted | Required server | Preview correctly off |
| `SITE_URL` | `https://www.laptopshub.pk` | — | — | Required public | Bound |
| `CRON_SECRET` | yes (sensitive) | — | — | Required server secret | Bound on Production deploy |
| `MERCHANT_MUTATIONS_DISABLED` | — | `1` | — | Preview safety | Bound |
| `SITE_PRELAUNCH` | — | branch-scoped only (`preview/prelaunch-*`) | — | Optional | Intentionally branch-specific; not deleted |
| `RESEND_API_KEY` | **missing** | missing | missing | Required for email | BLOCKED |
| `STORE_FROM_EMAIL` | **missing** | missing | missing | Required for email | BLOCKED |
| `STORE_NOTIFY_EMAIL` | **missing** | missing | missing | Required for merchant alerts | BLOCKED |
| `NOTIFY_CUSTOMER_EMAIL` | missing | missing | missing | Optional | Leave unset until Resend works |
| `THEME_PUBLISHED_ENABLED` | missing | missing | missing | Optional | Storefront uses code defaults when unset |
| `V5_CUTOUT_BASE` / `V5_CONTENT_PREVIEW` | absent | absent | — | Optional / preview-only | Correct |

Derived from source `process.env` usage; secrets never printed.

## Supabase

| Check | Result | Verdict |
|---|---|---|
| Migration ledger vs repo | Aligned at 31 after repair | PASS |
| COD store setting | `cod_checkout.enabled=true` | PASS |
| Shipping zone | All Over PK: `flat_fee_paisa=36000`, `cod_fee_paisa=5000` | PASS |
| Catalog / content | 226 active products; 37 published testimonials; 4 guides; 8 CMS pages; 0 reels; 0 orders | PASS |
| Security advisors | SECURITY DEFINER storefront RPCs intentional; `rate_limit_buckets` RLS-no-policy intentional (service-only); leaked-password protection **disabled** | PASS / BLOCKED (leaked password) |
| Performance advisors | `auth_rls_initplan` fixed; unused indexes retained (pre-order traffic); multiple permissive policies retained (public+staff SELECT pattern) | PASS |

## Email / cron status

| Item | Verdict |
|---|---|
| Unauthorized cron (no/wrong bearer) on Production `06b5ff3` | **401** — PASS |
| GitHub notification-retry schedule | Inactive until GH `CRON_SECRET` set (after Resend) | PASS by design |
| Vercel Production `CRON_SECRET` | Present and runtime-enforced | PASS |
| Email delivery | BLOCKED — Resend + verified sender domain unavailable |

## Backup / recovery

| Method | Status |
|---|---|
| Supabase platform backups / PITR | Plan-dependent; not claimed beyond ACTIVE_HEALTHY project |
| Git / Vercel rollback | Prior READY production `dpl_2daEN1…` @ `3a00091` remains a rollback candidate |
| CRM | Independent Hostinger app — out of scope |

## Changes executed this pass

1. Confirmed Production redeploy `dpl_8sSU9AF…` READY for `06b5ff3` (binds `CRON_SECRET` / `SITE_URL`).
2. Repaired Supabase migration ledger drift (no schema replay).
3. Extended GitHub ruleset with required status check `quality`.
4. Re-verified env matrix, domains, cron auth gate, quote API, and storefront checkout totals.
