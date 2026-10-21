# Product data model

Source of truth: `data/source/products_export_final.csv` (Shopify export, 968 rows). Generated file: `data/lh-catalog.js` (`window.LH_CATALOG`, **232 records**, one per Handle). The 50 handles from the original V5 build keep their curated `specs` / `intro`; prices, titles, images and status come from the CSV for all 232.

| Field | Meaning | Shopify mapping |
|---|---|---|
| h | handle (unique id) | product.handle |
| t | title | product.title |
| model, config | title split at " - " / " — " | derived for display |
| brand | Vendor, casing normalised (DELL→Dell, LENOVO→Lenovo) | product.vendor |
| price, cmp | PKR price, compare-at | variant.price / compare_at_price |
| sku | Variant SKU | variant.sku |
| type | Shopify Type | product.product_type |
| cat, catLabel | laptop · gaming · macbook · chromebook · tablet · accessory | product_type + tag `type:chromebook` |
| sub | Charger, Headset, Memory, Storage, Display panel, Cable, Battery, Workstation, 2-in-1, Rugged (from `type:` tags) | tags → custom.device_subtype |
| cpu, gen | i3/i5/i7/i9/Ryzen 5/Celeron/Xeon; generation | custom.cpu_tier, custom.cpu_generation |
| ram, sto, size, touch | from curated specs (50) or parsed from the title (182) | custom.ram_gb, storage_gb, screen_in, touchscreen |
| cond | "Used" when the CSV/curated data says so; otherwise empty | custom.condition |
| specs{} | spec sheet rows | metafields / specs metaobject |
| intro, outro | curated text (50); empty for new products (PDP shows a neutral "specifications being prepared" line) | body_html (see note) |
| imgs[] {u,a} | images sorted by Image Position, alt from CSV | product.media |
| rights | media tag: PENDING_OEM · MEDIA_PENDING_RIGHTS_REVIEW · NONE · empty | custom.media_rights |
| flags[] | review flags from tags (IDENTITY_REVIEW_REQUIRED, CONFIG_REVIEW…) | tags (admin only) |
| pub, status | public = Status active **and** Published true | product.status / published |
| src | `v5-50` or `final-232` | — |

**No inventory fields.** `qty`, `policy` and any stock count are deliberately not in the storefront data. The CSV has no Variant Inventory Tracker on any of the 232 products, so a zero quantity is not treated as sold out. Every public listing with a price shows Add to cart. In Shopify, use `variant.available` (real purchase availability) for the buy button; do not render `inventory_quantity`. Inventory tracking / overselling settings in Shopify Admin are unchanged and need owner approval to change.

**Body HTML is not shown.** Many new products' Body HTML contains internal CRM notes ("CRM: …", "Confirm exact GPU/RAM/storage on unit"). Rewrite descriptions before using `body_html` on the theme.

## Verified distribution (public = 226)
- Category: laptop 165 · accessory 50 · tablet 6 · gaming 2 · MacBook 2 · Chromebook 1 → 170 laptops (all laptop-type incl. gaming/MacBook/Chromebook)
- Sub-type: Charger 31 · 2-in-1 14 · Workstation 8 · Headset 4 · Memory 3 · Display panel 2 · Storage 2 · Cable 1 · Rugged 1 · Battery 1
- Brand: Dell 76 · HP 58 · Lenovo 50 · Laptops HUB (vendor on unbranded accessories) 13 · Microsoft 8 · Jabra 4 · Acer 4 · Toshiba 3 · ASUS 3 · Apple 3 · iTech 2 · Haier 1 · Chicony 1
- CPU: i5 113 · i7 40 · i3 10 · Ryzen 5 2 · Celeron 2 · i9 1 · not in title 8
- Price Rs 300 – 270,000 · images 956 public (964 total; 4 drafts have none)
- Drafts (6, hidden): dell-precision-7730-xeon-p4200-crm-identity-review, mix-non-touch-2in1-crm-identity-review, asus-celeron-8-128-crm-identity-review, dell-precision-7530-crm-identity-review, laptop-batteries-crm-review-required (price 0), dell-precision-7520-crm-identity-review
- Public items with review flags: Microsoft Surface Laptop 5 (IDENTITY_REVIEW_SOFT), Surface Go 2 i5 11th (CONFIG_REVIEW)

## Title parsing rules (182 new products, computers only)
CPU `Core iN` (gen from "Nth Gen" after the CPU, or the model number e.g. i7-12800H → 12) · Ryzen/Celeron/Xeon by name · RAM "NGB RAM"/"NGB DDRn" · storage "NGB/TB Storage|SSD|HDD" · screen only when the title has an inch mark · touch only when "Touch" (not "Non-Touch"). Nothing else is inferred. Accessories get no spec parsing.

## Missing-data representation
Key-spec tiles and spec sheet omit absent fields; compare shows "—"; condition shows "Condition not listed".
