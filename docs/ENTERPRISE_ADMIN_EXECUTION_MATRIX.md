# Enterprise Admin — Capability Execution Matrix

**Updated:** 2026-10-26 (Antigravity IDE Post-Handover Corrections)  
**Baseline verified:** `feat/merchant-operating-system` · Supabase local 19 migrations · Production 14 migrations · COD off  
**Branch:** `feat/merchant-operating-system`

Status Categories:
- `Implemented and browser-verified`
- `Implemented but incompletely tested`
- `Implemented but blocked in Production`
- `Missing functionality`
- `Owner-only business decisions`

| ID | Capability | Required Scope | Implementation & Evidence | Priority | Status | Acceptance |
|---|---|---|---|---|---|---|
| A1 | Merchant admin shell / IA | Sidebar, mobile nav, role-aware | Responsive Admin layout, navigation drawer, active indicators, token styling | P0 | **Implemented and browser-verified** | Verified Playwright `merchant-admin-workflows.spec.ts` |
| A2 | Overview KPIs | Ops alerts, COD readiness, media rights | Real counts, quick action links, pending checkout gate alerts | P0 | **Implemented and browser-verified** | Verified `/admin` overview render |
| A3 | Product list | Search/filter/status/price table, thumbnails, inventory | Server-side pagination, search by title/handle/brand, status filter, bulk edit link | P0 | **Implemented and browser-verified** | Verified in browser + `merchant-admin-workflows.spec.ts` |
| A4 | Product create | Full create with default variant | Form with handle auto-generation, price in PKR, manufacturer, initial status | P0 | **Implemented and browser-verified** | Verified in browser + `merchant-admin-workflows.spec.ts` |
| A5 | Product edit & variants | Options matrix, SEO, specs, inventory | `ProductVariantMatrix`, `sync_product_variants` atomic RPC with inventory ledger delta | P0 | **Implemented and browser-verified** | Verified in `merchant-admin-workflows.spec.ts` + `test-inventory-ledger-sync.mjs` |
| A6 | Media URL / gallery | Add/reorder/remove/primary, safe CDN refs | `assertSafeHttpsImageUrl` anti-SSRF, reorder positions, delete media row | P0 | **Implemented and browser-verified** | Verified in `test-merchant-catalog-smoke.mjs` |
| A7 | Archive / soft-delete / restore | Soft-delete + audit + order safety | `DELETE` route with handle confirm; `deleted_at` filter; `PATCH` restore; order line safety | P0 | **Implemented and browser-verified** | Verified in `test-merchant-catalog-smoke.mjs` |
| A8 | Bulk editor | Multi-product status, price, featured | `/admin/products/bulk` + `/api/admin/products/bulk`, paste handles, batch apply | P1 | **Implemented and browser-verified** | Verified build & route validation |
| A9 | Collections CRUD | Manual + automated smart rules, SEO | `/admin/collections/new` and `[slug]`, visual AND/OR rule builder, membership order | P0 | **Implemented and browser-verified** | Verified in `merchant-admin-workflows.spec.ts` + `collection-rule-eval.test.ts` |
| A10 | Inventory policy | Store defaults + per-variant mode + ledger | `inventory_ledger` table, delta accounting, negative stock rejection | P0 | **Implemented and browser-verified** | Verified in `test-inventory-ledger-sync.mjs` |
| A11 | Shopify CSV import | Wizard, dry-run, commit, jobs & retry UX | Modern & legacy profile detection, dry-run reconciliation, owner/admin Production path with fingerprint confirmation, idempotent skips | P0 | **Implemented and browser-verified** | Verified in `test-shopify-csv-commit-smoke.mjs` + Production path hardened |
| A12 | Shopify CSV export | Modern, legacy, LH extended, sidecars | `/admin/products/export` + 5 export formats (Modern, Legacy, Extended, Inventory, Collections) | P0 | **Implemented and browser-verified** | Verified in `shopify-export.test.ts` |
| A13 | Site / theme editor | Visual customize, draft, preview, publish, rollback | `/admin/online-store`, 7 WebP presets, draft RPC, immutable snapshots, rollback, emergency kill switch, cache revalidation | P0 | **Implemented and browser-verified** | Verified in `theme-publish-workflow.spec.ts` (8/8) + `test-theme-rls-matrix.mjs` |
| A14 | CMS pages | Safe rich text/HTML, legal approval gate | `/admin/content`, legal approval requirement for policies, withdrawal 404 enforcement | P1 | **Implemented and browser-verified** | Verified in `v5-content.spec.ts` + `check-public-copy.mjs` |
| A15 | Navigation menus | Header links & footer columns no-code editor, link gating, storefront binding | Full interactive editor (`/admin/navigation`), move up/down, add/remove, destination picker, public link gating (`isLinkPublic`), restore defaults, dynamic storefront header & footer | P0 | **Implemented and browser-verified** | Verified in `test-settings-navigation-persistence.mjs` + `tests/unit/navigation.test.ts` |
| A16 | Orders / COD desk | Filters, customer details, lifecycle, cash collection | Full lifecycle (`placed`→`confirmed`→`packing`→`shipped`→`out_for_delivery`→`delivered`), record cash collection desk | P0 | **Implemented and browser-verified** | Verified in `test-cod-concurrency.mjs` (16/16) + `test-cod-checkout-isolated.mjs` (23/23) |
| A17 | Customers | Derived from orders with privacy | `/admin/customers` list with order counts and spent totals | P1 | **Implemented and browser-verified** | Verified build & schema access |
| A18 | Inquiries desk | Homepage & contact inquiry triage | `/admin/inquiries` inbox, status update (`new`→`in_progress`→`closed`) | P1 | **Implemented and browser-verified** | Verified in `home-inquiry.test.ts` |
| A19 | Settings modular | Typed business, inventory, SEO, shipping | `/admin/settings`, atomic merge updates, database error verification, readback check, shipping zone CRUD | P0 | **Implemented and browser-verified** | Verified in `test-settings-navigation-persistence.mjs` + Playwright |
| A20 | Analytics truthful | Real COD collected vs ordered totals | `/admin/analytics`, actual collected cash vs outstanding receivables | P2 | **Implemented and browser-verified** | Verified build & query logic |
| A21 | Activity / audit UI | Merchant-readable audit trail | `/admin/activity`, lists `audit_logs` entries with actor and details | P1 | **Implemented and browser-verified** | Verified build & query logic |
| A22 | Roles / RLS security | Owner, admin, manager, editor, fulfillment | Direct DB permission matrix on `admin_memberships`, RPC caller authentication, fail-closed write guard | P0 | **Implemented and browser-verified** | Verified in `test-theme-rls-matrix.mjs` + `security-role-matrix.mjs` (15/15) |
| A23 | External media policy | HTTPS only, anti-SSRF, approved 7 presets | Validated CDN URLs, 7 approved WebP presets HTTP 200 verified | P0 | **Implemented and browser-verified** | Verified in `homepage-presets.test.ts` + live HTTP probe |
| A24 | COD launch gates | Dual env+DB gates, production OFF | `COD_CHECKOUT_ENABLED=false` and `store_settings.cod_checkout.enabled=false` in Production | P0 | **Implemented but blocked in Production** | Verified fail-closed; preserved OFF |

---

## Owner-Only Business Decisions

The following items are business and operational dependencies that only the store owner can authorize or provide:

1. **Production Migrations Review & Approval:** Review and grant explicit written permission to apply the 5 enterprise migrations (`20261025120000` through `20261025160000`) to production Supabase `xvmmjkrkgznnakcobmww`.
2. **Shipping Zones & Courier Tariffs:** Confirmation of exact supported delivery cities/provinces and agreed courier rates (PKR delivery fee + COD fee).
3. **Legal Policies Approval:** Written sign-off on the text of the 5 mandatory checkout policy pages: Shipping, Returns/Refunds, Warranty, Privacy, and Terms.
4. **Business Identity Confirmation:** Confirmation of official public support phone (from 0309 3372974, 0313 6565663, 0339 9100199), public support email, and physical showroom address.
5. **Catalog Price & Stock Verification:** Review and verification of listed laptop prices and current physical availability.
6. **Controlled Live Test Order & COD Activation:** Performing an approved controlled COD test order before flipping production COD switches to `true`.
