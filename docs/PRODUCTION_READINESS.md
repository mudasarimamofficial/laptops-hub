# Production readiness

Updated: 2026-10-22 (V5 reconstruction, branch `fix/v5-correctness-parity`)

| Gate | Status | Evidence / blocker |
|---|---|---|
| A — Source integrity | PASS | Git history preserved (no force-push, no rewrite of pushed commits). V5 export kept local and gitignored (`Laptops Hub storefront/`). No secrets in commits. Parity screenshots that contain unapproved cutouts are kept out of git. |
| B — Visual parity | PASS for ported templates · PARTIAL overall | Home, header/mega/search/mobile menu, card, collections, search, PDP, cart, drawer, compare, 404 ported 1:1; measured in `docs/V5_PIXEL_DIFF_REPORT.md` (≤0.4% diff, equal geometry ≥760px). Not ported: content pages / guides / FAQ / contact form. Hero/story cutouts gated (media rights). |
| C — Functional parity | PARTIAL | Browse, filters/sort (URL state), search, compare (max 4 + toast), cart (limits + toast), drawer, inquiry → `/api/contact` work; e2e 19 pass / 1 intentional skip. Checkout implemented but disabled. Admin flows not re-verified this pass. |
| D — Data & security | PASS* | P0 probes 9/9; data parity 226/226 (0 mismatches); route check 226/226 PDP 200, 6/6 drafts 404, 39/39 collections. Public reads use the anon key (RLS); no service-role code added to public paths. *Role matrix (`test:security:roles`) and COD concurrency not re-run this pass. |
| E — Business readiness | FAIL (owner) | Media rights (catalog photos + cutouts), shipping fees/zones, policies/legal, contact facts, staff bootstrap, availability/inquiry proposal, description cleanup proposal. |
| F — Release | BLOCKED | See "Production domain" below. No promotion from this session. |

## Production domain (found 2026-10-22)
`https://laptops-hub.vercel.app` is **publicly reachable (HTTP 200)** and serves deployment `dpl_BrACMxR5SfDx317aRs9ExLr7VNBh` — a dashboard *redeploy* to Production of `ea652f2` (pre-parity), created by the owner account. Vercel SSO protection is `all_except_custom_domains`, which protects deployment URLs but this production alias answers publicly. COD is disabled there (`/api/checkout/cod` → 403), so no orders can be placed, but the old storefront and catalog photos are public. Owner decision needed: keep, roll back/remove the production deployment, or tighten protection.

## Engineering checks (this pass)
- `npx tsc --noEmit`, `npm run lint` (0 errors), `npm run build`
- `npm run test:unit` (7 suites)
- `npm run test:security:p0` → 9/9
- `npx playwright test tests/e2e` → 19 passed, 1 skipped (inquiry submit needs a non-production DB)
- `npx tsx scripts/visual/verify-v5-data.mts` → 226/226, 0 mismatches
- `node scripts/visual/check-routes.mjs` → all pass (local and Preview: `docs/ROUTE_CHECK_*.json`)
- `node scripts/visual/capture.mjs` + `report.mjs` → `docs/V5_PIXEL_DIFF_REPORT.md`

## Do not enable yet
- `COD_CHECKOUT_ENABLED=true` / `NEXT_PUBLIC_COD_CHECKOUT_ENABLED=true`
- `V5_CUTOUT_BASE` (until cutout rights are approved)
- Production promotion of this branch / custom domain cutover
