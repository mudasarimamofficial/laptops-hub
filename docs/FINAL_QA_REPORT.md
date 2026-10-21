# Final QA report — V5 frontend

## Catalog integration pass (232 products) — latest
| Suite | Result | Evidence |
|---|---|---|
| Catalog reconciliation (`QA Catalog.html`) | 27/27 | `qa-evidence/01-catalog-recon.jpg` |
| Functional (`QA Functional.html`) | 162/162 | `qa-evidence/functional-catalog-final.jpg` |
| Layout (`QA Viewports.html`, 8 widths) | 128/128 | `qa-evidence/layout-catalog.jpg` |

Reconciliation covers: 968 CSV rows → 232 handles; 226 active+published; 6 drafts not routable and not shown; all 50 original handles + 182 new; no duplicate handles; 964 image URLs per product in CSV order, none shared; prices and titles 232/232; Chromebook = HP Chromebook 14 G5 only, Type-C charger = accessory; no qty/policy fields in public data; every one of the 226 PDPs shows its own title, price, primary image and gallery count with no stock wording; 12 listing routes scanned for stock wording and draft titles.

Functional suite changes: catalog block covers 226 PDPs (Add to cart present, no stock wording) + 6 drafts hidden; search adds MacBook/Chromebook/charger/Alienware queries; collections re-derived for 39 collections (+2 legacy aliases), category facet, no availability filter; cart verifies 5 units of one product (no inventory cap) and an accessory line; compare mixes MacBook, Chromebook and gaming laptop and checks there is no availability row.

Defect found: null `intro`/`outro` values in the new data hung the prototype page on load (any route). Fixed by normalising text fields to empty strings and giving new products a neutral description line. Retest: page loads; all suites pass.

Visual check (905px preview only): home, Chromebook section with the real product, All products grid with category badges, Chromebook PDP. Other widths geometry only.

---


Date: 2026-10-20 (closure pass) · Build: `Laptops Hub Storefront v5.dc.html` (post-QA fixes + story/tray fix) · Rollback: `Laptops Hub Storefront v5 (pre-QA checkpoint).dc.html`

## How tests were run
| Tool | What it does |
|---|---|
| `QA Viewports.html` + `qa/lh-qa.js` | Loads the real storefront in 8 same-origin iframes at 1440, 1280, 1024, 905, 768, 430, 390, 360. Per state: horizontal-overflow audit + text-collision detection. 16 states × 8 widths = 128 checks. |
| `QA Functional.html` + `qa/lh-functional.js` | Drives the real storefront (1280 desktop, 390 mobile, 1280 reduced-motion) with DOM clicks, typed input, keyboard events, reloads and history navigation; asserts DOM and localStorage. Expected values are re-derived from `data/lh-catalog.js`, not copied from the UI. Restores the tester's own `lh_*` storage afterwards. |

Environment notes (affect method, not results):
- The design tool's preview tab is hidden between captures, so browser timers are throttled and `requestAnimationFrame` does not fire. The harnesses use an unthrottled scheduler; the cinematic test installs a visible-tab rAF shim in its own iframe only. The storefront code is not modified for testing.
- Screenshot capture cannot render iframe contents, so visual evidence exists only at the preview width (905px). All other widths are geometry-verified, not visually inspected.
- The capture tool also re-renders the DOM without honouring scroll position on sticky elements, so the **pinned** story state could not be visually captured at any size. Story checks below are measurements.
- The prototype runtime paints the raw template for ~250ms before the page logic attaches. Tests that observe early UI (Skip intro) wait until the logic is live (story frame no longer `position: static`).

## Results
### Layout suite — 128 checks, 128 pass, 0 findings (final run)
Evidence: `docs/qa-evidence/layout-final.jpg`, `suite-detail.jpg`.
States: home (mid-entrance 0.7s, settled, story pinned, Chromebooks), all, Chromebooks, 2 PDPs, compare (empty, 3 items), cart (empty, 2 lines), FAQ, contact, guide article, 404.
Runs: QA pass run 1 = 128/128; run 2 after accessibility fixes = 4 findings → fixed → run 3 = 128/128. Closure pass: after story fix (#12) = 128/128; after tray + reduced-motion fixes (#13, #14) = **128/128** (final).

### Functional suite — 152 checks, 152 pass, 0 fail (final run, 195s)
Evidence: `docs/qa-evidence/02-functional-final.jpg`, `cinematic-3x.jpg`.
| Area | Pass |
|---|---|
| Catalog (50 PDPs: title, price, availability text, main image src + load, alt "photo 1 of N", thumbnail count = image count, thumbnail select; gallery arrows + wrap; unknown handle) | 6/6 (50/50 products) |
| Search (brand, model, CPU, spec combos, touch, gen, no-results, Enter → results page with correct count, Clear, Esc, backdrop, scroll lock, focus return) | 17/17 |
| Collections (26 catalog collections count + first-page cards; Chromebooks customer copy; single, OR-within-facet, AND-across-facets, price band, availability, Clear all, empty state, 3 sorts, Load more, reset on collection change) | 14/14 |
| Cart (empty state, add in-stock, cap at stock qty, add available-to-order, sold-out has no Add to cart, drawer focus + Esc + focus return, qty ±, subtotal recalculation, header count, reload persistence, remove, empty again) | 19/19 |
| Compare (empty, add 4, 5th refused with toast, PDP state, 4 columns, values match catalog, differences-only, remove, reload persistence, tray, clear) | 11/11 |
| Forms & storage (legacy `lh_inquiries` removed on load; `lh_cart`, `lh_compare` and an unrelated key survive; contact + inquiry validation; "Demo only … not sent"; nothing written to storage; dialog focus trap both directions; Esc + focus restore + scroll unlock; FAQ accordion) | 16/16 |
| Navigation (no `#`/empty links on home; all internal home links resolve; 20 content/utility routes render exactly one H1; 404 for route + collection; back/forward ×4; mega menu aria-expanded + Esc) | 12/12 |
| Customer content (Chromebooks, Warranty, Returns, Shipping, Privacy, Terms, Contact, Order inquiries, Guides hub, 4 articles, home: no internal/dev strings, no unresolved tokens) | 14/14 |
| Mobile 390 (filter drawer = modal dialog, focus in, trap, apply filter, Esc + focus return + unlock; mobile menu dialog; cart drawer full width; steppers 44×44; compare table scrolls inside its container with no page overflow) | 11/11 |
| Accessibility scan (10 routes: img alt, control names, field labels, one H1, heading order, text contrast; focus-visible rule; reduced-motion rule; mobile targets ≥24px; live region) | 14/14 |
| Cinematic (first frame H1 visible, Skip intro shown, Skip click dismisses and settles hero, CTA targets, in-page anchor keeps home, mouse parallax, pinned span 1.49 viewports, progress 0→1, pinned while scrolling, chapter follows scroll Front › Left › Right › Rear, chapter button, spec reveal complete, scene exit, reduced-motion injection confirmed, reduced motion: no skip, not pinned, 4 angle images, all specs visible) | 18/18 |

**Skip intro timing (previous 1 failure).** The old test looked for the button once, after the page reported ready, so it raced the 2.6s display window. Rewritten: a watcher polls the frame from navigation start, counts the button only once page logic is live, clicks it like a user (retrying until handlers are bound) and passes only if it disappears within 200ms of a click and well before the 2.6s auto-dismiss. Reduced-motion injection is confirmed to land before app start (load retried if not; this is harness setup, not an assertion retry). Three consecutive cinematic runs: 18/18, 18/18, 18/18; the full run: 18/18. While fixing this, the test exposed a real defect (#14).

### Product story fit — measured (not visual)
Script in this report's evidence `story-measure-2.jpg`. Storefront loaded at each size with 3 items in compare (tray active) and live scroll frames; story scrolled to 5%, 40%, 75%, 95% of its pinned span. Checked: heading, visible product image, price, stock text and CTA buttons fully inside the visible pinned frame; CTA hit-test returns the button (not covered) once the CTA is enabled; compare tray hidden during the story and shown after it.
| Size | Frame (px) | CTA bottom | All parts inside | CTA reachable | Tray during / after |
|---|---|---|---|---|---|
| 1897×860 | 72–860 | 716–736 | Yes, all 4 positions | Yes | Hidden / shown |
| 1366×680 | 72–680 | 605–625 | Yes | Yes | Hidden / shown |
| 1024×768 | 72–768 | 688 | Yes | Yes | Hidden / shown |
| 768×1024 | 72–1024 | 792–812 | Yes | Yes | Hidden / shown |
| 390×844 | 72–844 | 821–841 | Yes (3px spare at start) | Yes | Hidden / shown |
At 1024×768 at 5% (entry), the laptop image is still sliding in from below by design. Some samples lagged one frame in the hidden preview and were re-read; values above are from samples where scroll progress matched position.

## Defects found and fixed this pass
| # | Route / width | Component | Expected | Actual | Root cause | Fix | Retest |
|---|---|---|---|---|---|---|---|
| 1 | Home, all | Hero "Explore categories" + Chromebook pill | Scroll to section | **Rendered the 404 page** | `#brands` / `#chromebooks` parsed as routes | Non-route hashes (no `#/`) leave the route unchanged; browser scrolls | Pass |
| 2 | PDP | Gallery arrows | Each click moves one image | Rapid clicks could drop steps | Handler used render-time index | Functional state update | Pass |
| 3 | Cart drawer + cart page, 390 | Qty steppers | 44×44 | 44×42 | 1px border inside 44px wrapper | Wrapper 46px | Pass (44×44) |
| 4 | Cart, drawer, compare | Image links | Named or hidden | Unnamed duplicate links | Image link next to text link | `aria-hidden` + `tabindex=-1` | Pass |
| 5 | 404 | "404" kicker | ≥4.5:1 | 4.29:1 | Signal red at 12px | Ink-2 | Pass |
| 6 | Home, PDP, 390 | "View all" links | ≥24px target | 20px tall | Inline text link | min-height 44px | Pass |
| 7 | Global | Toast | Announced | Live region inserted with its text (unreliable) | Conditional render | Persistent hidden `role=status`; visible toast aria-hidden | Pass |
| 8 | Dialogs | Initial focus | Newest dialog's first button | 30ms timer, first dialog in DOM | Timer + selector | Synchronous focus on newest dialog; search focus after opener capture (regression found and fixed in the same pass) | Pass |
| 9 | Home, 430 | Chromebook visual | Text readable | Decorative chips covered "Photos coming soon" | Absolute chips on narrow column | Chips hidden below 760px | Pass |
| 10 | Policy pages, 905 | "Contact us" pill | One line | Wrapped to two | Flex shrink | nowrap | Visual pass |
| 11 | Any image | LHImg | No broken-image icon | Broken icon on failed load | No error handler | `onError` hides the img; tile background remains | Code review (no failing URL in catalog) |
| 12 | Home story, wide and short screens (e.g. 1897×860, 1366×680) | Story right panel | Price + Add to cart inside the pinned frame | Price card cut off at the bottom | Spec cards stacked 1 column on desktop; heading sized by width only | Spec cards 2 columns at all widths; heading capped at 6.2vh | Pass (CTA bottom 736 / frame 860 at 1897×860; 625 / 692 at 1366×680) |

| 13 | Home story, any width with items in compare (critical at 390) | Story Add to cart | Reachable | Floating compare tray covered the story CTA for the whole pinned span on mobile | Fixed tray (z 45) overlaps the pinned frame's bottom | Tray hidden while the story occupies the tray zone; reappears after | Pass (hit-test at 5 sizes) |
| 14 | Home, reduced motion | Skip intro | Never shown | Flashed for one render after mount | `rm` state initialised false, set in componentDidMount | Initial state reads matchMedia | Pass (3 runs) |

Previous-pass fixes re-verified: hero Compare vs Chromebook pill (all widths, mid-entrance), 360px overflow, compare heading, Chromebook customer copy, forms store nothing.

## Not verified (needs a real browser / device)
- Visual inspection at 1440, 1280, 1024, 768, 430, 390, 360 (geometry only here)
- Visual inspection of the pinned product story at any size, including 1897×860, 1366×680, 1024×768, 768×1024, 390×844 (measured only)
- 390px story: CTA sits 3px above the frame bottom at scroll start; check against iOS Safari's bottom toolbar
- iOS Safari and Android Chrome, real touch scrolling of the pinned story, momentum scroll
- Screen readers (VoiceOver, NVDA, TalkBack)
- Performance (LCP/CLS/INP) on a mid-range phone
- Image loading over slow networks; Shopify CDN availability
