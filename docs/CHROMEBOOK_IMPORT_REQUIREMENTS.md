# Chromebooks

## Current state (final export)
- **1 Chromebook listed:** HP Chromebook 14 G5 — 4GB RAM, 32GB Storage · Rs 16,000 · SKU-00119 · 5 photos (rights PENDING_OEM) · handle `hp-chromebook-14-g5-4-32`. Classified by the CSV tag `type:chromebook` (Shopify Type is "Laptops").
- **Chromebook Type-C Charger** (`chromebook-type-c-charger`) is an accessory, not a Chromebook; it appears under Accessories / Chargers only. Verified by `QA Catalog.html`.
- No other Chromebook inventory exists; none was created.
- The homepage Chromebook section, nav (NEW badge), mega menu and collection now show the real product. The "coming soon" state remains in code and appears only if the collection becomes empty.

## Source data gaps for the HP Chromebook 14 G5
Processor, screen resolution, touch, condition and ChromeOS auto-update date are not in the export. The page shows only memory, storage, price and photos. Confirm before publishing more detail.

## Adding more Chromebooks
Tag `type:chromebook` (or Shopify product_type Chromebook) + the usual fields. They appear in the collection, search, compare and cart with no code change.
| Field | Catalog key | Shopify |
|---|---|---|
| Handle, title, vendor | h, t, brand | product |
| Price, compare-at, SKU | price, cmp, sku | variant |
| Processor family | specs.Processor (+ cpu) | custom.cpu_tier |
| RAM / storage (+ eMMC/SSD) | ram, sto | custom.ram_gb, storage_gb, storage_type |
| Screen, touch, 2-in-1 | size, touch | custom.screen_in, touchscreen, convertible |
| ChromeOS AUE date (only if verified) | specs | custom.chromeos_aue |
| Condition | cond | custom.condition |
| Images with alt + rights | imgs, rights | media, custom.media_rights |
