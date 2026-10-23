# V5 Visual Parity Matrix

Reference: `Laptops Hub Storefront v5.dc.html` + `ProductCard v5.dc.html` + `LHImg.dc.html` (local, gitignored export `Laptops Hub storefront/`; never deployed).
Branch: `fix/v5-correctness-parity`. Content pages compared with `V5_CONTENT_PREVIEW=1` (template content); the live default for unpublished rows is the gated state. Measurements: `docs/V5_PIXEL_DIFF_REPORT.md` (generated) · harness `scripts/visual/capture.mjs`.

Status: **MATCH** = ported 1:1 and measured ≤0.2% pixel diff with equal geometry · **MATCH\*** = match with a documented, deliberate difference · **GATED** = implemented, owner approval needed before it can be public · **NOT PORTED** = still the pre-V5 implementation.

| Component | Reference (V5) | Implementation | Responsive | Interactions | Evidence | Known differences | Status |
|---|---|---|---|---|---|---|---|
| Tokens, fonts, base | root style + `<helmet>` | `src/styles/tokens.css`, `v5.css`, `app/layout.tsx` | n/a | focus-visible, reduced motion | all scenes | none | MATCH |
| Header 72px | `<header>` | `site-header.tsx` | <760 hamburger · ≥760 search/compare · ≥1180 text nav | mega hover/click/Escape, active link | `home-top`, `mega-open` | — | MATCH |
| Mega menu | `megaShown` | `site-header.tsx` | 4 cols; feature card ≥1180 | live counts, compare n/4 | `mega-open` | — | MATCH |
| Search overlay | `sOpen` | `search-overlay.tsx` + `/api/catalog/search` | full width | autofocus, Escape, focus trap/restore, popular chips, 6 results, See all, Enter → `/search` | `search-open` | results fetched (debounced 120ms) instead of synchronous | MATCH |
| Mobile menu | `mnav` | `site-header.tsx` | <760 | groups (Brand open), scroll lock, focus trap, Escape | `mnav-open` | — | MATCH |
| Hero (01) | `#top` | `home/cinematic-hero.tsx` | 3 layouts | intro, skip, pointer + scroll parallax | `home-top` (11 viewports, 0%) | cutouts only when `V5_CUTOUT_BASE` set | MATCH / GATED (media) |
| Product story (02) | `#story` | `home/product-story.tsx` | sticky; reduced-motion stack | 4 chapters, scroll scrub, CTA gating, tray hide | `home-story` (11 viewports, 0%) | same media gate | MATCH / GATED (media) |
| Chromebooks (03) | `#chromebooks` | `home/home-client.tsx` | 1 col <1000 | `--cp` parallax, Ask dialog → `/api/contact` | `home-full` | inquiry is stored (V5 was demo) | MATCH |
| Brands (04) … Compare demo (10) | home sections | `home/home-sections.tsx` | as V5 | carousel prev/next | `home-full` 0.01% | — | MATCH |
| Product card | `ProductCard v5` | `commerce/product-card.tsx` | grid 270/240 | hover image swap, compare (toast at 4), add → drawer, inquiry when unpurchasable | all grids | `<article>` root for semantics | MATCH |
| Collection / search | `isCollection` | `collection-view.tsx`, `collection-page.tsx`, `lib/catalog/v5-collection.ts` | aside 232px; mobile filter dialog | facets, price, touch, chips, sort, load more (URL state) | `collection-*`, `search-thinkpad` 0% | server-evaluated | MATCH |
| Chromebook pending state | `isCbPending` | `collection-view.tsx` | — | — | (not reachable: 1 Chromebook listed) | — | MATCH (code) |
| PDP | `isProduct` | `app/products/[handle]/page.tsx`, `commerce/product-detail.tsx` | 1 col <900 | gallery arrows/swipe/thumbs, qty stepper, compare, inquiry | `pdp-7420*` ≤0.06% | spec rows omit V5 "(source reference)" notes (internal labels) | MATCH\* |
| Cart page | `isCart` | `app/cart/page.tsx` | 1 col <900 | stepper, remove, limits | `cart-empty`, `cart-line` | checkout note text (truthful) | MATCH\* |
| Cart drawer | `drawer` | `cart-drawer.tsx` | full width <440 | focus trap, Escape, stepper | `drawer-open` | note text (truthful) | MATCH\* |
| Compare page | `isCompare` | `app/compare/page.tsx`, `/api/catalog/compare` | horizontal scroll | only differences, remove, add | `compare-empty`, `compare-two` ≤0.12% | — | MATCH |
| Compare tray | tray | `compare-tray.tsx` (Phase 1) | — | — | e2e | adds per-item remove + Clear all (V5 tray has neither) | MATCH\* |
| 404 | `notFound` | `app/not-found.tsx`, product variant | — | — | `not-found` | product message reworded ("export") | MATCH\* |
| Footer | `<footer>` | `site-footer.tsx` | auto-fit cols | — | all full-page scenes | bottom line truthful (see report) | MATCH\* |
| Toast | toast | `v5/toast.tsx` | — | aria-live status | e2e cart limit | — | MATCH |
| Content page shell | `isPage` | `components/content/content-page.tsx` | 2 cols ≥980 (sticky aside), 1 col below | breadcrumbs, TOC smooth-scroll, side nav with SOON/current | `page-*` (11 viewports) | — | MATCH |
| About, Why, Shipping, Returns, Warranty, Condition guide, How to choose, Comparison guide, Terms | `isPage` + `lh-content` | `app/pages/[slug]` + `lib/content/*` | as above | links, CTA, products | `page-*` ≤0.13% except shipping (corrected copy, ≤4.4% mobile) | template content shown only when the CMS row is published; today all gated | MATCH (template) / GATED (publication) |
| FAQ (collapsed + expanded) | `isFaq` | `content/content-client.tsx` `FaqList` | — | accordion, aria-expanded, SOON tags | `page-faq`, `faq-expanded` | CRM-configuration question removed (false on live store) | MATCH\* / GATED |
| Contact + form | `isForm` | `ContactForm` → `/api/contact` | — | idle, invalid, submitting, success, failure; honeypot; focus/scroll to confirmation | `page-contact`, `contact-*` | real submission; truthful note + confirmation copy | MATCH\* (form always live) |
| Order inquiries, Privacy | `isPage` | as above | — | — | `page-order-inquiries`, `page-privacy` | prototype statements corrected (inquiries are stored; storage table) | MATCH\* / GATED |
| Guides index + 4 articles | `guides` / `article` | `app/guides`, `app/guides/[slug]` | — | article cards, matching products | `guides-index`, `guide-*` ≤0.08% | — | MATCH (template) / GATED |
| Gated page (live default) | — (V5 pending block, customer view) | `lib/content/resolve.ts` | — | Contact us link | `parity-gated/*` (next-only) | V5 has no fully-gated page; built from V5's own pending block | n/a |
| Missing page/article | `notFound` | `notFound()` → V5 404 | — | — | `page-missing` 0–0.06% | — | MATCH |
| Checkout, order success, track order | (not in V5) | existing | — | — | — | COD disabled | n/a |

## Next
1. Owner: approve content (publish rows in /admin/content; legal pages also need legal approval) — `docs/OWNER_CONTENT_NEEDS.md`.
2. Owner: media rights for cutouts → host approved copies and set `V5_CUTOUT_BASE` in Vercel.
3. Isolated Supabase (local Docker stack or branch) for the role matrix and COD concurrency tests.
4. Real-device pass (iOS Safari, Android Chrome).
