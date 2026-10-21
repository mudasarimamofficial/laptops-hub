# Shopify OS 2.0 handoff

Target: Online Store 2.0 theme (Dawn-based or custom), JSON templates, section groups for header/footer.

## Templates
| Template | Sections |
|---|---|
| index.json | hero-cinematic, product-story, promo-chromebook, collection-list (brands), featured-collection (available), featured-product, collection-list (spec), featured-collection (gen row, scroll layout), collection-list (budget), compare-teaser |
| collection.json | main-collection-banner, main-collection-product-grid (Search & Discovery filters), pending-state block for empty collections |
| product.json | main-product (media gallery, price, availability badge, key-spec tiles from metafields, qty, buy buttons, compare toggle, policy links), product-spec-sheet, related-products |
| search.json | main-search (reuse grid) |
| cart.json | main-cart-items, main-cart-footer |
| page.json | content-page (hero + blocks) |
| page.compare.json | compare-table (custom JS) |
| blog.json / article.json | guides hub / article (reuse content blocks) |
| 404.json | not-found |

## Header (section group)
Blocks: mega_group (title, link list), mega_feature (product). Settings: sticky, show desktop links breakpoint. Use a Shopify menu "main-menu" with 2 levels; counts via `collection.products_count`.

## Theme editor settings
Per section: heading, kicker, description, image (desktop/mobile), CTA label/URL ×2, collection/product pickers, padding top/bottom, background (canvas/ice/navy), animation enable + reduced-motion fallback. Global: colour tokens mapped 1:1 to settings (lock to V5 values), fonts, radius scale.

## Metafields (product, namespace custom)
device_category (laptop/gaming/macbook/chromebook/tablet/accessory), device_subtype, cpu_tier, cpu_generation (int), ram_gb (int), storage_gb (int), storage_type, screen_in (decimal), touchscreen (bool), display, resolution, graphics, os, condition, config_note, media_rights, device_type, convertible, chromeos_aue, warranty. Expose as Search & Discovery filters: product type/category, vendor, price, cpu_tier, cpu_generation, ram_gb, storage_gb, screen_in, touchscreen, condition. Do not expose an availability filter.

## Metaobjects
faq_item (question, answer, status, category) · policy_section (title, body, status) · buying_guide (title, kicker, intro, body, related collection). Content block types in lh-content.js map to section blocks: h2/p → richtext, list → richtext list, table → key/value block, pending → (do not render in production), faq → faq metaobject list, links → collection links, cta → cta block, products → featured-collection, articles → blog posts, form → contact form.

## Integrations
| Need | Approach |
|---|---|
| Cart | AJAX Cart API (/cart/add.js, change.js, cart.js); drawer re-render via Section Rendering API; respect inventory_policy |
| Checkout | native Shopify checkout; remove prototype disabled state |
| Inventory | **Do not render stock counts or stock badges.** Buy button from `variant.available` (real purchase availability). The final export has no inventory tracker on any product; do not change tracking/overselling in Admin without owner approval |
| Compare | localStorage handles + /products/{handle}.js fetch; max 4 |
| Search | Predictive Search API for overlay; /search for results |
| Contact / inquiry | Shopify {% form 'contact' %} with hidden product handle; optional WhatsApp deep link when number approved |
| Accounts | Shopify customer accounts (new) — not designed in prototype |
| Chromebooks | see CHROMEBOOK_IMPORT_REQUIREMENTS.md |
| Media | upload to Shopify Files after rights clearance; use image_url with width for srcset |

## Behaviour verified in the prototype (keep in the theme)
- Dialog focus: focus the newest dialog's first control on open, trap Tab/Shift+Tab, Esc closes, return focus to the opener, lock body scroll
- Toasts through one persistent `role=status` region
- Storage keys: `lh_cart`, `lh_compare` only; cleanup of legacy `lh_inquiries` must not touch other keys
- Image tiles hide failed images and keep the tile background
- No inventory numbers or stock badges anywhere (cards, PDP, hero, carousels, compare, search, cart). If `variant.available` is false, hide Add to cart and show "Ask about this product"
- Filters: OR within a facet, AND across facets; facet counts exclude their own facet
- Tests to port: `qa/lh-functional.js` assertions map 1:1 to Playwright tests against the theme

## Conversion plan (Cursor / Claude Code)
The V5 design is frozen. The prototype is the visual and behavioural reference; rebuild it as Liquid sections, not by embedding the prototype.

**0. Setup.** `shopify theme init` from Dawn (or blank OS 2.0). Shopify CLI `theme dev` against a development store. Import `data/source/products_export_final.csv` (232 products, 964 images; 6 drafts stay draft), then create the product metafield definitions above and populate them from `data/lh-catalog.js` (fields `cat`, `sub`, `cpu`, `gen`, `ram`, `sto`, `size`, `touch`, `specs`; mapping in PRODUCT_DATA_MODEL.md). Rewrite Body HTML first: it contains internal CRM notes. Keep the prototype open beside the theme for comparison.

**1. Tokens.** Copy the `--lh-*` custom properties from the storefront `<helmet>` into `assets/base.css`; map each to a `settings_schema.json` colour setting defaulting to the V5 value. Fonts Sora / Hanken Grotesk / JetBrains Mono via the theme's font settings or self-hosted. Inline styles in the prototype → section-scoped CSS classes using the same tokens and the breakpoints in RESPONSIVE_QA.md.

**2. Header and mega menu.** `sections/header-group.json` with a header section. Primary links from menu `main-menu`. Mega menu groups = blocks (`mega_group`: title + link_list; `mega_feature`: product). Mobile menu as a `<dialog>`-style drawer with the focus rules below.

**3. Collections.** Create the collections in ROUTE_INVENTORY.md (categories, brands, specs, budget; no in-stock/available collections) (automated collections by metafield/vendor/price where possible). `collection.json` uses Search & Discovery filters (`collection.filters`); render the prototype's facet groups from filter objects; sort via `sort_by`. Empty collections render the pending/coming-soon block, never an empty grid.

**4. Product template.** `main-product` section: gallery from `product.media` (thumbnails = `aria-current`, arrows, alt from media alt), price, category badge (no stock wording), buy button gated only by `variant.available`, key-spec tiles from metafields (blocks so order is editable), quantity selector not tied to inventory (Shopify enforces availability at add-to-cart/checkout), Add to cart / Ask about this product, compare toggle. The catalog has one variant per product; keep the variant picker hidden when `product.has_only_default_variant`.

**5. Search.** Overlay uses Predictive Search API (`/search/suggest.json?resources[type]=product`); Enter goes to `/search?q=`. `search.json` reuses the collection grid.

**6. Cart and checkout.** Cart drawer and `cart.json` via AJAX Cart API and Section Rendering API; header count from `cart.item_count`. Remove the prototype's disabled checkout; submit to `/checkout`. Delete `lh_cart` localStorage logic (Shopify owns the cart).

**7. Compare.** Keep `lh_compare` (max 4 handles) in a small JS module; fetch `/products/{handle}.js` for rows; page template `page.compare.json`. Tray hides on compare/cart/content pages and while the home story is on screen.

**8. Pages and blog.** `page.json` content section with blocks matching `lh-content.js` block types (mapping above). Policies use Shopify policy pages where possible. Buying guides → blog `guides` with `article.json`. Pending blocks are not rendered; publish a page only after owner approval.

**9. Chromebooks.** Smart collection on tag `type:chromebook` (1 product: HP Chromebook 14 G5; the Type-C charger is an accessory); keep the empty state for 0 products; homepage campaign section with a collection picker. Import rules in CHROMEBOOK_IMPORT_REQUIREMENTS.md.

**10. Homepage scroll scenes.** `hero-cinematic` and `product-story` sections; port the `frame()` loop (storefront logic class) to a vanilla JS module that writes CSS variables on one rAF per scroll; `position: sticky` frame; reduced motion = unpinned 4-image grid with all specs, read `matchMedia` before first paint. Product and angle images as section settings.

**11. Accessibility and performance.** Keep every behaviour listed in "Behaviour verified" below. Use `image_url` with widths + `srcset`, `loading="lazy"` except the hero LCP image, preload the hero cutout, `font-display: swap`, defer section JS. Targets: LCP < 2.5s, CLS < 0.1, INP < 200ms on mid-range mobile.

**12. Tests.** Port `qa/lh-functional.js` and `qa/lh-qa.js` assertions to Playwright against `theme dev`; add real-device runs (iOS Safari, Android Chrome), VoiceOver/NVDA, Lighthouse.

**Launch** only after RELEASE_GATE.md gates C–E clear.

## Porting notes
- Scroll scenes: port frame() loop as a vanilla module; keep CSS-var approach; guard with matchMedia reduced-motion
- Inline styles in the prototype become section CSS using the same tokens
- Availability logic: see PRODUCT_DATA_MODEL.md
