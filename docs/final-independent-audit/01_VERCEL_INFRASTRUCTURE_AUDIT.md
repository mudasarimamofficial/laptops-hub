# 01 — Vercel infrastructure audit

**Date:** 2026-11-17  
**Method:** Vercel CLI (`whoami`, `project ls`, `inspect`, `ls --prod`, `env ls`) + live HTTP probes  
**Secrets:** names and presence only — no values recorded

## Project matrix

| Setting | Verified value | Severity if wrong |
|---|---|---|
| Account | `mudasarimamofficial-2733` | P0 |
| Team | `mudasarimamofficial-gmailcoms-projects` | P0 |
| Project name | `laptops-hub` | P0 |
| Project ID | `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` | P0 |
| Framework | Next.js | — |
| Node | 24.x | — |
| Production branch | `main` (git-main alias present) | P1 |
| Regions (vercel.json) | `sin1` | P1 (latency/cost) |
| Cron | `/api/cron/notifications` daily `0 6 * * *` | P2 if email unset |
| Latest production | `dpl_8YQ3HoEmaw5bqAv4rxBS1Z5eSz3N` READY | — |
| Git SHA | `585c8e9` (PR #13 merge) | — |
| Domains | `www.laptopshub.pk`, `laptopshub.pk`, vercel aliases | — |
| CRM DNS | Out of scope — `app.laptopshub.pk` still HTTP 200 | Do not change |

## Environment variables (Production)

| Name | Present | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (secret) | Server-only — correct |
| `COD_CHECKOUT_ENABLED` | Yes (secret) | Live API still returns checkout_disabled (DB gate + value) |
| `NEXT_PUBLIC_COD_CHECKOUT_ENABLED` | Yes | UI honesty flag |
| `THEME_PUBLISHED_ENABLED` | **No** | Homepage uses V5 default — intentional |
| `RESEND_API_KEY` | **No** | Notifications cannot send |
| `STORE_FROM_EMAIL` | **No** | Same |
| `STORE_NOTIFY_EMAIL` | **No** | Same |
| `CRON_SECRET` | **No** | Cron auth unusable until set |
| `NOTIFY_CUSTOMER_EMAIL` | **No** | Customer email off |

Preview-only: `SITE_PRELAUNCH` on named preview branches.

## Findings

| ID | Finding | Severity | Impact | Recommendation |
|---|---|---|---|---|
| V-01 | Production on `sin1` with Singapore Supabase | Info / PASS | Region mismatch historically fixed | Keep |
| V-02 | Email provider env absent | P2 (ops) | No order/staff email delivery | Owner configures Resend + DNS, then sets vars |
| V-03 | `THEME_PUBLISHED_ENABLED` unset | Info | Theme editor publish does not change public home | Separate owner go-live decision |
| V-04 | Cron configured without `CRON_SECRET` | P2 | Cron endpoint cannot safely run | Set secret before relying on retries |
| V-05 | Second Vercel project exists: storefront design prototype | P3 hygiene | Confusion risk | Leave alone; do not deploy commerce there |
| V-06 | Dashboard browser audit incomplete | Blocked | UI settings screens not clicked | Owner login to Vercel dashboard |

## Evidence

- CLI inspect JSON: deployment id `dpl_8YQ3HoEmaw5bqAv4rxBS1Z5eSz3N`, target production, READY
- Live `POST /api/checkout/cod` → 403 `checkout_disabled`
- Live storefront and CRM probes: 200

## Browser dashboard (2026-11-17, this session)

Owner Vercel session was already authenticated in Cursor browser.

| Screen | Observation |
|---|---|
| Overview | Production Ready · `www.laptopshub.pk` · SHA `585c8e9` · Instant Rollback available |
| Observability (6h) | CDN ~1.9K · Functions ~1.1K · Error rate 0% |
| Settings → General | Project name / ID present |
| Settings → Functions | Fluid Compute **Enabled**; region controlled via `vercel.json` (`sin1`) |
| Domains | Custom domain connected (`www.laptopshub.pk`) |
| Analytics | Not enabled (optional; paid Speed Insights Plus not activated) |

## Additional findings (re-verified)

| ID | Finding | Severity |
|---|---|---|
| V-07 | GitHub `main` has **no branch protection** | P2 hygiene |
| V-08 | CRM `app.laptopshub.pk` still `45.130.228.253` HTTP 200 | PASS / do not change |

## Verdict

**PASS** for project identity, region, domains, production deployment, and env name matrix.  
**PARTIAL** for ops completeness (email/cron secrets absent — owner config).  
No urgent mislinked project or wrong-region regression found.
