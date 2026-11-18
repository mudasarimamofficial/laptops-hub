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

## Domains (MCP-verified 2026-11-17)

| Domain | Target | Redirect | Verified |
|---|---|---|---|
| `www.laptopshub.pk` | Production | — (primary) | Yes |
| `laptopshub.pk` | Production | 308 → `www.laptopshub.pk` | Yes |
| `laptopshubpk.vercel.app` | Production | 308 → `www.laptopshub.pk` | Yes |
| `laptops-hub-mudasarimamofficial-gmailcoms-projects.vercel.app` | — (auto) | — | — |
| `laptops-hub-git-main-mudasarimamofficial-gmailcoms-projects.vercel.app` | — (auto) | — | — |

All three custom domains verified and correctly routing to `www.laptopshub.pk` as canonical.

## Security configuration

| Setting | Value | Assessment |
|---|---|---|
| SSO Protection | Enabled, `all_except_custom_domains` | PASS — previews protected |
| Password Protection | Disabled | OK — SSO covers previews |
| Trusted IPs | Disabled | OK for this use case |
| Firewall | Default (no custom rules) | INFO — consider WAF rules for production |
| Custom Environments | 0 | CONFIRMED — no staging exists |

## HTTP security headers (live probe 2026-11-17)

| Header | Present | Value |
|---|---|---|
| `strict-transport-security` | Yes | `max-age=63072000` (~2 years) |
| `x-powered-by` | Yes | `Next.js` (reveals tech stack) |
| `x-content-type-options` | **No** | Should be `nosniff` |
| `x-frame-options` | **No** | Should be `DENY` or `SAMEORIGIN` |
| `content-security-policy` | **No** | Recommended for XSS mitigation |
| `referrer-policy` | **No** | Should be `strict-origin-when-cross-origin` |
| `permissions-policy` | **No** | Recommended |
| `cache-control` | Yes | `public, max-age=0, must-revalidate` (correct for ISR) |
| `x-vercel-cache` | Yes | `HIT` (edge cache working) |

Edge routing: `bom1::sin1` — Mumbai edge → Singapore origin, confirming correct region proximity for Pakistan traffic.

## Deployment history (MCP-verified, last 10)

| Deployment | Branch | SHA | Target | State |
|---|---|---|---|---|
| `dpl_HpnVn5P…` | `audit/final-independent-certification` | `d29cc90` | preview | READY |
| `dpl_8YQ3HoE…` | `main` | `585c8e9` (PR #13) | **production** | READY ✓ |
| `dpl_y1AS2cE…` | `fix/theme-editor-narrow-overflow` | `3b8f7cf` | preview | READY |
| `dpl_HANoBHi…` | `fix/theme-editor-narrow-overflow` | `362faaf` | preview | READY |
| `dpl_2gJc3wm…` | `main` | `7abb680` (PR #12) | **production** | READY (rollback) |
| `dpl_8vsnW2e…` | `feat/merchant-operating-system` | `d217c06` | preview | READY |
| `dpl_6UQqd85…` | `feat/merchant-operating-system` | `cef211a` | preview | READY |
| `dpl_3fjmfeg…` | `feat/merchant-operating-system` | `7e0d824` | preview | READY |
| `dpl_2XLaqxj…` | `main` | `7e406df` (PR #11) | **production** | READY |
| `dpl_274sCQ5…` | `feat/merchant-operating-system` | `c6074e1` | preview | READY |

All 10 READY. No ERROR or CANCELED deployments in recent history. Good deployment hygiene.

## `robots.txt` (live 2026-11-17)

```
User-Agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /order/
Disallow: /checkout
Disallow: /cart
Disallow: /track-order
Disallow: /search
Disallow: /preview/

Sitemap: https://www.laptopshub.pk/sitemap.xml
```

PASS — admin, API, cart, checkout, orders, preview all correctly disallowed.

## Live endpoint probes (2026-11-17)

| Endpoint | Method | Status | Assessment |
|---|---|---|---|
| `/` (homepage) | GET | 200 | PASS |
| `/cart` | GET | 200 (empty) | PASS |
| `/admin` | GET | 302 → `/admin/login` | PASS — auth required |
| `/api/admin/account/sign-out` | GET | 405 | PASS — POST-only (CSRF safe) |
| `/api/checkout/cod` | POST | 403 `checkout_disabled` | PASS — gate working |
| `/about` | GET | 404 | EXPECTED — content pending |
| `/contact` | GET | 404 | EXPECTED — content pending |
| `/privacy-policy` | GET | 404 | EXPECTED — content pending |
| `/terms` | GET | 404 | EXPECTED — content pending |
| `/warranty` | GET | 404 | EXPECTED — content pending |
| `/sitemap.xml` | GET | 200 | PASS |
| `/robots.txt` | GET | 200 | PASS |
| PDP (Dell 7420) | GET | 200 | PASS — full specs, gallery, cart |

## Evidence

- Vercel MCP `get_project` + `list_deployments` + `list_project_domains` + `get_firewall_config` JSON (2026-11-17)
- Live `POST /api/checkout/cod` → 403 `checkout_disabled`
- Live storefront and CRM probes: 200
- HTTP headers captured via `fetch HEAD` from live page

## Additional findings (re-verified)

| ID | Finding | Severity |
|---|---|---|
| V-07 | GitHub `main` has **no branch protection** | P2 hygiene |
| V-08 | CRM `app.laptopshub.pk` still on Hostinger | PASS / do not change |
| V-09 | Missing `X-Content-Type-Options: nosniff` header | P3 security |
| V-10 | Missing `X-Frame-Options` header | P3 security |
| V-11 | Missing `Content-Security-Policy` header | P2 security |
| V-12 | Missing `Referrer-Policy` header | P3 hygiene |
| V-13 | `X-Powered-By: Next.js` exposes technology | P3 info leak |
| V-14 | No custom Vercel environments — staging gap confirmed | P2 ops |
| V-15 | 5 content pages return 404 (about, contact, privacy, terms, warranty) | P1 launch-blocker |

## Verdict

**PASS** for project identity, region, domains, production deployment, deployment integrity, COD gate, and env name matrix.  
**PARTIAL** for ops completeness (email/cron secrets absent — owner config) and security headers (5 missing).  
**BLOCKED** for content pages (5 × 404) and staging environment.  
No urgent mislinked project, wrong-region regression, or deployment failure found.
