# 21 — Risk register and executive summary

**Date:** 2026-11-17 (reconciled)

## Executive summary

Laptops HUB is an independent Next.js + Supabase COD ecommerce platform at `www.laptopshub.pk` (not a Shopify theme). Production serves a 226-product catalog with commerce gates correctly closed.

**Honest state:** Infrastructure and catalog are production-verified. PR #14 carries merchant UX/correctness fixes (inventory soft-delete counts, keyboard shortcuts) that are **Preview-ready, not yet production**. Live COD remains blocked on owner business inputs. Several audit PASS rows are smoke/code/historical evidence — not full authenticated persistence certification of every admin control.

**Classification:** **PRODUCTION VERIFIED — MERCHANT INPUTS PENDING** (+ **PR #14 pending merge**).

## Risk matrix

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Content/policy pages unpublished | HIGH (current) | Medium (trust/SEO) | Owner-written copy + legal review | Owner |
| No transactional email | HIGH (current) | High (ops) | Resend + Vercel env (names only) | Owner |
| Soft-deleted QA stock inflating inventory header on **production** | HIGH until PR merge | Medium (merchant confusion) | Merge/deploy DEF-016 | Engineer (PR #14) |
| Missing HTTP security headers | LOW–MED | Medium | Careful CSP that still allows Maps/media/fonts; test Preview | Engineer |
| No GitHub branch protection on `main` | MEDIUM | Medium | Enable required reviews / no force-push | Owner |
| Media rights uncleared | HIGH | High (legal) | Clear OEM rights | Owner |
| ~~Security migration 28 not on production~~ | **N/A** | — | **Already applied** within 29/29 ledger | — |
| Replay migrations 15–29 | — | **High (danger)** | **Do not run** | Engineer |

## Critical path (corrected)

```
1. Finish PR #14 acceptance (Preview QA + suites) → merge → deploy code only
2. Do NOT reapply migrations (29/29 already on production)
3. Owner configures Resend + env vars when ready
4. Owner publishes policy/content pages when ready
5. Owner confirms shipping fees / policies → then enable COD (separate decision)
6. Optional: staging project for future destructive tests
7. Optional: security headers PR after CSP compatibility test
```

## What works today (production `585c8e9`)

- 226-product catalog, search, collections, compare, cart, inquiry form
- Admin auth + merchant console (many modules present)
- COD and theme publish gates enforced
- SEO sitemap/robots, Vercel `sin1`, CRM isolated

## What does NOT work / is intentionally off

- Public COD ordering (gated)
- Theme publish to public homepage (flag unset)
- Transactional email (unconfigured)
- Published reels / store testimonials (none — honest empty)
- Soft-delete-aware inventory **counts** on production until PR #14 deploys
