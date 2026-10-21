# Component inventory

| Component | Location | States | Shopify section/snippet |
|---|---|---|---|
| Announcement / prototype flag | root, prop showFlags | on/off | announcement-bar |
| Header | root header | sticky, mega open, mobile | header.liquid |
| Mega-menu | header, menuGroups | open/closed, feature card ≥1180px | header block "mega_group" |
| Mobile nav | mnav dialog | accordion groups | header (drawer) |
| Search overlay | sOpen dialog | empty/popular, results, none, see-all | predictive-search |
| Hero (cinematic) | #top | intro, skip, pointer, scroll, reduced-motion | hero-cinematic |
| Product story (pinned) | #story | 4 chapters, CTA reveal, RM grid | product-story |
| Chromebook campaign | #chromebooks | pending | promo-chromebook |
| Brand tiles | #brands | hover | collection-list |
| Product grid / row | stockCards, newGenCards | grid, scroll row | featured-collection |
| Featured configuration | promo | — | featured-product |
| Spec tiles / budget tiles | quickLinks, budgetTiles | — | collection-list (blocks) |
| Compare teaser | compare section | demo table | compare-teaser |
| ProductCard v5 | ProductCard v5.dc.html | category badge, comparing, hover 2nd image | card-product.liquid |
| LHImg | LHImg.dc.html | loading, loaded, error | image snippet |
| Collection header + filters + chips + load more | isCollection | mobile drawer, empty | main-collection-product-grid + facets |
| PDP | isProduct | gallery, qty, add, inquiry fallback (if not purchasable), compare, policies, spec sheet, related (same category) | main-product |
| Compare table | isCompare | empty, diff-only | page.compare |
| Cart drawer / page | drawer, isCart | empty, lines, qty ± | cart-drawer, main-cart |
| Inquiry dialog | inqOpen | form, errors, saved | contact-form (custom) |
| Content page | isPage | hero, blocks, TOC, side nav | page.json + content blocks |
| Content blocks | pg.blocks | h2, p, list, table, pending, faq, links, cta, products, articles, form | section blocks / metaobjects |
| Compare tray | trayShown | hidden on content, compare, cart routes | compare-tray |
| Toast | hasToast | — | — |
| Footer | footer | 5 link columns | footer.liquid |
| 404 | notFound | generic / product | 404.json |
