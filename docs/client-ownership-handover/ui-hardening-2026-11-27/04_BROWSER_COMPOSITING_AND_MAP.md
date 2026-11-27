# 04 — Browser compositing and the store map

## How the map section works now

| Window | Behaviour |
|---|---|
| ≥ 761px wide **and** ≥ 700px tall, no reduced-motion preference | The V5 reveal is kept. The map waits pinned (`sticky; bottom:0`) behind the page and footer. Those are lifted with an opaque background, and so is the promotion bar now. The map is uncovered at the end. |
| Phones, landscape phones, short windows (≤ 640 wide or ≤ 500 tall; or < 761 × 700 for pinning) | An ordinary section after the footer: map (280–380px) → card → end of page. Nothing pinned, nothing behind the header. |
| Reduced motion | Ordinary section, at every size. |

The Google Maps iframe still uses the merchant's own embed URL. There is no API key and no paid SDK. Location and business details are unchanged.

## Compositing rules this relies on (documented so they are not undone)

1. A **sticky or positioned** element paints above **non-positioned** in-flow blocks. Anything that must stay above a pinned layer (page, footer, promotion bar) is lifted with `position: relative; z-index: 1` **only while pinning is active**.
2. A translucent header with `backdrop-filter` shows whatever is pinned behind it. On phones the header is 97% opaque.
3. Decorative layers that extend outside their section must be clipped by that section or by a wrapper. Otherwise they join the parent stacking context and can paint over the bars above (VIS-002(b)).
4. Lazy loading by IntersectionObserver must use a symmetric margin, or a jump-scroll (End key, "back to bottom") skips the sentinel.

No `z-index: 999999` or similar escalation was used anywhere. Every fix removes the overlap at its source.

## Tests

`tests/e2e-isolated/ui-map-header-compositing.spec.ts` (11 tests). Run in Chromium, Firefox and WebKit: **11/11 in each**.
- Nine viewports (320×568, 375×667, 390×844, 430×932, 844×390, 768×1024, 1366×768, 1918×542, 1440×900): a grid hit-test that no map element sits under the promo bar or header, on a fresh load and after two scroll cycles. Also checks the promo is not clipped and the phone header alpha is ≥ 0.95. Pinned only at ≥ 761×700.
- Phone stacking (320×568, 390×844, 844×390): map, then card, then end; the map iframe loads after a jump to the end.
- Focus on the map card does not jump the page when the map is not pinned.

`ui-responsive-cross-route.spec.ts` repeats the header hit-test on 9 routes × 11 viewports at the top, middle and end (see `03`).

## Live production check (read-only, after deploy `H5pCTPGu74nz5Vix165V17viSUqL`)

- **375×667:** 0 non-header points inside the promo bar or header, at load and at 50/80/95/100% scroll. Header `rgba(247,250,255,0.97)`. Map section `relative`, iframe loaded, frame 307px, card 16px below and `relative`. Promo overflow 0.
- **1918×542:** 0 points at load, middle and end. Map not pinned.
- **1366×768:** after scrolling, 0. At load, 200 points from the hero decoration: VIS-002(b), fixed in #110; post-deploy result in `11`.
