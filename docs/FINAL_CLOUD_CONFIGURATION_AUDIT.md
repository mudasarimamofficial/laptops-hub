# Final cloud configuration audit — 2026-11-18

Evidence-based inventory of GitHub, Vercel, and Supabase for Laptops HUB. No secret values.

## Identity (verified)

| Surface | Value | Verdict |
|---|---|---|
| GitHub | `mudasarimamofficial/laptops-hub`, default `main`, public | PASS |
| Production commit (pre-PR #18) | `3a00091b983996347b728e20a46e7686d45f3b52` | PASS |
| Vercel project | `laptops-hub` / `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` | PASS |
| Production deployment (pre-redeploy) | `dpl_2daEN1ms2GpUwnjJXsjPSfybVGF4` READY @ `3a00091` | PASS |
| Node / region | 24.x / `sin1` | PASS |
| Supabase | `xvmmjkrkgznnakcobmww` (Laptops Hub, `ap-southeast-1`) ACTIVE_HEALTHY | PASS |
| Migrations applied | 30 → 31 after `rls_initplan_perf` | PASS |
| CRM host | `app.laptopshub.pk` (Hostinger) — **not modified** | PASS |

## GitHub — before / after

| Setting | Before | After | Verdict |
|---|---|---|---|
| Branch protection / rulesets | None (404) | Ruleset **Protect main** (`deletion` + `non_fast_forward`, admin bypass) | PASS |
| Required PR reviews | None | Not required (solo-owner hotfix path preserved via admin bypass) | PASS |
| Required status checks | None | Deferred until CI proven on PR #18 (`quality` PASS) — optional follow-up | PASS (soft) |
| Workflows | `notification-retry.yml` only | + `ci.yml` (tsc, lint, unit, build) | PASS |
| Actions secrets | Empty (`CRON_SECRET` absent) | Still empty — intentional until Resend is live | PASS |
| Actions variable | — | `NOTIFY_CRON_URL=https://www.laptopshub.pk/api/cron/notifications` | PASS |

## Vercel — settings

| Area | Finding | Verdict |
|---|---|---|
| Framework / build | Next.js; `vercel.json` install/build; regions `sin1` | PASS |
| Production branch | `main` | PASS |
| Deployment protection | SSO on non-custom hosts; custom domains open | PASS |
| Domains | `www.laptopshub.pk` (canonical), `laptopshub.pk` → 308 www, `laptopshubpk.vercel.app` → www | PASS |
| `laptops-hub.vercel.app` | **Not** a project alias (cron fallback was wrong → 404) | FIXED in PR #18 |
| Cron | `/api/cron/notifications` daily `0 6 * * *` | PASS (auth depends on `CRON_SECRET` + redeploy) |

## Environment variable matrix (names only)

| Variable | Production | Preview | Development | Classification | Notes |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | yes | Required public | Present |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | yes | Required public | Present |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (sensitive) | yes (sensitive) | yes | Required server secret | Never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_COD_CHECKOUT_ENABLED` | `true` | `false` | encrypted | Required public | Preview correctly off |
| `COD_CHECKOUT_ENABLED` | yes (sensitive) | `false` | encrypted | Required server | Preview correctly off |
| `SITE_URL` | `https://www.laptopshub.pk` | — | — | Required public | **Added 2026-11-18** |
| `CRON_SECRET` | yes (sensitive) | — | — | Required server secret | **Added 2026-11-18**; needs Production redeploy to bind |
| `MERCHANT_MUTATIONS_DISABLED` | — | `1` | — | Preview safety | **Added 2026-11-18** |
| `SITE_PRELAUNCH` | — | branch-scoped only (`preview/prelaunch-*`) | — | Optional | Intentionally branch-specific; not deleted |
| `RESEND_API_KEY` | **missing** | missing | missing | Required for email | BLOCKED — no provider key available |
| `STORE_FROM_EMAIL` | **missing** | missing | missing | Required for email | BLOCKED |
| `STORE_NOTIFY_EMAIL` | **missing** | missing | missing | Required for merchant alerts | BLOCKED |
| `NOTIFY_CUSTOMER_EMAIL` | missing | missing | missing | Optional | Leave unset until Resend works |
| `THEME_PUBLISHED_ENABLED` | missing | missing | missing | Optional | Storefront uses code defaults when unset |
| `V5_CUTOUT_BASE` / `V5_CONTENT_PREVIEW` | absent | absent | — | Optional / preview-only | Correct |

## Supabase

| Check | Result | Verdict |
|---|---|---|
| Migration ledger vs repo | 30 applied; additive `rls_initplan_perf` applied | PASS |
| COD store setting | `cod_checkout.enabled=true` | PASS |
| Shipping zone | All Over PK: `flat_fee_paisa=36000`, `cod_fee_paisa=5000` | PASS |
| Catalog | 226 active products; 0 live orders | PASS |
| Security advisors | SECURITY DEFINER storefront RPCs intentional; `rate_limit_buckets` RLS-no-policy intentional service table; leaked-password protection **disabled** (platform toggle) | PASS / BLOCKED (leaked password) |
| Performance advisors | `auth_rls_initplan` on 2 policies → fixed; unused indexes / multiple permissive policies retained (expected public+staff SELECT) | PASS |

## Email / cron status

| Item | Verdict |
|---|---|
| Unauthorized cron (wrong bearer) before secret bind | 503 (expected) |
| GitHub notification-retry schedule | Inactive until GH `CRON_SECRET` set (after Resend) | PASS by design |
| Vercel Production `CRON_SECRET` | Set; Production redeploy required for runtime | PASS (config) |
| Email delivery | BLOCKED — Resend + verified sender domain not available in this session |

## Backup / recovery

| Method | Status |
|---|---|
| Supabase platform backups / PITR | Plan-dependent; not claimed beyond ACTIVE_HEALTHY project |
| Git / Vercel rollback | Prior production deployments marked rollback candidates |
| CRM | Independent Hostinger app — out of scope |

## Changes executed this pass

1. Added Production `CRON_SECRET` (sensitive) and `SITE_URL`.
2. Hardened Preview: COD flags false + `MERCHANT_MUTATIONS_DISABLED=1`.
3. GitHub ruleset Protect main; `NOTIFY_CRON_URL` variable; CI workflow; cron URL fix (PR #18).
4. Applied RLS initplan performance migration.
