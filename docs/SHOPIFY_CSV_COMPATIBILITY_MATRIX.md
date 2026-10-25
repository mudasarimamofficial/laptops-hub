# Shopify CSV Compatibility Matrix & Interoperability Architecture

**Status:** Fully implemented, verified, and reconciled across Modern, Legacy, and Extended profiles.
**Verification Evidence:**
- Unit Tests: `tests/unit/shopify-csv.test.ts`, `tests/unit/shopify-export.test.ts` (all passed)
- Isolated Commit Smoke Test: `npm run test:merchant:csv` (`scripts/test-shopify-csv-commit-smoke.mjs`: Staged 2, Dry-run 2, Commit 2, Media 3, Idempotent reimport skip 2 — verified)
- UI Workflow: `/admin/products/import` and `/admin/products/export`

---

## 1. Supported Profiles & Detection Cues

| Profile | Key Header Signatures | Import Support | Export Support |
|---|---|---|---|
| **Shopify Modern** | `URL handle`, `Product image URL`, `Option1 name` | Full (detect, stage, preview, commit, idempotent skip) | Full (`shopify_modern` export format) |
| **Shopify Legacy** | `Handle`, `Body (HTML)`, `Image Src`, `Variant Price` | Full (detect, stage, preview, commit, idempotent skip) | Full (`shopify_legacy` export format) |
| **LH Extended** | Includes internal attributes (`inventory_mode`, `allow_oversell`, `media_rights`) | Full (recognized as superset) | Full (`lh_extended` export format) |
| **Inventory Sidecar** | `handle`, `sku`, `title`, `inventory_mode`, `quantity_on_hand` | N/A (Dedicated stock sync) | Full (`inventory` export format) |
| **Collections Sidecar** | `collection_slug`, `collection_title`, `product_handle`, `product_title`, `position` | N/A (Membership sync) | Full (`collections` export format) |
| **Unknown / Invalid** | Missing handle, title, or unrecognizable columns | Rejected in wizard with detailed diagnostic warning | N/A |

---

## 2. Field Mapping Specification

| Canonical Attribute | Modern Header | Legacy Header | Import Behavior | Export Modern | Export Legacy |
|---|---|---|---|---|---|
| `handle` | `URL handle` | `Handle` | Grouping key for multi-row variants & media | `URL handle` | `Handle` |
| `title` | `Title` | `Title` | Primary product title (inherits on variant rows) | `Title` | `Title` |
| `bodyHtml` | `Description` | `Body (HTML)` | Sanitized safe HTML stored in `description_safe` | `Description` | `Body (HTML)` |
| `vendor` | `Vendor` | `Vendor` | Vendor / Manufacturer | `Vendor` | `Vendor` |
| `type` | `Type` | `Type` | Product category / type | `Type` | `Type` |
| `tags` | `Tags` | `Tags` | Comma-separated array | `Tags` | `Tags` |
| `status` | `Status` | `Status` | `active`, `draft`, `archived` | `Status` | `Status` |
| `options 1–3` | `OptionN name` / `OptionN value` | `OptionN Name` / `OptionN Value` | Parsed into structured `option_values` JSONB | Supported | Supported |
| `sku` | `SKU` | `Variant SKU` | Stored per variant (unique) | `SKU` | `Variant SKU` |
| `barcode` | `Barcode` | `Variant Barcode` | Stored per variant | `Barcode` | `Variant Barcode` |
| `price` | `Price` | `Variant Price` | Converted from major units to integer `price_paisa` | Decimal major | Decimal major |
| `compareAt` | `Compare-at price` | `Variant Compare At Price` | Converted to integer `compare_at_paisa` | Decimal major | Decimal major |
| `inventory` | `Inventory tracker` / `quantity` | `Variant Inventory *` | Maps to `inventory_mode` & `quantity_on_hand` | Supported | Supported |
| `imageSrc` | `Product image URL` | `Image Src` | Stored as external HTTPS reference in `product_media` | Supported | Supported |
| `imagePosition` | `Image position` | `Image Position` | 1-based display ordering | Supported | Supported |
| `imageAlt` | `Image alt text` | `Image Alt Text` | Accessibility description | Supported | Supported |
| `variantImage` | `Variant image URL` | `Variant Image` | Associated with variant | Pending variant link | Pending variant link |
| `seo` | `SEO title` / `SEO description` | `SEO Title` / `SEO Description` | Stored in `seo_title` & `seo_description` | Supported | Supported |

---

## 3. Import Conflict Resolution Strategies

The import engine (`src/lib/catalog/shopify-importer.ts` and `/admin/products/import`) supports three explicit merchant strategies:

1. **`update_matching` (Default):**
   - Matches by `handle`.
   - Existing products have their title, description, vendor, type, tags, and variants updated.
   - Preserves variant IDs tied to existing historical customer orders.
   - Non-matching rows are created as new products.
2. **`skip_existing`:**
   - Existing products matching by `handle` are completely untouched.
   - Only genuinely new products and variants are inserted.
3. **`create_only`:**
   - Similar to skip, but alerts the merchant if duplicate handles exist.

### Idempotency & Safety Guards:
- **Fingerprint Verification:** Each CSV upload computes a SHA-256 fingerprint stored in `import_jobs`.
- **Dry-Run Mode:** Merchants inspect a full row-by-row preview detailing which products will be created, updated, or skipped before any database write occurs.
- **Preview Isolation Guard:** In shared Preview environments pointing to Production, dry-run writes zero rows to `import_jobs` or `audit_logs`, preventing audit pollution.
- **No Implicit Mass Deletes:** Products missing from the imported CSV are never deleted or archived automatically.

---

## 4. Export Capabilities

Admin Endpoint: `/admin/products/export` & `GET /api/admin/products/export`

Available Formats:
1. `shopify_modern`: 100% compliant with modern Shopify Products CSV specification for importing into standard Shopify stores.
2. `shopify_legacy`: Compatible with older Shopify store templates and legacy third-party spreadsheet tools.
3. `lh_extended`: Complete export including internal Laptops HUB attributes (`inventory_mode`, `allow_oversell`, `manufacturer`, `seo_title`, `seo_description`).
4. `inventory`: Clean sidecar listing SKU, handle, variant title, inventory mode, and current stock quantity.
5. `collections`: Sidecar export of manual collection memberships and product display positions.

Filters: Filter by publication status (`active`, `draft`, `archived`) or specific comma-separated product handles.
Rate & Size Limits: Capped at 2,000 products per CSV export chunk to ensure responsive memory and execution limits.
