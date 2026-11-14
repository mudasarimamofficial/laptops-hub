# Laptops HUB — Client Requests Acceptance Matrix

**Date:** 2026-11-14 · **Branch:** `feat/merchant-operating-system` · **Status:** READY FOR OWNER APPROVAL — NOT YET LIVE-COMMERCE CERTIFIED

States: **PASS** = implemented and verified with the evidence named · **FAIL** = verified broken · **BLOCKED** = needs an owner
decision, owner content or production access that this pass did not have · **NOT BUILT** = not implemented in this pass ·
**NOT TESTED** = implemented but without direct evidence.

All evidence comes from the isolated stack: a local Supabase seeded by `scripts/test-fixtures/seed-isolated.mjs`, the app on
`127.0.0.1:3001`, and a fake Resend on `:4599`. Nothing in production was changed.

## P0

| # | Request | State | Evidence / note |
|---|---|---|---|
| 1 | Admin never renders storefront header/footer/cart/compare | **PASS** | Route groups `(storefront)`/`(admin)`; `p0-admin-isolation-and-checkout-gates.spec.ts` at 360/390/768/1280/1440 on 4 admin routes; no horizontal overflow |
| 2 | Admin 404 is admin-styled, storefront 404 keeps chrome | **PASS** | `admin/[...missing]` + `admin/not-found.tsx`; root `not-found.tsx` server-renders with storefront chrome |
| 3 | Checkout opens only when every blocking gate passes (server-side) | **PASS** | `evaluateCheckoutReadiness` (unit) + `p0` spec “failing gate ⇒ non-clickable”; the form gets `orderingOpen` from the server |
| 4 | Admin sees a truthful readiness matrix (env flags, DB setting, zones, policies, catalog, notifications, staff) | **PASS** | `checkout-readiness-panel.tsx` on Overview and Settings; spec asserts 8 gates and no secret values in the HTML |
| 5 | Rs 360 delivery + Rs 50 COD preserved; Rs 0 + Rs 0 is a valid, deliberate “Free delivery” | **PASS** | SQL matrix `scripts/db-tests/shipping-cod-matrix.sql` 26/26; spec checks UI + `/api/checkout/quote` (0/0 and nonzero) |
| 6 | Blank fee no longer silently saved as 0 | **PASS** | `shipping-form.tsx` sends `null`; Zod message “Enter the delivery fee in rupees (0 = free delivery)” |
| 7 | Unserved city ⇒ no clickable order; no raw DB errors from quote API | **PASS** | p0 spec (Gwadar/Balochistan); quote route maps errors to generic codes |
| 8 | Transactional COD order creation (idempotent, oversell-safe) | **PASS (local)** | Existing `test-cod-checkout-isolated.mjs` 23/23 and `test-cod-concurrency.mjs` 16/16 (prior pass); journeys in the isolated suite |
| 9 | Public COD enabled in production | **BLOCKED** | Owner authorisation needed (both env flags + `store_settings.cod_checkout`) |
| 10 | Shopify-quality product management | **PASS (prior pass)** | Merchant smoke 25/25, admin E2E 10/10 (`PRODUCTION_RELEASE_CANDIDATE.md`); not re-run in full this pass |
| 11 | Theme editor RLS / draft-publish workflow | **PASS (prior pass)** | Theme RLS matrix 7/7, Playwright theme 8/8; unchanged this pass |
| 12 | Security advisor findings | **PASS (local)** / **BLOCKED (prod)** | Migration `20261114100000_function_search_path_hardening.sql` fixes 3 mutable `search_path` functions locally; leaked-password protection is a dashboard toggle for the owner; production advisors not re-read (Supabase MCP denied) |
| 13 | Fresh builds succeed | **PASS** | `next/font/google` failed in this environment (Google returned extension-less font URLs); fonts now self-hosted via `next/font/local` (OFL). This also removes a build-time network dependency on Vercel |

## P1

| # | Request | State | Evidence / note |
|---|---|---|---|
| 14 | Remove “236 listings”, “View all N”, “N products in the catalog” | **PASS** | Hidden by default; owner switch in Admin → Settings → Storefront labels; `p1-storefront-labels.spec.ts` 2/2 |
| 15 | Remove “Rear view”, “Front view · 1/4” (the “n/4” angle counter; the audit's “4x4”), “Product story 0” chapter numbers, “02 — PRODUCT STORY”, “11 — NEED HELP CHOOSING?” | **PASS** | Same spec; image alt text kept for accessibility. The literal string “4x4” does not occur in `src/` or `data/` |
| 16 | Hero price tag showed image alt text (“… — Laptops HUB hero”) | **PASS** | Tag now shows the product model |
| 17 | “SSDs” category label | **NOT TESTED** | Category names are merchant data; editable in Admin → Collections/Navigation. Not changed in code (no data invented) |
| 18 | Truthful purchase toast (zero orders ⇒ none) | **PASS** | No fabricated “someone bought” toast exists anywhere in `src/` (the only toast is cart/quantity feedback). A real-order toast is not built |
| 19 | Fire / top-selling badges only from real data | **PASS (none shown)** | No such badges exist in `src/`. Real-data badges are not built (needs order history; production has no COD orders) |
| 20 | “Generation Laptops HUB” reels carousel | **NOT BUILT** | Needs a rights-gated media model + owner-supplied videos. The ronin.pk reference URLs are **absent** from `src/`, `data/`, `public/` (grep verified) |
| 21 | Moderated real reviews (no fabrication) | **NOT BUILT** | Needs a `product_reviews` table with moderation + migration approval. No reviews are shown today, so nothing is fabricated |
| 22 | Real blog system | **NOT BUILT** | `/guides/[slug]` exists (content pages gated by owner approval); there is no editor-driven blog |
| 23 | Settings / order desk polish | **PARTIAL** | Readiness panel replaced the misleading pending block; responsive fee grid; `method="post"` on settings and navigation forms (no-JS safety) |
| 24 | 964 media rows reviewed | **BLOCKED** | Owner must review rights; not auto-approved |

## Owner decisions still required

1. Delivery and COD fees per zone (Rs 360 + Rs 50 configuration or Rs 0 + Rs 0)
2. Approval and publication of policy pages (shipping, returns, warranty, privacy, terms)
3. Real stock levels (variants are currently untracked)
4. Media rights for the 964 media rows and any reel videos
5. Staff invitations
6. Approval of the 6 pending migrations (runbook below)
7. Merge, deploy and COD activation

See `LAPTOPS_HUB_MIGRATION_AND_RELEASE_RUNBOOK.md`.
