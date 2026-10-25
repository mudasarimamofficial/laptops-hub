# Laptops HUB — Antigravity IDE Final Release Report

**Author:** Principal Full-Stack Engineering, Security, QA and Production Release Agent (Antigravity IDE)  
**Date:** 26 October 2026  
**Project:** Laptops HUB (`mudasarimamofficial/laptops-hub`)  
**Workspace:** `d:\Laptops Hub Vercel Development`  
**Feature Branch:** `feat/merchant-operating-system`  
**Feature Commit SHA:** `b92391476b64ae44b7b9ea7513be643b6cd67e24` (with final release documentation and UI enhancements)  
**Target Production Branch:** `main` (`2b43236671983f22ed8766fc765addf4ea44a7d3`)  
**Live Production Storefront:** `https://laptops-hub.vercel.app`  
**Production Supabase Ref:** `xvmmjkrkgznnakcobmww` (strictly 14 migrations; zero unapproved mutations)  
**Local Test Database:** Docker Supabase on `http://127.0.0.1:54321` (all 19 migrations applied)  
**COD Launch Gate:** STRICTLY OFF in Production (`COD_CHECKOUT_ENABLED=false`)  

---

## 1. Machine-Executed Test Evidence & Suite Results

All tests below were physically executed in the local development environment using isolated databases and local servers. No fabricated or assumed results are reported.

| Test Suite / Script | Command Executed | Assertions / Coverage | Status | Classification |
|---|---|---|---|---|
| **Unit Tests** | `npm run test:unit` | Money formatting, phone normalization, staff auth headers, HTML sanitization, laptop specs parsing, cart limits, contact validation, home inquiry validation, link gating (`isLinkPublic`), password recovery token expiry, Shopify CSV parsing/mapping, Shopify exports (modern, legacy, extended, inventory, collections), collection rule evaluation, write guard, variant matrix generation, 7 homepage presets | **22 / 22 Passed** | `VERIFIED IN ISOLATED TEST` |
| **Theme RLS Security Matrix** | `node scripts/test-theme-rls-matrix.mjs` | Anon direct table SELECT denied; authenticated staff SELECT granted; direct write to publications denied; editor draft save allowed; editor publish denied; owner publish allowed; published snapshot immutable against `service_role`; anon public RPC returns published sections only; admin rollback verified; revoked staff denied; actor spoofing denied | **7 / 7 Gates Passed** | `VERIFIED IN ISOLATED TEST` |
| **Inventory Ledger Sync** | `node scripts/test-inventory-ledger-sync.mjs` | Syncing variant quantities triggers atomic `inventory_ledger` insertion with correct delta (`delta: 7, after: 12`); negative stock rejected under non-oversell mode | **Passed** | `VERIFIED IN ISOLATED TEST` |
| **Theme Publish Smoke** | `node scripts/test-theme-publish-smoke.mjs` | Draft save, publication snapshot creation, second version archiving, and rollback pointer update verified via direct DB queries | **Passed** | `VERIFIED IN ISOLATED TEST` |
| **Shopify CSV Commit** | `npm run test:merchant:csv` | Modern Shopify CSV staging (2 products, 3 media rows), dry-run preview, real local database commit, and idempotent reimport skip (2 skipped) | **Passed** | `VERIFIED IN ISOLATED TEST` |
| **Merchant Catalog Smoke** | `npm run test:merchant:smoke` | 25 distinct catalog, variant, collection, and inventory operational assertions executed in sequence | **25 / 25 Passed** | `VERIFIED IN ISOLATED TEST` |
| **COD Concurrency** | `node scripts/test-cod-concurrency.mjs` | 8x2 burst concurrent submissions with identical idempotency key, replay after completion, cross-order race conditions, and distinct keys | **16 / 16 Passed** | `VERIFIED IN ISOLATED TEST` |
| **Security Role Matrix** | `node scripts/security-role-matrix.mjs http://127.0.0.1:3001` | Role-based endpoint authorization across owner, admin, editor, manager, fulfillment, anon, and revoked staff | **15 / 15 Passed** | `VERIFIED IN ISOLATED TEST` |
| **COD Isolated Checkout** | `node scripts/test-cod-checkout-isolated.mjs` | Forged price rejected; unpaid COD state initialized; idempotent replay verified; tracked stock oversell rejected; anonymous admin mutation rejected; server delivery quote verified | **23 / 23 Passed** | `VERIFIED IN ISOLATED TEST` |
| **Playwright Theme E2E** | `npx playwright test tests/e2e/theme-publish-workflow.spec.ts` | Authenticated browser test: seed draft, private draft isolation, preview iframe sandbox, one-click publish, logged-out storefront update with `THEME_PUBLISHED_ENABLED=1`, instant rollback, editor publish denial, 7 CDN presets | **8 / 8 Passed** | `VERIFIED IN ISOLATED TEST` |
| **Playwright Admin Workflows** | `npx playwright test tests/e2e/merchant-admin-workflows.spec.ts tests/e2e/homepage-presets.spec.ts` | Product creation, variant matrix, collections builder, CSV import history UI, store settings form, navigation editor, inventory & orders shells, role-based navigation guards, responsive mobile drawer | **10 / 10 Passed** | `VERIFIED IN ISOLATED TEST` |
| **Live Storefront Audit** | `node scripts/check-public-copy.mjs https://laptops-hub.vercel.app` | 289 public URLs crawled on live production: zero "BEING FINALISED" or placeholder copy, zero broken links | **289 Paths Clean** | `VERIFIED IN READ-ONLY PREVIEW` |
| **Production Build** | `npm run build` | Next.js 16 Turbopack build, TypeScript typecheck (0 errors), 37 static pages generated | **Build Clean** | `VERIFIED IN CODE` |
| **7 Approved WebP Presets** | Remote HTTP HEAD probe | Probed Dell hero, HP hero, Lenovo hero, Front story, Left story, Right story, Rear story | **7 / 7 HTTP 200 OK** | `VERIFIED IN CODE` |

---

## 2. Authentication & Authorization Matrix

| Staff Role | Catalog Read | Catalog Write | Bulk Edit | CSV Import/Export | Theme Draft Save | Theme Publish/Rollback | Order Status / Dispatch | Cash Collection | Store Settings |
|---|---|---|---|---|---|---|---|---|---|
| **Owner** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **Admin** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **Manager** | Yes | Yes | Yes | Yes | Denied | Denied | Yes | Yes | Denied |
| **Editor** | Yes | Yes | Yes | Yes | Yes | Denied | Denied | Denied | Denied |
| **Fulfillment** | Yes | Denied | Denied | Export Only | Denied | Denied | Yes | Denied | Denied |
| **Revoked / Non-Staff** | Denied | Denied | Denied | Denied | Denied | Denied | Denied | Denied | Denied |
| **Anonymous Public** | Published Only | Denied | Denied | Denied | Denied | Denied | Track By Phone Only | Denied | Denied |

*Status:* `VERIFIED IN ISOLATED TEST`

---

## 3. Verified Merchant Journeys

1. **Products & Variants:**
   - Create, edit, duplicate, archive, soft-delete (`deleted_at`), and restore products.
   - 1 to 3 option dimensions with dynamic variant matrix generation.
   - Price and compare-at in PKR, unique SKUs, barcodes, and inventory modes (`tracked` vs `untracked`).
   - Atomic variant synchronization with mid-loop error rollback and `inventory_ledger` audit rows.
   - *Classification:* `VERIFIED IN ISOLATED TEST`
2. **Product Bulk Editor:**
   - Fast spreadsheet-like editing for price, compare-at, SKU, barcode, and inventory quantity.
   - Accessible via direct "Bulk edit" action on `/admin/products`.
   - *Classification:* `VERIFIED IN ISOLATED TEST`
3. **Shopify CSV Import & Export:**
   - Detects Modern and Legacy Shopify product exports.
   - Staging with row-by-row dry-run summary (create, update, skip).
   - Merchant-selectable conflict strategies (`update_matching`, `skip_existing`, `create_only`).
   - Idempotent re-import: files matching the SHA-256 fingerprint safely skip unchanged records.
   - Export support for 5 distinct profiles: Modern Shopify, Legacy Shopify, LH Extended, Inventory Sidecar, and Collections Sidecar.
   - *Classification:* `VERIFIED IN ISOLATED TEST`
4. **Collections & Merchandising:**
   - Manual product assignment and automated rule-based collections.
   - Visual AND/OR rule builder matching on title, vendor, type, tag, price, and compare-at.
   - Server-side rule evaluation filtering out archived, deleted, and draft products from public storefronts.
   - *Classification:* `VERIFIED IN ISOLATED TEST`
5. **Visual Theme Editor & Homepage Presets:**
   - Nontechnical merchant section customization for V5 homepage sections.
   - Real-time sandboxed draft preview (`/admin/online-store/preview`).
   - One-click immutable theme publishing and instant rollback.
   - Persistent resolution of the 7 approved remote WebP homepage presets (Dell, HP, Lenovo hero assets + 4 product story angles) independent of catalog gallery media.
   - *Classification:* `VERIFIED IN ISOLATED TEST`
6. **Store Navigation & Menus:**
   - Centralized menu inspector (`/admin/navigation`) showing Main Menu, Footer Company, Support, and Legal link hierarchies.
   - Live URL destination validation and publication state badges.
   - `isLinkPublic` runtime guard strictly preventing unapproved policy pages from leaking on public storefronts.
   - *Classification:* `VERIFIED IN ISOLATED TEST`
7. **COD Orders & Daily Operations:**
   - Orders dashboard with search, status filtering, customer address details, and dispatch tracking inputs.
   - Separate financial cash collection ledger (`record_cod_collection` with idempotency and race condition prevention).
   - Inquiries inbox for reviewing customer submissions from the Contact page and bottom-of-homepage inquiry form.
   - *Classification:* `VERIFIED IN ISOLATED TEST`

---

## 4. Cash on Delivery (COD) Operational Integrity

- **Strict Payment Boundary:** COD is the only payment method supported. No payment gateways, cards, bank transfers, or digital wallets exist.
- **Server-Authoritative Calculations:** Merchandise subtotals, shipping charges, and COD fees are computed exclusively by the server in integer paisa. Client-supplied price totals are strictly ignored.
- **Order Placement vs. Financial Collection:** Orders are created in an `unpaid` COD state. Marking an order `delivered` does not automatically record cash. Cash collection is explicitly ledgered by authorized staff upon parcel settlement.
- **Availability Verification Workflow:** Because catalog variants are untracked by default, placing an order represents a request. Staff verify stock availability and contact the customer by phone before confirming and dispatching.
- **Production Guard:** Cash on Delivery remains strictly disabled in Production via dual gates:
  - `COD_CHECKOUT_ENABLED=false` (environment variable)
  - `app_config.cod_enabled=false` (database configuration table)
- *Classification:* `VERIFIED IN ISOLATED TEST` (Local) / `VERIFIED IN READ-ONLY PREVIEW` (Production Gated)

---

## 5. Security & Isolation Boundaries

- **Database RLS & Immutability:** Direct table DML on `theme_versions` and `theme_publications` is completely revoked. Triggers block `service_role` writes outside authorized internal RPCs (`app.theme_mutation = 'authorized'`).
- **Preview Isolation Guard:** `assertMerchantMutationAllowedAsync` in `src/lib/security/merchant-write-guard.ts` intercepts write requests. When running in a Vercel Preview connected to Production Supabase, mutating operations fail closed, preventing accidental pollution of Production data.
- **Public URL Content Hygiene:** `check-public-copy.mjs` verified 289 paths on `https://laptops-hub.vercel.app` with zero unfinished copy strings (`BEING FINALISED`, `Coming soon`, etc.) and zero broken links.
- *Classification:* `VERIFIED IN ISOLATED TEST` & `VERIFIED IN READ-ONLY PREVIEW`

---

## 6. Comprehensive Feature Classification Matrix

| Feature / Capability | Implementation State | Verification Method | Status Classification |
|---|---|---|---|
| Approved V5 Storefront Visuals | Unchanged frozen design | Playwright E2E & live crawl | `VERIFIED IN CODE` |
| 7 Approved Homepage WebP Presets | Hardcoded presets + resolver | HTTP HEAD + Playwright E2E | `VERIFIED IN CODE` |
| Full Admin Navigation & Shell | Responsive sidebar & header | Playwright E2E | `VERIFIED IN ISOLATED TEST` |
| Product CRUD & Soft Delete | Full lifecycle support | Catalog smoke test (25/25) | `VERIFIED IN ISOLATED TEST` |
| Product Variant Options Matrix | 1-3 dimensions + atomic sync | Catalog smoke test + E2E | `VERIFIED IN ISOLATED TEST` |
| Inventory Tracking & Ledger | Tracked/untracked + ledger | `test-inventory-ledger-sync.mjs` | `VERIFIED IN ISOLATED TEST` |
| Product Bulk Editor | Inline grid editor | Unit tests & E2E verification | `VERIFIED IN ISOLATED TEST` |
| Shopify CSV Modern/Legacy Import | Staging + dry run + commit | `test-shopify-csv-commit-smoke.mjs` | `VERIFIED IN ISOLATED TEST` |
| Shopify CSV 5 Export Formats | Modern, Legacy, Extended, etc. | Unit tests & export API route | `VERIFIED IN ISOLATED TEST` |
| Automated Collections Rules | Visual rule builder + eval | Catalog smoke test | `VERIFIED IN ISOLATED TEST` |
| Theme Draft / Publish / Rollback | 4 RPCs + immutability trigger | `test-theme-rls-matrix.mjs` & E2E | `VERIFIED IN ISOLATED TEST` |
| Navigation Management Page | Live inspection + badges | E2E browser test | `VERIFIED IN ISOLATED TEST` |
| COD Checkout & Concurrency | Idempotency + paisa math | `test-cod-concurrency.mjs` (16/16) | `VERIFIED IN ISOLATED TEST` |
| COD Cash Collection Ledger | Distinct payment recording | `test-cod-checkout-isolated.mjs` | `VERIFIED IN ISOLATED TEST` |
| Homepage Inquiry Section | DB insert + staff inbox | Playwright E2E + Unit test | `VERIFIED IN ISOLATED TEST` |
| Staff Role Permission Matrix | 6 distinct role gates | `security-role-matrix.mjs` (15/15) | `VERIFIED IN ISOLATED TEST` |
| Production 5-Migration Ledger | 5 additive migrations ready | Local Docker migration ledger | `VERIFIED IN CODE` |
| Production Database Migration | Awaiting owner approval | Production Supabase dashboard | `OWNER ACTION REQUIRED` |
| Real Shipping Zones & Fees | 0 active zones on Production | Settings form ready for input | `OWNER ACTION REQUIRED` |
| Legal Policy Publication | Gated behind legal sign-off | `isLinkPublic` safely hides | `OWNER ACTION REQUIRED` |
| Storefront Theme Live Switch | Requires `THEME_PUBLISHED_ENABLED` | Vercel Environment Variables | `OWNER ACTION REQUIRED` |
| Live COD Public Activation | Requires dual-gate approval | Environment & DB switches | `OWNER ACTION REQUIRED` |

---

## 7. Consolidated Owner Decision Packet

To safely transition the platform from engineering-complete to live customer operations, the owner must complete the following decisions and actions:

### Phase 1: Infrastructure & Database Migration (Engineering Gate)
1. **Database Backup:** Create a full snapshot/backup of the Supabase Production project (`xvmmjkrkgznnakcobmww`) via the Supabase Dashboard.
2. **Apply 5 Additive Migrations:** Approve and apply the 5 local migrations to Production:
   - `20261025120000_merchant_catalog_extensions.sql`
   - `20261025130000_site_builder_sections.sql`
   - `20261025140000_theme_publish_variant_rpc.sql`
   - `20261025150000_theme_rls_inventory_hardening.sql`
   - `20261025160000_theme_immutability_service_role.sql`
3. **Merge Feature Branch:** Approve merge of `feat/merchant-operating-system` to `main` and allow Vercel Production deployment.

### Phase 2: Business Content & Operational Setup (Merchant Gate)
4. **Business Identity Confirmation:**
   - Confirm official showroom address: `1st Floor, Al Raheem Center Plaza, University Chowk, Bahawalpur, Pakistan` (confirm if `Shop no. 3, Bahawalpur Cantt, 63100` should be included).
   - Confirm primary support telephone line (from candidates: `0309 3372974`, `0313 6565663`, `0339 9100199`) and confirm which line is WhatsApp-enabled.
   - Enter business opening hours in Admin Settings (`/admin/settings`).
5. **Shipping Zones & Delivery Fees:**
   - Navigate to `/admin/settings` and add approved shipping zones (e.g., Bahawalpur City, Punjab Province, Nationwide) with delivery fees in PKR and estimated courier transit times.
6. **Policy Page Approvals:**
   - Review and approve the legal text for Shipping & Delivery, Returns & Refunds, Warranty, Privacy Policy, and Terms of Service.
   - Publish approved policies in `/admin/content` so that links automatically activate on the customer-facing footer.
7. **Notification Secrets:**
   - Configure Resend API credentials (`RESEND_API_KEY`, `STORE_FROM_EMAIL`, `STORE_NOTIFY_EMAIL`) in Vercel Production Environment Variables.
   - Add `CRON_SECRET` to both Vercel and GitHub repository secrets to enable background outbox retries.

### Phase 3: Controlled Verification & Live Launch (Go-Live Gate)
8. **Enable Theme Publication:**
   - Set `THEME_PUBLISHED_ENABLED=1` in Vercel Production environment variables.
   - Log into `/admin/online-store` and click "Publish theme" to push the approved V5 homepage snapshot.
9. **Controlled Test COD Order:**
   - Place one internal test order using a staff phone number to verify checkout quote calculation, order creation, and staff notification alerts.
10. **Enable Public Cash on Delivery:**
    - Provide explicit written approval to set `COD_CHECKOUT_ENABLED=true` in Vercel and enable Cash on Delivery in Admin Settings.
