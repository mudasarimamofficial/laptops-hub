# 02 — Root-cause evidence

All measurements are real layout geometry (`getBoundingClientRect`, `elementFromPoint`, `elementsFromPoint`, computed styles), taken read-only on production or on the isolated local build. Nothing was guessed from screenshots alone.

## VIS-001 / VIS-003 — map painting into the header and promotion bar (phones)

| Measurement (production, 375×667, before #107) | Value |
|---|---|
| Map section `position` | `sticky; bottom: 0` (the reveal-from-under-the-footer effect) |
| Map section height | 644px (`clamp(420px, 78svh, 720px)`) |
| Map section top while pinned | 23px, i.e. under the header and promo bar |
| Header background | `rgba(247,250,255,.84)` with `backdrop-filter` |
| Promotion bar | not positioned (`position: static`) |

**Cause.**
- A sticky element paints above non-positioned in-flow blocks, so the pinned map painted over the promotion bar. That was the "clipped" promo text.
- The translucent, blurred header showed the pinned map through it. That was the "Open in Maps" text and the faded look.
- The phone layout never needed the pinned effect: the map is taller than the space between the header and the bottom of the screen.

**Fix (#107).**
- The pinned reveal applies only at `min-width: 761px` and `min-height: 700px`, with no reduced-motion preference.
- On phones and short windows the map is an ordinary section after the footer.
- The promotion bar is lifted with the page while pinning is active.
- The phone header uses `rgba(247,250,255,.97)`.

## VIS-002(a) — pinned map reaching the header on short desktop windows

| Production, before #107 | Map top | Header bottom | Clearance |
|---|---|---|---|
| 1366×768 | 169 | 109 | 60px |
| 1918×542 | 119 | 109 | **10px** |

Any shorter window, or browser zoom, made them overlap. This is the "artifact that changes after scrolling". **Fix (#107):** no pinning below 700px window height.

## VIS-002(b) — hero decoration over the promotion bar (desktop/tablet, first 2.6 s)

`elementsFromPoint(687, 18)` at 1366×768, 400 ms after load, returned an `aria-hidden` hero `div` instead of the promo bar's text. The element:
- `position:absolute; right:-6%; top:-30%; width:60%; height:160%; z-index:-4`;
- background: a white diagonal gradient;
- transform: `rotate(8deg)`.

Live production, 1366×768 at load: **200 sample points** over the bar belonged to it; after scrolling, 0.

**Cause.**
- During its 2.6 s intro the hero section deliberately keeps `overflow: visible; isolation: auto`, so the LCP heading and image are never clipped.
- Its decorative layers extend above the section: the sweep at `top:-30%` and the dot grid at `inset:-40px`.
- With negative z-index and no isolation, they join `<main>`'s stacking context, which is above the promotion bar.
- The source comment claimed the decorations were clipped; they were not.

**Fix (#110).**
- Only the three `aria-hidden` decorative layers are wrapped in one `overflow:hidden; inset:0` box.
- The section and the LCP nodes are untouched, and the stacking order inside is unchanged.
- The clip equals the section's own clip after the intro, so the resting look is identical.
- No z-index escalation.

## VIS-004 — phone map card

Before (CSS module): the card had `margin: -28px 16px 16px` over a map `clamp(300px, 52svh, 440px)` tall, inside the 644px pinned section.

**Fix (#107).**
- Map frame `clamp(280px, 46svh, 380px)`.
- Card `position: relative; margin: 16px 16px 0`, with no negative margin and no absolute position.
- Section bottom padding `calc(76px + env(safe-area-inset-bottom))`, so the WhatsApp button never covers the card's buttons at the end of the page.
- Card has a solid white background, without `backdrop-filter`.

**Live:** map 307px; card 16px below it; `position: relative`.

**Found while testing:** on a phone, jumping straight to the end of the page never loaded the map. The lazy-load sentinel used a bottom-only `rootMargin`, so a jump past it was missed. Fixed with a symmetric `600px` margin (#107). Focusing the map card no longer scrolls the page when the map is not pinned (#107).

## VIS-005 — mega-menu Help

| Production 1366×768, before #109 | Value |
|---|---|
| `.v5-mega-panel` | max-height 440px |
| `.v5-mega-body` (scrolls) | clientHeight 376, scrollHeight 394 |
| `.v5-mega-groups` | `position: sticky; top: 0; max-height: 100%`; 9 × 40px rows = 368px |
| Help bottom vs body visible bottom | 491.5 vs 485.5: **cut off by 6px** |

**Cause.**
- `max-height: 100%` never applied to the sticky column, because the grid row has no definite height.
- The column plus the body's padding (394px) was taller than the visible body (376px).
- A sticky element taller than its scrollport keeps its top pinned, so Help stayed hidden behind the footer until the body was scrolled to its very end.

Re-applying the old rules on the fixed local build reproduced it exactly (panel 440, Help clipped).

**Fix (#109).**
- Panel cap 480px (432px at ≤700px tall). The panel is still content-sized and limited by the window.
- The column gets a definite `max-height` equal to the body's visible height, so it always fits; a longer merchant menu scrolls inside the column.

**Live:** panel 458; Help bottom 491.5 vs visible bottom 503.5.

## VIS-006 — WhatsApp shape

Production before: 68×52 on phones. The label is hidden on phones, but the pill padding `0 16px 0 12px` stayed.

**Fix (#108).**
- Size and shape moved from inline styles to `.lh-wa-float`.
- Phones (`<760px`): 56×56, padding 0, gap 0, round, icon centred.
- Wide screens: unchanged pill with label.
- Visible `:focus-visible` outline.

**Live:** 56×56 at 390; 201.75×52 pill at 1366; same merchant link. The computed corner radius reports `999px`, which comes from the existing inline pill radius; on a 56px square it renders as a full circle (any radius ≥ 28px does).

## HYD-001 — checkout hydration mismatch (found by the full run, 2026-11-27 evening)

**Symptom.** In the interrupted full run (`4e4daac`), `launch-journey` › "checkout: unserved address and invalid phone are refused" failed: after the city and province were typed, no delivery message, no options, totals "—". The 2026-11-26 baseline had recorded the same check as a "flaky quote message".

**Evidence (trace).**
- Page loaded at t = 398643 ms; the test began typing the city at 398672; **React error #418** (hydration text mismatch) fired at 398885, in the middle of that fill. The province was selected after it.
- No request to `/api/checkout/quote` was ever sent: the city typed into the server HTML was discarded when React rebuilt the form after the mismatch.
- Read-only repro on the isolated build (`/checkout` with one cart line in `localStorage`, Chromium at 4× CPU throttle): **#418 on 5 of 8 loads**.

**Cause.**
- `useCart` / `useCompare` pass `() => memory` as the `useSyncExternalStore` server snapshot. `memory` is a module variable that `read()` overwrites with the real cart the first time any component reads `localStorage`.
- The header (cart count) hydrates first and reads the cart. The checkout form sits in its own `<Suspense>` boundary (it uses `useSearchParams`), so on a busy page it can hydrate in a later pass. It then gets the *real* cart as its "server" snapshot ("Items: Rs 70,000") while the server HTML was rendered from an empty cart: text mismatch, React discards that subtree and client-renders it.
- Effect on customers: a shopper who types quickly right after the page appears on a slow phone can lose what they typed into the checkout form (the same applies, less visibly, to `/cart` and `/compare`).

**Fix.** The server snapshot is now a constant empty state (`getCartServerSnapshot`, `getCompareServerSnapshot`), exactly what the server rendered. React hydrates against it and then re-renders with the real cart, as `useSyncExternalStore` intends. No price, quote, cart-storage or checkout logic changed.

**Regression test.** `tests/e2e-isolated/ui-store-hydration.spec.ts`: `/checkout`, `/compare`, `/cart` with a saved cart and compare list, 6 throttled loads each, no hydration error allowed (Chromium).

## SEO-001 — `/cart` was indexable (found in the production check)

Live `/cart` returned `index, follow` with the generic title "Laptops HUB" and no canonical, unlike `/checkout`, `/compare` and `/track-order` (all `noindex`). `robots.txt` already disallows crawling `/cart`, so the risk was low (a URL-only listing from external links). Fix: `src/app/(storefront)/cart/layout.tsx` sets `noindex, follow`, title "Cart" and canonical `/cart`, the same pattern as `/compare`. `seo-search-appearance.spec.ts` asserts it.
