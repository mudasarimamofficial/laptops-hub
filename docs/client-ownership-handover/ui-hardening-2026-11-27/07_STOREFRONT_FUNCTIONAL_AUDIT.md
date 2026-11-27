# 07 — Storefront functional audit

The UI fixes in this pass touched the header, promotion bar, map section, hero decorations, mega menu, WhatsApp button and collection filters. The commerce flows below were re-proven end to end on the **isolated stack**: local Supabase, synthetic fixture products, a fake email server, never production. This was part of the full isolated run on main `4e4daac`; totals are in `10`.

| Flow | Spec (tests) | What it proves |
|---|---|---|
| Customer purchase | `launch-journey` (10) | Product → cart → checkout → confirmation. Business alert and customer confirmation each delivered once. Tracking by order number + phone (wrong phone refused). Unserved address and invalid phone refused |
| Checkout quote race | `p0-checkout-quote-race` (1) | A late quote for an earlier address never overwrites the current address (#102 fix holds) |
| Storewide discount | `p1-discount-propagation` (1) | Activating a discount in Admin changes the PDP price, the announcement and the checkout quote; disabling reverts all. The live 5% discount on production was not touched |
| Variants | `p0-variant-order-journey` (9) | Default variant, sold-out option, cart holds the selected variant (id, price, SKU, label), quote and COD order use it, stock and ledger move |
| Inventory | `p0-inventory-oversell` (3) | Oversell setting is role-protected, persists, and checkout honours it with a ledger entry |
| Buy now | `merchant-os-buy-now` (2) | Buy-now lines never clear the main cart |
| Shipping | `shipping-zones` (5) | Zone fees, unserved city refused, excluded city, free-delivery minimum |
| Cart and compare wording | `p2d-theme-cart-compare` (1) | Draft/publish/rollback of cart and compare text |
| Owner acceptance | `z-owner-acceptance-36-steps` (9) | The 36-step owner script: create → publish → buy → order desk → COD cash → accounting |
| Filters (new) | `ui-filter-a11y` (3) | Unavailable options disabled; available options filter and untick (#111) |
| Layout | `cross-browser-storefront` (11), `ui-responsive-cross-route` (12) | Every public page, no sideways scroll, no overlay defects (see `03`) |

**Production:** by rule, no order, cart action or form submission was made on the live site. Live checks were read-only (`11`).

**Defects found in this pass (storefront):** VIS-001 to VIS-006 as reported, plus three found during testing:
- VIS-002(b), the hero bleed (#110);
- the phone map not loading after a jump to the end (#107);
- the filter contrast and dead-end options (#111).

Found in the final full run (evening):
- **HYD-001:** a checkout hydration mismatch could wipe a just-typed city, so no quote appeared. Root cause and fix are in `02`. Covered by spec `ui-store-hydration`, which fails on the old build and passes on the fixed one.
- **SEO-001:** `/cart` was indexable (`02`).

No price, discount, shipping, inventory or order defect was found. HYD-001 lost typed input only; the server always repriced correctly.
