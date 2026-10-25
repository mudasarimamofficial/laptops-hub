# Production Release Candidate Package (Gated — Pending Owner Approval)

**Branch:** `feat/merchant-operating-system`  
**Current Commit SHA:** `b92391476b64ae44b7b9ea7513be643b6cd67e24` (plus local release updates)  
**Target Branch:** `main` (last known: `2b43236671983f22ed8766fc765addf4ea44a7d3`)  
**Production Supabase Ref:** `xvmmjkrkgznnakcobmww` (strictly 14 migrations currently applied; 0 mutations performed)  
**Production Commerce URL:** `https://laptops-hub.vercel.app`  
**COD Launch Status:** STRICTLY OFF via dual gates (`COD_CHECKOUT_ENABLED=false` in environment and `app_config.cod_enabled=false` in database).

---

## 1. Summary of Release Candidate

This release package promotes the Laptops HUB storefront from a fixed-layout prototype to a full enterprise Merchant Operating System. It delivers:
1. **Full Merchant Administration:** Products, options, variant matrix, inventory tracking, inventory ledger, collections with visual AND/OR rules, product media management, and store navigation.
2. **Shopify CSV Interoperability:** Modern and legacy profile detection, dry-run previews, conflict resolution strategies, idempotent re-import skips, import history/retry UI, and 5 distinct export profiles.
3. **Storefront Visual Editor & Theme Engine:** Visual customization for the approved V5 homepage sections, draft-preview sandboxing, immutable published snapshots, instant rollback, and persistent resolution of the 7 approved remote WebP homepage presets.
4. **Hardened Security & Isolation:** Database-level RLS, trigger-enforced immutability against `service_role` tampering, actor impersonation prevention, and strict Preview-to-Production write blocking (`assertMerchantMutationAllowedAsync`).
5. **COD-Only Sales System:** Strict server-authoritative checkout calculations, idempotent order creation, availability verification workflows, and distinct financial cash-collection ledgering.

---

## 2. Machine-Verified Test Evidence

| Test Suite / Tool | Command | Scope / Coverage | Verified Result |
|---|---|---|---|
| **Unit Test Suite** | `npm run test:unit` | Money, phone, staff auth, HTML sanitization, specs, cart limits, contact, inquiry, links, recovery, Shopify CSV/export, variant matrix, presets | **22/22 PASSED** |
| **Theme RLS Matrix** | `node scripts/test-theme-rls-matrix.mjs` | Anon denied; staff SELECT only; direct writes denied; editor draft save allowed; owner publish allowed; immutable published snapshot even against service_role; anon public RPC returns published sections only; admin rollback verified; revoked staff denied; actor spoofing denied | **7/7 GATES PASSED** |
| **Inventory Ledger Sync** | `node scripts/test-inventory-ledger-sync.mjs` | Variant stock sync, delta ledger calculation (`delta: 7, after: 12`), and negative stock rejection | **PASSED** |
| **Theme Publish Smoke** | `node scripts/test-theme-publish-smoke.mjs` | Draft save, publication snapshot creation, second version archiving, and rollback pointer | **PASSED** |
| **Shopify CSV Commit** | `npm run test:merchant:csv` | Modern CSV staging, dry-run, real local commit (2 products, 3 media rows), idempotent reimport skip (2 skipped) | **PASSED** |
| **Merchant Catalog Smoke** | `npm run test:merchant:smoke` | 25 distinct catalog, variant, collection, and inventory operational assertions | **25/25 PASSED** |
| **COD Concurrency** | `node scripts/test-cod-concurrency.mjs` | Burst concurrent submissions with same key, replay after completion, cross-order race conditions, and distinct keys | **16/16 PASSED** |
| **Security Role Matrix** | `node scripts/security-role-matrix.mjs http://127.0.0.1:3001` | Role-based endpoint authorization across owner, admin, editor, manager, fulfillment, anon, and revoked staff | **15/15 PASSED** |
| **COD Isolated Checkout** | `node scripts/test-cod-checkout-isolated.mjs` | Forged price rejection, unpaid COD state, idempotent replay, tracked oversell rejection, anonymous restrictions, server quote verification | **23/23 PASSED** |
| **Playwright Theme E2E** | `npx playwright test tests/e2e/theme-publish-workflow.spec.ts` | Authenticated browser test: seed draft, private draft isolation, preview iframe, one-click publish, logged-out storefront update, instant rollback, editor publish denial, 7 CDN presets | **8/8 PASSED** |
| **Playwright Admin E2E** | `npx playwright test tests/e2e/merchant-admin-workflows.spec.ts tests/e2e/homepage-presets.spec.ts` | Product creation, variant matrix, collections builder, CSV import history UI, store settings form, navigation editor, inventory & orders shells, role-based navigation guards, responsive mobile drawer | **10/10 PASSED** |
| **Public Copy Crawler** | `node scripts/check-public-copy.mjs https://laptops-hub.vercel.app` | 289 public URLs crawled on live production: zero "BEING FINALISED" or placeholder copy, zero broken links | **289 PATHS CLEAN** |
| **Production Build** | `npm run build` | Next.js 16 Turbopack build, TypeScript typecheck (0 errors), 37 static pages generated | **BUILD CLEAN** |
| **7 Approved WebP Presets** | HTTP HEAD probe | Dell hero, HP hero, Lenovo hero, Front story, Left story, Right story, Rear story | **7/7 HTTP 200 OK** |

---

## 3. The Five Additive Enterprise Migrations

Production currently contains 14 applied migrations (through `20261024100000_notification_outbox_lease.sql`). The 5 enterprise migrations to be reviewed and approved:

1. `supabase/migrations/20261025120000_merchant_catalog_extensions.sql`
   - Adds `deleted_at` (soft-delete), `option_names`, `seo_title`, `seo_description` to `products`.
   - Adds `barcode`, `inventory_mode`, `allow_oversell`, `option_values` to `product_variants`.
   - Adds `origin`, `rights_status` to `product_media`.
   - Adds `collection_type`, `rules_operator`, `rules` to `collections`.
   - Creates `inventory_ledger` audit table.
   - Adds CSV import tracking columns to `import_jobs`.
2. `supabase/migrations/20261025130000_site_builder_sections.sql`
   - Creates `theme_templates`, `theme_versions`, `theme_publications`.
   - Seeds the default V5 homepage sections.
   - Revokes anon access; grants authenticated staff SELECT.
3. `supabase/migrations/20261025140000_theme_publish_variant_rpc.sql`
   - Defines `get_published_homepage_sections(p_template_key)` for anonymous storefront rendering.
   - Defines `publish_homepage_theme`, `rollback_homepage_theme`, and `sync_product_variants` RPCs.
4. `supabase/migrations/20261025150000_theme_rls_inventory_hardening.sql`
   - Defines `save_homepage_draft` RPC with HTTPS image URL validation.
   - Implements strict role verification against `staff_memberships`.
   - Synchronizes variant quantity deltas directly into `inventory_ledger`.
   - Attaches `theme_immutability_guard` trigger to prevent direct table updates to published/archived versions.
5. `supabase/migrations/20261025160000_theme_immutability_service_role.sql`
   - Hardens immutability so that even direct DML via `service_role` is rejected unless the internal RPC session flag `app.theme_mutation = 'authorized'` is set.

---

## 4. Rollback and Disaster Recovery Plan

1. **Pre-Migration Snapshot:**
   - Execute a manual backup / PITR export of the Supabase Production project (`xvmmjkrkgznnakcobmww`) via the Supabase dashboard prior to running migrations.
2. **Schema Rollback:**
   - The 5 migrations are strictly additive (new tables, columns, and RPC functions). Existing customer orders, active catalog listings, and historical outbox rows are completely untouched.
   - If an unexpected error occurs during migration, Supabase wraps migration execution in a transaction, rolling back automatically.
3. **Application Rollback:**
   - If deployment rollback is needed, Vercel supports instant deployment rollback to the previous deployment (`2b43236`).
   - The existing production code (`2b43236`) ignores the new tables and continues serving the frozen V5 storefront without disruption.
4. **Theme Rollback:**
   - If an undesirable theme change is published, staff can instantly restore the previous version using the "Rollback" button in `/admin/online-store` without touching code or database schema.

---

## 5. Owner Approval Checkpoints (Gated)

Execution of production operations must occur in distinct, explicitly authorized steps:

- [ ] **Approval A — Database Migration:** Apply the 5 enterprise migrations (`20261025120000` through `20261025160000`) to Supabase Production (`xvmmjkrkgznnakcobmww`).
- [ ] **Approval B — Code Deployment:** Merge `feat/merchant-operating-system` to `main` and deploy to Vercel Production.
- [ ] **Approval C — Catalog Import:** Authorize import of the official merchant Shopify CSV catalog into Production.
- [ ] **Approval D — Storefront Theme Publication:** Set `THEME_PUBLISHED_ENABLED=1` in Vercel Production environment variables.
- [ ] **Approval E — Controlled Test Order:** Place one controlled, internal test COD order to verify real SMS/email notifications and order outbox processing.
- [ ] **Approval F — Live COD Launch:** Enable live Cash on Delivery ordering for public customers (`COD_CHECKOUT_ENABLED=true` and database setting enabled).
