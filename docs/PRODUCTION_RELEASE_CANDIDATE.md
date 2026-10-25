# Production release candidate package (NOT applied)

**Branch:** `feat/merchant-operating-system`  
**Status:** Engineering release candidate for **owner approval** — do not apply without explicit sign-off.  
**Production project:** `xvmmjkrkgznnakcobmww` (currently 14 migrations)  
**COD:** remains OFF until separate business go-live approval.

## Migrations to review (additive, local-proven)

1. `20261025120000_merchant_catalog_extensions.sql` — soft-delete, option_names, media origin, collection_type, import job columns, inventory ledger  
2. `20261025130000_site_builder_sections.sql` — theme_templates / theme_versions / theme_publications (staff RLS; anon revoked)  
3. `20261025140000_theme_publish_variant_rpc.sql` — publish/rollback/sync RPCs + `get_published_homepage_sections` public reader

## Compatibility

- App builds without these migrations still degrade gracefully (code V5 homepage defaults; Customize shows migrationRequired).  
- After migrate: enable `THEME_PUBLISHED_ENABLED=1` only when ready for published themes to affect visitors.  
- Merchant writes from Vercel Preview against Production remain server-blocked.

## Backup / rollback

1. Take a Production database backup / PITR checkpoint before migrate.  
2. Migrations are additive (new columns/tables/functions). Dropping functions/tables is possible but would require a coordinated app rollback to a pre-theme commit.  
3. Theme publication can be rolled back via `rollback_homepage_theme` without dropping tables.  
4. Do not reverse soft-delete columns if any Production rows use them.

## Owner approval checklist

- [ ] SQL reviewed  
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
