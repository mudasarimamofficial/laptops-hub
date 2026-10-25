# Shopify CSV compatibility matrix

**Verified against:** Shopify Help Center product import/export docs (as of implementation 2026-10-25). Re-check headers before Production import commits — Shopify can rename columns.

## Profiles

| Profile | Detection cues | Status |
|---|---|---|
| Modern | `URL handle`, `Product image URL`, `Option1 name` | Detect + stage + modern export |
| Legacy | `Handle`, `Body (HTML)`, `Image Src`, `Variant Price` | Detect + stage |
| Unknown | Missing handle/title mapping | Rejected in preview wizard |

## Field mapping (supported)

| Canonical | Modern header | Legacy header | Import | Export modern |
|---|---|---|---|---|
| handle | URL handle | Handle | yes | yes |
| title | Title | Title | yes | yes |
| bodyHtml | Description | Body (HTML) | yes | yes (as Description) |
| vendor | Vendor | Vendor | yes | yes |
| type | Type | Type | yes | yes |
| tags | Tags | Tags | yes | yes |
| status | Status | Status | yes | yes |
| options 1–3 | OptionN name/value | OptionN Name/Value | staged | yes |
| sku | SKU | Variant SKU | staged | yes |
| barcode | Barcode | Variant Barcode | staged | yes |
| price | Price | Variant Price | staged | yes (paisa→major) |
| compareAt | Compare-at price | Variant Compare At Price | staged | yes |
| inventory | Inventory tracker/qty | Variant Inventory * | staged | yes when tracked |
| imageSrc | Product image URL | Image Src | staged (URL ref) | yes |
| imagePosition / alt | Image position / alt text | Image Position / Alt Text | staged | yes |
| variantImage | Variant image URL | Variant Image | staged | pending variant link |
| seo | SEO title/description | SEO Title/Description | staged | yes |
| collection | Collection | — | hint only (1) | **not on product CSV** |

## Explicit non-goals / field loss

- Many-to-many collections → separate membership CSV (planned)
- Inventory ledger / multi-location Shopify inventory
- Page builder / theme sections
- Media rights approval state
- Private cost (export optional later; never public)
- Perfect lossless Shopify API parity

## Fixtures

- Unit: `tests/unit/shopify-csv.test.ts`, `tests/unit/shopify-export.test.ts`
- Owner: real Shopify export from authorized source store (pending)
