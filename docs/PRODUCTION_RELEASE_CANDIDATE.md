# Production release candidate package (NOT applied)

**Branch:** `feat/merchant-operating-system`  
**Status:** Engineering release candidate for **owner approval** — do not apply without explicit sign-off.  
**Production project:** `xvmmjkrkgznnakcobmww` (currently 14 migrations)  
**COD:** remains OFF until separate business go-live approval.

## Migrations to review (additive, local-proven)

1. `20261025120000_merchant_catalog_extensions.sql` — soft-delete, option_names, media origin, collection_type, import job columns, inventory ledger  
2. `20261025130000_site_builder_sections.sql` — theme_templates / theme_versions / theme_publications (staff SELECT; anon revoked)  
3. `20261025140000_theme_publish_variant_rpc.sql` — publish/rollback/sync RPCs + `get_published_homepage_sections` public reader  
4. `20261025150000_theme_rls_inventory_hardening.sql` — draft RPC, immutability triggers, ledger on `sync_product_variants`  
5. `20261025160000_theme_immutability_service_role.sql` — remove service_role bypass so published snapshots need RPC flags

### Schema compatibility

- App builds without these migrations still degrade gracefully (code V5 homepage defaults; Customize shows migrationRequired).  
- After migrate: enable `THEME_PUBLISHED_ENABLED=1` only when ready for published themes to affect visitors.  
- Merchant writes from Vercel Preview against Production remain server-blocked.

### RLS / grants / RPC matrix (verified locally)

| Actor | theme SELECT | draft save RPC | publish/rollback RPC | direct theme DML | public homepage RPC |
|---|---|---|---|---|---|
| anon | denied | denied | denied | denied | `get_published_homepage_sections` only |
| editor | yes | yes | denied | denied | n/a |
| manager / fulfillment | yes | denied | denied | denied | n/a |
| owner / admin | yes | yes | yes | denied (triggers) | n/a |
| service_role (no flag) | yes | via RPC | via RPC | **blocked** on published/draft/publications | n/a |
| revoked / plain user | denied/no draft | denied | denied | denied | n/a |

Evidence: `node scripts/test-theme-rls-matrix.mjs` → **ok** (incl. service_role immutability).

## Backup / rollback

1. Take a Production database backup / PITR checkpoint before migrate.  
2. Migrations are additive (new columns/tables/functions). Dropping functions/tables is possible but would require a coordinated app rollback to a pre-theme commit.  
3. Theme publication can be rolled back via `rollback_homepage_theme` without dropping tables.  
4. Do not reverse soft-delete columns if any Production rows use them.  
5. Inventory ledger rows created after migrate should not be deleted casually — they are the audit trail.

## Post-migration verification

1. `SELECT count(*) FROM theme_templates;` → ≥1 homepage template  
2. Anon REST SELECT on `theme_versions` → empty/denied  
3. Owner Customize → draft save → publish → logged-out `/` with `THEME_PUBLISHED_ENABLED=1` shows snapshot  
4. Direct UPDATE on a `published` theme_versions row → `immutable_published_theme`  
5. `sync_product_variants` qty change → matching `inventory_ledger` delta  

## Protected Preview verification

- Push feature branch → Vercel Preview.  
- Merchant CSV commit / theme publish / catalog writes remain blocked against Production host.  
- Visual: homepage seven CDN presets + V5 animation classes intact when published payload matches defaults.

## Owner approval checklist

- [ ] SQL reviewed (all five files above)  
- [ ] Backup confirmed  
- [ ] Preview verified on isolated DB (not mutating Production)  
- [ ] COD gates remain off  
- [ ] Explicit written approval to apply migrations  
- [ ] Explicit approval before first Production theme publish  

## Out of scope for this package

- Enabling Production COD  
- Merging to `main` without approval  
- Production CSV import commits  
- Rehosting Shopify CDN media into Supabase Storage  

## Outstanding business-only blockers

- Owner Production migration approval  
- Real support email/phone / shipping zone fees for live markets  
- COD go-live decision (dual env + setting gates)  
- Staff owner account on Production  
- Legal/policy copy still pending where `PendingBlock` / `data/lh-content.js` markers remain  
