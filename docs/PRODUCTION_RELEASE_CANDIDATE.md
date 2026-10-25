# Production Release Candidate Package (Gated — Pending Owner Approval)

**Branch:** `feat/merchant-operating-system`  
**Current Baseline Commit:** `b92391476b64ae44b7b9ea7513be643b6cd67e24` (plus post-handover blocker corrections)  
**Target Branch:** `main` (`2b43236671983f22ed8766fc765addf4ea44a7d3`)  
**Production Supabase Ref:** `xvmmjkrkgznnakcobmww` (strictly 14 migrations currently applied; zero unapproved mutations)  
**Production Commerce URL:** `https://laptops-hub.vercel.app`  
**COD Launch Status:** STRICTLY OFF via dual gates (`COD_CHECKOUT_ENABLED=false` in environment and `store_settings.cod_checkout.enabled=false` in database).

---

## 1. Summary of Release Candidate

This release package promotes the Laptops HUB storefront from a fixed-layout prototype to a full enterprise Merchant Operating System. It delivers:
1. **Full Merchant Administration:** Products, options, variant matrix, inventory tracking, inventory ledger, collections with visual AND/OR rules, product media management, and no-code store navigation.
2. **Shopify CSV Interoperability:** Modern and legacy profile detection, dry-run previews with change reconciliation, conflict resolution strategies, owner/admin Production commit path with preview fingerprint confirmation, idempotent re-import skips, import history/retry UI, and 5 distinct export profiles.
3. **Storefront Visual Editor & Theme Engine:** Visual customization for the approved V5 homepage sections, draft-preview sandboxing, immutable published snapshots, instant rollback, emergency publication kill switch, and persistent resolution of the 7 approved remote WebP homepage presets.
4. **No-Code Navigation Management:** Full interactive editor for header, mobile drawer, and footer columns with destination pickers (collections, products, CMS pages), runtime safety checks (`isSafeDestinationUrl`), public policy link gating (`isLinkPublic`), atomic settings persistence, and restore V5 defaults.
5. **Hardened Security & Isolation:** Database-level RLS on `admin_memberships`, trigger-enforced immutability against `service_role` tampering, actor impersonation prevention, and strict Preview-to-Production write blocking (`assertMerchantMutationAllowedAsync`).
6. **COD-Only Sales System:** Strict server-authoritative checkout calculations, idempotent order creation, availability verification workflows, and distinct financial cash-collection ledgering.

---

## 2. Machine-Verified Test Evidence

| Test Suite / Tool | Command | Scope / Coverage | Verified Result |
|---|---|---|---|
| **Unit Test Suite** | `npm run test:unit` | Money, phone, staff auth, HTML sanitization, specs, cart limits, contact, inquiry, links, recovery, Shopify CSV/export, variant matrix, presets, navigation config/safety | **23/23 PASSED** |
| **Theme RLS Matrix** | `node scripts/test-theme-rls-matrix.mjs` | Anon denied; staff SELECT only; direct writes denied; editor draft save allowed; owner publish allowed; immutable published snapshot even against service_role; anon public RPC returns published sections only; admin rollback verified; revoked staff denied; actor spoofing denied | **7/7 GATES PASSED** |
| **Inventory Ledger Sync** | `node scripts/test-inventory-ledger-sync.mjs` | Variant stock sync, delta ledger calculation (`delta: 7, after: 12`), and negative stock rejection | **PASSED** |
| **Theme Publish Smoke** | `node scripts/test-theme-publish-smoke.mjs` | Draft save, publication snapshot creation, second version archiving, and rollback pointer | **PASSED** |
| **Shopify CSV Commit** | `npm run test:merchant:csv` | Modern CSV staging, dry-run, real local commit (2 products, 3 media rows), idempotent reimport skip (2 skipped) | **PASSED** |
| **Merchant Catalog Smoke** | `npm run test:merchant:smoke` | 25 distinct catalog, variant, collection, and inventory operational assertions | **25/25 PASSED** |
| **COD Concurrency** | `node scripts/test-cod-concurrency.mjs` | Burst concurrent submissions with same key, replay after completion, cross-order race conditions, and distinct keys | **16/16 PASSED** |
| **Security Role Matrix** | `node scripts/security-role-matrix.mjs http://127.0.0.1:3001` | Role-based endpoint authorization across owner, admin, editor, manager, fulfillment, anon, and revoked staff | **15/15 PASSED** |
| **COD Isolated Checkout** | `node scripts/test-cod-checkout-isolated.mjs` | Forged price rejection, unpaid COD state, idempotent replay, tracked oversell rejection, anonymous restrictions, server quote verification | **23/23 PASSED** |
| **Settings & Navigation Persistence** | `node scripts/test-settings-navigation-persistence.mjs` | Settings initial write, partial merge preservation, 400 validation, 401 unauth rejection, custom navigation persistence, 400 unsafe URL rejection, restore defaults, public storefront layout rendering | **8/8 PASSED** |
| **Playwright Theme E2E** | `npx playwright test tests/e2e/theme-publish-workflow.spec.ts` | Authenticated browser test: seed draft, private draft isolation, preview iframe, one-click publish, logged-out storefront update, instant rollback, editor publish denial, 7 CDN presets | **8/8 PASSED** |
| **Playwright Admin E2E** | `npx playwright test tests/e2e/merchant-admin-workflows.spec.ts tests/e2e/homepage-presets.spec.ts` | Product creation, variant matrix, collections builder, CSV import history UI, store settings form, navigation editor, inventory & orders shells, role-based navigation guards, responsive mobile drawer | **10/10 PASSED** |
| **Public Copy Crawler** | `node scripts/check-public-copy.mjs https://laptops-hub.vercel.app` | 289 public URLs crawled on live production: zero "BEING FINALISED" or placeholder copy, zero broken links | **289 PATHS CLEAN** |
| **Production Build** | `npm run build` | Next.js 16 Turbopack build, TypeScript typecheck (0 errors), 37 static pages generated | **BUILD CLEAN** |
| **7 Approved WebP Presets** | HTTP HEAD probe | Dell hero, HP hero, Lenovo hero, Front story, Left story, Right story, Rear story | **7/7 HTTP 200 OK** |

---

## 3. The Five Additive Enterprise Migrations

Production currently contains 14 applied migrations (through `20261024100000_notification_outbox_lease.sql`). The 5 enterprise migrations to be reviewed and approved in exact sequential order:

1. `supabase/migrations/20261025120000_merchant_catalog_extensions.sql`
   - **Scope:** Adds `deleted_at` (soft-delete), `option_names`, `seo_title`, `seo_description` to `products`; adds `barcode`, `inventory_mode`, `allow_oversell`, `option_values` to `product_variants`; adds `origin`, `rights_status` to `product_media`; adds `collection_type`, `rules_operator`, `rules` to `collections`; creates `inventory_ledger` audit table; adds CSV import tracking columns to `import_jobs`.
   - **Existing Data Compatibility:** All added columns have default values or are nullable. No existing rows are modified or dropped.
   - **Public Read Boundaries:** RLS policies maintain public read access to active products/variants/collections while restricting `inventory_ledger` and `import_jobs` to authenticated staff.
2. `supabase/migrations/20261025130000_site_builder_sections.sql`
   - **Scope:** Creates `theme_templates`, `theme_versions`, `theme_publications`. Seeds the default V5 homepage sections.
   - **Grants & RLS:** Explicitly revokes all permissions from `anon` and `authenticated`. Public visitors cannot read draft versions.
3. `supabase/migrations/20261025140000_theme_publish_variant_rpc.sql`
   - **Scope:** Defines `get_published_homepage_sections(p_template_key)` (SECURITY DEFINER) for public storefront rendering, returning published sections only. Defines `publish_homepage_theme`, `rollback_homepage_theme`, and `sync_product_variants` RPCs.
   - **Role Check:** Verifies caller membership against `public.admin_memberships`.
4. `supabase/migrations/20261025150000_theme_rls_inventory_hardening.sql`
   - **Scope:** Defines `save_homepage_draft` RPC with HTTPS image URL validation; implements strict role verification against `admin_memberships`; synchronizes variant quantity deltas directly into `inventory_ledger`; attaches `theme_versions_immutability` and `theme_publications_guard` triggers to block direct table updates to published/archived versions.
5. `supabase/migrations/20261025160000_theme_immutability_service_role.sql`
   - **Scope:** Hardens immutability so that even direct DML via `service_role` is rejected unless the internal RPC session flag `app.theme_mutation = 'authorized'` is set.

---

## 4. Supabase Verified Backup and Restore Procedure

Do not assume point-in-time recovery (PITR) or one-click automated backups are active on the Supabase project. Follow this verified standard procedure:

### 4.1 Pre-Migration Backup Procedure
1. **Schema & Data Dump via pg_dump:**
   Obtain the direct PostgreSQL connection string from the Supabase Dashboard:  
   **Settings → Database → Connection string (URI / direct connection on port 5432 or pooler on port 6543)**.
   Run the full dump locally or in a secure admin workstation:
   ```bash
   pg_dump "postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres" \
     --clean \
     --if-exists \
     --quote-all-identifiers \
     --no-owner \
     --no-privileges \
     --file="laptops_hub_production_pre_migration_backup_$(date +%Y%m%d_%H%M%S).sql"
   ```
2. **Schema-Only Dump (Quick Verification):**
   ```bash
   pg_dump "postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres" \
     --schema-only \
     --file="laptops_hub_production_schema_only_backup_$(date +%Y%m%d_%H%M%S).sql"
   ```
3. **Verify Dump Integrity:**
   Ensure the output file is non-empty, contains `CREATE TABLE public.products`, and ends with valid transaction closure statements. Store the backup in secure cold storage.

### 4.2 Rollback Capabilities & Boundaries
- **What Vercel Rollback Can Reverse:**
  - Instantly reverts the running application code to the prior commit (`2b43236`).
  - Reverts client-side bundles, API routing, server-rendered components, and static assets.
  - Forward-compatibility verified: The current production application (`2b43236`) remains fully functional against the migrated database schema because all 5 migrations are additive (new columns have defaults or are nullable; new tables and RPCs are ignored by older code).
- **What Database Rollback Cannot Automatically Reverse:**
  - Applying migrations creates tables (`theme_templates`, `theme_versions`, `theme_publications`, `inventory_ledger`) and adds columns (`deleted_at`, `inventory_mode`, etc.).
  - A code rollback in Vercel does **NOT** alter the database schema or reverse rows written to new tables.
  - If a database restore is required, it must be performed explicitly by restoring from the pre-migration `pg_dump` file using `psql`, or by running a dedicated reverse-migration script.

---

## 5. Separated Production Approval Checkpoints

In strict adherence to governance policy, production release actions are divided into five distinct approval gates:

- [ ] **Approval A — Production Backup & Database Migration:**
  - Verify completion of pre-migration `pg_dump`.
  - Authorize application of the 5 enterprise migrations (`20261025120000` through `20261025160000`) to Supabase Production (`xvmmjkrkgznnakcobmww`).
- [ ] **Approval B — Feature Branch Merge & Production Deployment:**
  - Review and merge `feat/merchant-operating-system` into `main`.
  - Trigger single verified Production deployment on Vercel.
- [ ] **Approval C — First Production Theme Publication:**
  - Set `THEME_PUBLISHED_ENABLED=1` in Vercel Production Environment Variables.
  - Log into `/admin/online-store` as Owner and trigger the first official snapshot publication.
- [ ] **Approval D — Controlled COD Test Order:**
  - Place one internal staff test order using a designated staff phone number to verify quote computation, order creation, notification dispatch, and fulfillment lifecycle without customer exposure.
- [ ] **Approval E — Public Cash on Delivery Activation:**
  - Grant final written authorization to enable public customer checkout.
  - Set `COD_CHECKOUT_ENABLED=true` in Vercel Production Environment Variables.
  - Set `store_settings.cod_checkout.enabled=true` in Admin Settings.

