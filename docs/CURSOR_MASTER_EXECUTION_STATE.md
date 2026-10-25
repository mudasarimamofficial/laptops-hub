# CURSOR MASTER EXECUTION STATE

**Updated:** 2026-10-25 (PKT) — theme publish/rollback verified · write-guard hardened · variant RPC  
**Mandate:** Enterprise merchant admin · Shopify CSV · site editor · COD-only  
**Branch:** `feat/merchant-operating-system`

---

## Verified baseline

| Item | Value |
|---|---|
| Branch HEAD | see `git log -1` (target after this push) |
| Prior GitHub HEAD at prompt | `baabd46` |
| `main` cut | `2b43236` |
| Supabase Production | `xvmmjkrkgznnakcobmww` — **14 migrations only** |
| Local Supabase | **17 migrations** incl. `20261025140000_theme_publish_variant_rpc.sql` |
| COD | OFF everywhere for Production |

---

## This milestone (P0 fixes)

### Theme publishing (FIXED)
- Publish **always** creates an immutable `published` snapshot via `publish_homepage_theme` RPC — draft IDs are never used as the live pointer
- Consistency check before success response
- Public logged-out read via `get_published_homepage_sections()` SECURITY DEFINER (no anon SELECT on theme_*)
- Rollback via `rollback_homepage_theme` + Customize UI history
- Draft preview page + unsaved warnings + viewport toggles
- Smoke: `npm run test:theme:publish` → **ok** (publish → second publish → rollback)

### Merchant write guard (HARDENED)
- Ports `local-only.mjs` identity checks (loopback URL + non-hosted JWT keys)
- Async endpoint probe rejects localhost tunnels (`sb-project-ref` header)
- `MERCHANT_WRITES_ALLOW_REMOTE` cannot target Production

### Variant sync (ATOMIC)
- `sync_product_variants` RPC — all-or-nothing; ordered variants disabled not deleted; cross-product IDs rejected

### CSV / Orders / Settings (P1 progress)
- Export formats: modern, legacy, LH extended, inventory sidecar, collection membership
- Orders: search + filters + admin shell styling
- Settings: business identity / inventory defaults / SEO form (no raw JSON as primary UI)

### Migrations (local only — NOT Production)
1. `20261025120000_merchant_catalog_extensions.sql`
2. `20261025130000_site_builder_sections.sql`
3. `20261025140000_theme_publish_variant_rpc.sql` ← new

---

## Honest completion status

| Capability | Status |
|---|---|
| Homepage 7 image presets + editor controls | Done (storefront + Customize) |
| Theme draft → preview → publish → public RPC → rollback | Done locally; needs `THEME_PUBLISHED_ENABLED=1` for visitor override |
| Preview→Prod write guard | Done (hardened) |
| Variant matrix atomic sync | Done (RPC) |
| Collections visual rules | Done |
| CSV modern/legacy/extended/inventory/collections export | Done |
| CSV import durable retry UX | Partial (local commit + dry-run; Production commit still blocked) |
| Orders merchant workflow | Improved list/search; detail actions already existed |
| Settings merchant form | Done for identity/inventory/SEO + shipping zones |
| Full authenticated Playwright admin suite | Chromium installed; homepage presets covered; full admin E2E still expanding |
| Production release package | Migrations listed; owner approval still required |

---

## Production boundaries (unchanged)

Never: Production migrate · Production CSV commit · theme publish to Prod · COD on · merge `main`

---

## Resume commands

```bash
git checkout feat/merchant-operating-system
npx supabase start
npx supabase db reset   # LOCAL ONLY — applies all 17 migrations
$env:NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
# + local ANON + SERVICE_ROLE from `npx supabase status`
$env:THEME_PUBLISHED_ENABLED="1"   # when verifying published theme on storefront
npm run test:theme:publish
npm run test:unit
npm run test:merchant:smoke
npx playwright install chromium
npx playwright test tests/e2e/homepage-presets.spec.ts
npm run build
git push -u origin feat/merchant-operating-system
```

## NEXT ACTION

1. Authenticated Playwright: Customize publish/rollback with THEME_PUBLISHED_ENABLED=1 + logged-out assert  
2. Expand admin E2E (product create, CSV round-trip, COD isolated)  
3. Import job history / retry UI polish  
4. Owner package: review 3 additive migrations for Production  
