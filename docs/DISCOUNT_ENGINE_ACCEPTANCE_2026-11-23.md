# Discount engine acceptance — 2026-11-23

## Original problem
No merchant-controlled automatic discount; owner requested a flat 5% storewide promotion with visible storefront presentation and server-side checkout integrity.

## Architecture
- Table `discount_campaigns` + seed **Storewide 5% Off** (active, no code).
- Shared TS pricing: `src/lib/commerce/pricing.ts` (integer paisa, nearest-paisa percent rounding).
- Checkout: `create_cod_order` and `/api/checkout/quote` apply the live automatic campaign **once** to catalog `price_paisa`.
- Line snapshots: `unit_list_price_paisa`, `line_discount_paisa`, `discount_campaign_id`.
- Order `discount_paisa` remains `0` in the total invariant (selling prices already reduced); savings recorded on lines + `order_events.meta`.
- Stacking rule: one automatic campaign; `compare_at_paisa` is display-only and never a second discount base.
- Shipping / COD fees are never discounted.

## Admin
- Route `/admin/discounts` (owner/admin/manager).
- Create/edit/enable/disable, announcement text, price preview.

## Storefront
- Promo bar when campaign `show_announcement` is true.
- Cards/PDP/cart show selling price + strikethrough list + `% OFF` badge.
- JSON-LD Offer prices use discounted selling amounts.

## Evidence
- DB: `unit_selling_paisa(1000000, active_automatic_discount()) = 950000` (Rs 10,000 → Rs 9,500).
- Unit: `tests/unit/pricing.test.ts` PASS.
- Migration: `20261123120000_discount_campaigns_and_pricing.sql` applied to `xvmmjkrkgznnakcobmww`.

## Rollback
1. Disable campaign in Admin → Discounts (immediate storefront/checkout effect).
2. Or restore prior `create_cod_order` body and drop `discount_campaigns` / new order_items columns if a full DB rollback is required.

## Status
**PASS** (engineering). Live COD place-order with discount remains **BLOCKED** pending business authorization for live COD.
