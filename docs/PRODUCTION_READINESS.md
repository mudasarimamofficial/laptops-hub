# Production readiness

Updated: 2026-10-23 (security & COD integrity pass, branch `fix/v5-correctness-parity`)

| Gate | Status | Evidence / blocker |
|---|---|---|
| A — Source integrity | PASS | Git history preserved (no force-push, no rewrite of pushed commits). V5 export kept local and gitignored (`Laptops Hub storefront/`). No secrets in commits. Parity screenshots that contain unapproved cutouts are kept out of git. |
| B — Visual parity | PASS (all V5 templates ported) | Storefront ≤0.4%; content templates (13 pages, guides, 4 articles, FAQ, contact states) ≤0.13% where copy is unchanged, explained deltas elsewhere (`docs/V5_PIXEL_DIFF_REPORT.md`, 427 captures). Hero/story cutouts gated (media rights). |
| C — Functional parity | PARTIAL | Browse, filters/sort, search, compare, cart, drawer, inquiry and the V5 contact form (real `/api/contact`, success only after insert) work; e2e 39 pass / 1 intentional skip locally and on Preview. Checkout implemented but disabled. Admin content save path fixed (sanitizer); other admin flows not re-verified this pass. |
| D — Data & security | **BLOCKED (owner approval)** | Code and migrations ready, production NOT fixed. Confirmed read-only on production: anon/authenticated can EXECUTE `record_cod_collection`, `transition_order_status` (SECURITY DEFINER, trust `actor_user_id`) and `consume_rate_limit`; legacy default privileges re-expose future objects. Fix: 6 pending migrations (`docs/MIGRATION_PRODUCTION_APPROVAL.md` — Option A emergency revoke, Option B full set), verified locally on production-equivalent grants. COD idempotency now conflict-safe (`docs/COD_IDEMPOTENCY_CONTRACT.md`). Local isolated: role matrix 15/15 · COD collection matrix 16/16 (8 consecutive runs; 2/8/16/32-way same-key bursts, cross-order and different-amount conflicts, over-collection) · checkout isolated 25/25 (incl. same-key different cart/zone conflicts and 8×6 concurrent HTTP submits) · staff role HTTP 97/97 (incl. CMS template gate and COD collection record/replay/conflict through the admin route). Production read-only: P0 9/9 · auth matrix 24/24 · pagination 5/5 · data parity 0 mismatches · routes all pass. axe 0 violations (10 routes) · console sweep clean. |
| E — Business readiness | FAIL (owner) | Media rights (catalog photos + cutouts), shipping fees/zones, policies/legal, contact facts, staff bootstrap, availability/inquiry proposal, description cleanup proposal. |
| F — Release | BLOCKED | See "Production domain" below. No promotion from this session. |

## Production domain (found 2026-10-22)
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
