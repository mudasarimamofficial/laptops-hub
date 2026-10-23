# Production readiness

Updated: 2026-10-23 (launch completion pass, branch `fix/v5-correctness-parity`) — **NOT production-ready: gates D, E, F not passed.**

| Gate | Status | Evidence / blocker |
|---|---|---|
| A — Source integrity | PASS | Git history preserved (no force-push, no rewrite of pushed commits). V5 export kept local and gitignored (`Laptops Hub storefront/`). No secrets in commits. Parity screenshots that contain unapproved cutouts are kept out of git. |
| B — Visual parity | PASS (engineering; owner acceptance pending) | Re-measured 2026-10-23: 517 captures, no regression vs the committed runs (storefront max 0.38%, content max 7.68% = documented truthful-copy/gated baseline, gated geometry identical) — `docs/V5_PIXEL_DIFF_REPORT.md`. Hero/story cutouts gated (media rights). Real-device checks not performed. |
| C — Functional parity | **PASS (engineering)** | Browser launch journeys 10/10 ×2 on an isolated stack: checkout → confirmation → track order; admin confirm/pack/dispatch/collect/cancel; notifications delivered once with retry (stand-in provider). e2e 39/1 skipped on production data. Shipping zones editable; dashboard counters. Not verified: real email provider, real devices. `docs/LAUNCH_COMPLETION_MATRIX.md` |
| D — Data & security | **PASS (engineering, production)** | Option A and Option B applied with owner approval (2026-10-23): production privileges, schema and function bodies identical to the verified build; staff RPCs, checkout and rate-limit functions service-role only with an in-function guard; future objects not auto-exposed; COD idempotency conflict-safe; shipping-quote fix live. P0 9/9, auth matrix 24/24 on production; isolated collection 16/16, checkout 31/31, role HTTP 97/97. Remaining for go-live: owner account (none today), staff onboarding, real admin flows on production. |
| E — Business readiness | FAIL (owner) | Media rights (catalog photos + cutouts), shipping fees/zones, policies/legal, contact facts, staff bootstrap, availability/inquiry proposal, description cleanup proposal. |
| F — Release | BLOCKED | Production currently runs an owner redeploy of the unreviewed branch commit `34f9839` (public, indexable). Release sequence prepared: `docs/RELEASE_PLAN.md`; public-site options: `docs/PUBLIC_SITE_PLAN.md`. |

## Production domain (found 2026-10-22; updated 2026-10-23)
On 2026-10-23 every `/pages/*` route on the public alias returns **500** (old `ea652f2` build: jsdom `ERR_REQUIRE_ESM`, fixed on this branch in `568ce08`). Another reason to decide the alias.

`https://laptops-hub.vercel.app` is **publicly reachable (HTTP 200)** and serves deployment `dpl_BrACMxR5SfDx317aRs9ExLr7VNBh` — a dashboard *redeploy* to Production of `ea652f2` (pre-parity), created by the owner account. Vercel SSO protection is `all_except_custom_domains`, which protects deployment URLs but this production alias answers publicly. COD is disabled there (`/api/checkout/cod` → 403), so no orders can be placed, but the old storefront and catalog photos are public. Owner decision needed: keep, roll back/remove the production deployment, or tighten protection.

## CMS publication rules (content pages)
- Published (and, for shipping/returns/warranty/privacy/terms, legally approved) row with a body → sanitized CMS HTML in the V5 shell.
- Published row with an empty body → approved V5 template content.
- Anything else → gated shell (V5 "being finalised" notice + contact link), `noindex`, not in the sitemap. Contact form always live.
- Today: all 13 rows are `pending` → every content page is gated. Owner inputs: `docs/OWNER_CONTENT_NEEDS.md`.

## Fixed this pass
- **Vercel runtime crash in the CMS sanitizer** (isomorphic-dompurify → jsdom `ERR_REQUIRE_ESM`): dynamic content routes returned 500 and the admin content save path had logged the same error since 2026-10-21. Replaced with sanitize-html.

- **Checkout duplicate-submit race**: concurrent submits with one idempotency key could lose the insert race and return a 400 exposing the `orders_idempotency_key_uidx` constraint. The route now retries once on 23505 and returns the existing order (found by the isolated HTTP stress test).

## Fixed 2026-10-23
- **Fabricated collection success**: `record_cod_collection` (20261023130000) replayed any existing row for a reused key, returning success for a different order/amount that was never recorded. Now `idempotency_conflict` (20261023150000). Reproduced before (12/16), fixed after (16/16 ×8).
- **Admin double-collection on retry**: the collection form made a new key per submit, so a retry after a lost response could record cash twice. One key per logical collection now.
- **Checkout confirmation for the wrong cart**: a reused checkout key with a different cart/zone returned the earlier order as success. Now 409 `idempotency_conflict` (20261023160000).
- **CMS empty-body publish**: publishing with an empty body showed the whole V5 template, including "being finalised" sections and unapproved copy. Now refused for templates with pending sections and requires explicit template approval otherwise; rendering, sitemap and navigation share one rule.
- **Staff RPC exposure**: migrations + in-function service-role guard (not yet applied to production — owner approval).

## Engineering checks (this pass)
- `npx tsc --noEmit`, `npm run lint` (0 errors), `npm run build`
- `npm run test:unit` (9 suites incl. contact and content-resolve)
- `npm run test:security:p0` → 9/9
- `npx playwright test tests/e2e` → 39 passed, 1 skipped (local and Preview; contact success/failure mocked, no production inbox writes)
- `node scripts/visual/axe-sweep.mjs` → 0 WCAG A/AA violations (10 routes) · `node scripts/visual/console-sweep.mjs` → clean (30 loads)
- `npm run test:security:auth-matrix` → 24/24 · `npm run test:catalog:pagination` → 5/5
- `npx tsx scripts/visual/verify-v5-data.mts` → 226/226, 0 mismatches
- `node scripts/visual/check-routes.mjs` → all pass (local and Preview: `docs/ROUTE_CHECK_*.json`)
- `node scripts/visual/capture.mjs` + `report.mjs` → `docs/V5_PIXEL_DIFF_REPORT.md`

## Do not enable yet
- `COD_CHECKOUT_ENABLED=true` / `NEXT_PUBLIC_COD_CHECKOUT_ENABLED=true`
- `V5_CUTOUT_BASE` (until cutout rights are approved)
- Production promotion of this branch / custom domain cutover
