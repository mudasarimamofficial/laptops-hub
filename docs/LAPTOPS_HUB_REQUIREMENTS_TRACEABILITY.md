# Laptops HUB — Requirements Traceability (master prompt 2026-11-14 → evidence)

**Updated:** 2026-11-16 · Branch `feat/merchant-operating-system` · Evidence is from the **local isolated stack** unless
marked otherwise. States: **PASS** (implemented + verified, evidence named) · **PARTIAL** (part verified; the gap is
stated) · **BLOCKED** (needs the owner, owner content, staging or production access) · **NOT BUILT** · **OPTIONAL — not
built** (the contract says "if supported/appropriate").

Final-run evidence: `docs/evidence/final-run/summary.json` (label `final-2026-11-16-d`, verdict PASS, all 25 suites rc=0) and per-suite logs beside it.

| § | Requirement | State | Evidence / gap |
|---|---|---|---|
| 0 | Work on the right app/repo; verify the live baseline | PASS | Repo/branch confirmed; production not read this session (CLI unlinked) — baseline facts from the 2026-11-14 audit |
| 1 | Safety: no production change, no push/merge/deploy, evidence-based reporting | PASS | Nothing pushed; backup ref `refs/backup/2026-11-16-session-start`; stash and tags preserved; suite runner refuses non-local Supabase and now reports by exit code |
| 2.1 | Checkout readiness matrix, server-side gates, quote = order total | PASS | `p0-admin-isolation-and-checkout-gates.spec.ts`; quote route now applies the same stock rules as `create_cod_order` (`insufficient_stock`, `quantity_exceeds_limit`) |
| 2.2 | Rs 360 + Rs 50 preserved; Rs 0 + Rs 0 valid "Free delivery"; unserved city blocked | PASS (local) / BLOCKED (final fee decision) | SQL matrix 37/37; `PKR 0 + 0 zone` spec; `shipping-zones.spec.ts`; launch-journey unserved city. Fee choice is the owner's |
| 2.3 | Transactional COD journey, idempotency, races, exact variant, stock, cancel/restock, cash only on collection | PASS (local) | `p0-variant-order-journey.spec.ts` (9: exact variant → order item → ledger −1, forged/non-UUID/sold-out/over-limit/draft refused, last-unit race 200/409, cancel restocks +1, no cash row); `test-cod-checkout-isolated` 32/32; `test-cod-concurrency` 16/16; `test-inventory-orders` 22/22; 36-step acceptance |
| 2.3 | Legal policies as a hard gate; no invented terms | BLOCKED | Gate enforced; policy text must come from the owner |
| 3 | Admin structurally separate (route groups), URLs unchanged | PASS | Route groups; isolation spec at 360–1440 |
| 3 | Sidebar, mobile nav, breadcrumbs, current account/role | PASS | Admin shell; `page-header` breadcrumbs |
| 3 | **Global search** | PASS (new) | `GET /api/admin/search` (role-scoped, no PII echo) + header dialog; `p0-admin-search.spec.ts` 4/4; `admin-search-term` unit |
| 3 | **Keyboard shortcuts where appropriate** | PASS (new) | Ctrl/⌘ K and "/" open search; ↑/↓/Enter/Esc; variant picker arrow keys; same spec |
| 3 | **Logout** | PASS (new) | `POST /api/admin/account/sign-out`; `p0-admin-sign-out.spec.ts` 4/4 (replayed cookies refused, cross-site 403) |
| 3 | Light/dark admin surfaces | NOT BUILT | Admin is light only; not attempted (design system frozen) |
| 4 | Product list, create/edit, variants (1–3 options), inventory desk, media, collections, CSV | PASS (local) | `test-merchant-catalog-smoke` 25/25; `test-shopify-csv-commit-smoke`; `p0-merchant-inventory-collections.spec.ts`; 36-step steps 1–9; variant matrix unit |
| 4 | Storefront variant picker: exact variant, 2D/3D options, missing option names, sold-out, no silent fallback | PASS (new) | `variant-picker` unit (options vs list mode, duplicates, missing names, resolveChoice); `p0-variant-order-journey.spec.ts`; availability RPC (migration 28) never exposes quantities |
| 4 | Bulk selection on the product list | PARTIAL | Separate bulk editor (`/admin/products/bulk`); no checkbox selection on the list itself |
| 5 | Reels (rights-gated, muted autoplay one at a time, reduced motion) | PASS (local) / BLOCKED (owner videos) | `p1-social-proof.spec.ts` reels tests; `p1-reels-reviews-blog.spec.ts`; SQL matrix 17/17 |
| 6 | Moderated genuine reviews | PASS (local) / BLOCKED (real reviews) | `p1-reels-reviews-blog.spec.ts`; column grants hide email/IP hash |
| 7 | Blog on `articles`; drafts hidden | PASS (local) | Same spec; 36-step step 24 |
| 7 | Scheduled publish | OPTIONAL — not built | Contract: "optional … if supported" |
| 8 | Truthful recent-order notice; zero orders ⇒ nothing; no PII | PASS (local) | `p1-social-proof.spec.ts` — deterministic baseline (seed clears local test orders; suites delete their orders; precondition enforced, no skip, no status flipping); exact counts (0, then 3 qualifying orders / 2 items, de-duplicated by product) |
| 8 | Data-backed "Top seller" vs editorial labels with schedule | PASS (local) | Same spec + `merchandising-matrix.sql` 15/15 + 36-step step 26–27 |
| 9 | Remove unwanted copy/counts/labels | PASS | `p1-storefront-labels.spec.ts` |
| 10 | Theme editor: RLS effective under direct access, draft/preview/publish/rollback, presets | PASS (local) | `test-theme-rls-matrix`, `test-theme-publish-smoke`, `theme-publish-workflow.spec.ts` 8/8 (draft preview no longer depends on example.com), 36-step steps 28–32 |
| 11 | Least-privilege RLS/grants per role incl. direct Data API | PASS (new fix) | **Migration 28** closes the pre-existing staff direct-write escalation; `security-direct-staff-access` 193/193 (was 133/193); `security-role-http` 126/126; role matrix 15/15; auth matrix 24/24; P0 probe 9/9 |
| 11 | Staff invitations, activation, reset, revocation | PASS | `p0-staff-invitations.spec.ts` 9 tests incl. reload persistence, duplicate/invalid/rate-limited failures and a pre-hydration regression test; repeated runs: Chromium 3× (24/24), Firefox 2× (16/16), WebKit 2× — one WebKit failure exposed the pre-hydration defect (fixed; re-verified in Chromium — WebKit not re-run after the fix); `password-recovery.spec.ts` |
| 11 | Leaked-password protection / MFA | BLOCKED | Supabase dashboard (owner) |
| 12 | Settings persistence, order desk, inquiries, analytics (placed/delivered/collected/outstanding/cancelled/returned), readiness dashboard | PASS (local) | `test-settings-navigation-persistence`; launch-journey order desk; analytics page metrics; readiness panel spec |
| 13 | 14-migration baseline + pending migrations; compatibility matrix; backup/restore rehearsal | PASS (local) | `migration-upgrade.sh`: clean == upgrade == local (sha256 `66a6e5f7…`, grants identical) for all 28; `backup-restore.sh`: per-table counts + md5 identical; matrix rows 15–28 |
| 13 | Apply to production | BLOCKED | Owner's written approval + fresh backup |
| 14 | V5 preserved; 360–1440 widths; keyboard; reduced motion | PASS (local) | Cross-browser 105/105 (Chromium, WebKit, Firefox × widths); no V5 visual change in this pass (only card image byte size) |
| 14 | Core Web Vitals measured, not invented | PARTIAL | Lighthouse lab runs in `docs/evidence/lighthouse-2026-11-16/summary.json` (after card-image sizing; hero images not yet sized); field data needs a deployment |
| 15.1 | Static: lint, tsc, build, audit | PASS | lint 0 errors (12 pre-existing warnings), tsc clean, build OK, `npm audit --omit=dev` clean |
| 15.2 | Unit tests | PASS | `npm run test:unit` incl. new `variant-picker`, `admin-search-term`, `image-url` |
| 15.3–15.10 | Direct RLS, merchant/customer/theme browser flows, reels, reviews/blog/social, production-safety negatives, cross-browser | PASS (local) | Final-run suites `e2e-isolated`, `e2e-legacy`, `e2e-crossbrowser`, security suites |
| 16–18 | Phased delivery, single handover, definition of done | See `LAPTOPS_HUB_ENGINEERING_CLOSEOUT.md` | Final classification there |
