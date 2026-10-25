# CURSOR MASTER EXECUTION STATE

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
