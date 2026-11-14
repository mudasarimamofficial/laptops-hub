# CURSOR MASTER EXECUTION STATE

> **2026-11-14 third pass (Claude):** adds truthful social proof and reel playback on top of `3dae91a`: recent-order notices
> and a data-backed "Top seller" badge computed only from real confirmed/delivered orders (both OFF by default, no demo mode,
> no PII in the public payload); editorial "Featured / Popular pick / Staff pick" labels with schedules (Admin → Badges & social
> proof); reels now play the visible clip muted, one at a time, with explicit sound, reduced-motion/data-saver fallbacks and a
> consent-gated creator name. New local-only migration `20261116100000_merchandising_badges_and_reel_details.sql` (**8 pending**
> for production). Evidence: isolated Playwright 57/57, unit 27 files, SQL matrices 26/26 + 17/17 + 15/15. Vercel production
> re-verified read-only (still `cb638b7`); Supabase production still NOT re-verified (MCP denied, CLI unlinked).

> **2026-11-14 release-candidate pass (Claude):** HEAD on `feat/merchant-operating-system` after `a534b18` + docs. Admin/storefront
> separated by route groups; server-side checkout readiness gates; deliberate Rs 0 + Rs 0 = "Free delivery", blank fee rejected;
> storefront counts/section numbers/angle counters hidden by default (owner toggle); fonts self-hosted (fixes fresh builds);
> local-only migrations `20261114100000_function_search_path_hardening.sql` and `20261115100000_reels_and_product_reviews.sql` (7 pending for production); rights-gated reels, moderated reviews and an Admin → Blog editor built and tested locally (isolated 52/52).
> Status: **READY FOR OWNER APPROVAL — NOT YET LIVE-COMMERCE CERTIFIED.** Production unchanged; Supabase production not
> re-verified this pass. Start with `docs/LAPTOPS_HUB_CLIENT_REQUESTS_ACCEPTANCE_MATRIX.md`, then
> `docs/LAPTOPS_HUB_MIGRATION_AND_RELEASE_RUNBOOK.md`. Baseline dirty tree preserved in `stash@{0}`.


**Updated:** 2026-10-25 (PKT) — theme RLS hardened · Playwright theme workflow 8/8 · inventory ledger · merchant E2E  
**Mandate:** Enterprise merchant admin · Shopify CSV · site editor · COD-only  
**Branch:** `feat/merchant-operating-system`

---

## Verified baseline

| Item | Value |
|---|---|
| Branch | `feat/merchant-operating-system` |
| Supabase Production | `xvmmjkrkgznnakcobmww` — **14 migrations only** |
| Local Supabase | **19 migrations** through `20261025160000_theme_immutability_service_role.sql` |
| COD | OFF everywhere for Production |

---

## This milestone (security + integration pass)

### Theme RLS (FIXED)
- Authenticated: SELECT only on theme_*  
- Drafts via `save_homepage_draft` (owner/admin/editor)  
- Publish/rollback via RPCs (owner/admin) with section/URL validation  
- Published + draft rows immutable without `app.theme_mutation` flag — **including service_role**  
- Public: `get_published_homepage_sections` only  
- Draft preview uses `localStorage` (noopener-safe)

### Playwright theme workflow (VERIFIED)
`tests/e2e/theme-publish-workflow.spec.ts` **8/8** against local Next `:3001` + `THEME_PUBLISHED_ENABLED=1`:
seed → public A → draft save (public unchanged) → draft preview → publish → public B → immutable → rollback → editor publish denied → seven CDN presets

### Inventory ledger (VERIFIED)
`sync_product_variants` writes ledger deltas; `node scripts/test-inventory-ledger-sync.mjs` → **ok**

### Merchant admin Playwright (VERIFIED)
`tests/e2e/merchant-admin-workflows.spec.ts` **9/9**: product create, variants shell, collections, import history UI, settings, admin shells, role gates, desktop/mobile

### Import history / retry UX (DONE)
- `GET /api/admin/products/import/jobs`  
- `ImportJobHistory` + retry restores strategy and prompts for same CSV fingerprint  

### Migrations (local only — NOT Production)
1. `20261025120000_merchant_catalog_extensions.sql`  
2. `20261025130000_site_builder_sections.sql`  
3. `20261025140000_theme_publish_variant_rpc.sql`  
4. `20261025150000_theme_rls_inventory_hardening.sql`  
5. `20261025160000_theme_immutability_service_role.sql`  

---

## Honest completion status

| Capability | Status |
|---|---|
| Homepage 7 image presets + editor | Done |
| Theme draft → preview → publish → rollback (browser) | Done (8/8) |
| Theme RLS direct DB matrix | Done (`test-theme-rls-matrix.mjs`) |
| Preview→Prod write guard | Done |
| Variant matrix + inventory ledger | Done |
| CSV import history / retry UX | Done (local persist) |
| Merchant admin Playwright suite | Expanded (not every COD click path in this file — see e2e-isolated launch journeys) |
| Full COD lifecycle browser | Covered by `tests/e2e-isolated/launch-journey.spec.ts` when isolated fixture seeded |
| Production release package | Ready for owner approval |

---

## Production boundaries (unchanged)

Never: Production migrate · Production CSV commit · theme publish to Prod · COD on · merge `main`

---

## Resume commands

```bash
git checkout feat/merchant-operating-system
npx supabase start
npx supabase db reset   # LOCAL ONLY
$env:NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
$env:THEME_PUBLISHED_ENABLED="1"
# start Next on :3001 with local keys
npx playwright test theme-publish-workflow merchant-admin-workflows homepage-presets --config=playwright.config.ts
node scripts/test-theme-rls-matrix.mjs
node scripts/test-inventory-ledger-sync.mjs
```

## NEXT ACTION (owner)

1. Review `docs/PRODUCTION_RELEASE_CANDIDATE.md`  
2. Approve Production migration apply (separate written approval)  
3. Approve first Production theme publish / COD separately  
