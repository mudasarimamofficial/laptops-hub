# 03 — Responsive viewport matrix (VIS-007, VIS-008)

## Cross-route audit

`tests/e2e-isolated/ui-responsive-cross-route.spec.ts` covers 9 public routes × 11 viewports × 3 scroll positions (top, middle, end), all measured with real geometry.

**Routes:** home, `/collections/all`, product page, `/search?q=dell`, `/compare`, `/cart`, `/checkout`, `/track-order`, `/guides`.

**Viewports:** 320×568, 375×667, 390×844, 430×932, 844×390 (landscape phone), 768×1024, 1024×768, 1280×720, 1366×768, 1440×900, 1918×542.

| Check | Rule |
|---|---|
| Sideways scroll | `scrollWidth − innerWidth ≤ 1` |
| Header / promo bleed | Grid of `elementFromPoint` samples over the promotion bar and header. Every hit must belong to them, a dialog, or the WhatsApp button |
| Controls covered at page end | At the end of the page, no link or button in `main` or the footer has its centre under a floating overlay. Mid-page passes of the WhatsApp button and content scrolling under the sticky header are normal and not counted |
| Clipped text | No link or button whose text is wider than its clipping box without an ellipsis |

| Build | Findings |
|---|---|
| main + #107 + #108 (before #110) | **Only** the hero decoration over the promotion bar (VIS-002(b)): home at 768×1024, 1024×768, 1280×720, 1366×768 and 1440×900, at load |
| With #110 | **0 findings**. Chromium 9/9; results for all three engines are in `10` |

No sideways scroll, no clipped link or button text, and no control hidden at the end of any page, on any route at any viewport.

## Scroll continuity (VIS-008)

The same spec steps through the homepage by half a screen at 390×844, 1366×768 and 1918×542. A position is "blank" only if both measures agree: under 12% of a sample grid hits content, **and** no heading, text, image or control is painted below the header.

- Result: **0 blank positions** at all three sizes (3/3).
- Negative control: an empty 1600px block inserted into the page is flagged at 4 positions, so the check works.
- At 1918×542 the emptiest position (5% of the grid) is a section boundary: the next section's heading "10th gen and newer", its subtitle, "View all" and the rail arrows are visible, and the product rail starts half a screen lower. That is ordinary section spacing on a 542px-tall window, not a blank screen.

**Why stitched full-page screenshots show a large empty band.**
- At 1366×768 the "02 Product story" section is 1843px tall, but its content is a 696px sticky stage (`.v5-story-sticky`) that stays on screen while the visitor scrolls through the section.
- Measured at every 10% of that scroll, 41–48% of the screen holds content, with 2–3 story elements visible.
- A stitched screenshot captures the stage once, at its starting position, and shows the rest of the runway as empty.
- This is intentional V5 and was **not** removed (brief: do not delete intentional sections based on one stitched screenshot).
- On a 390×844 phone, 32 positions across the 13,974px homepage: none under 12% content.

## Earlier responsive coverage still in place

- `cross-browser-storefront.spec.ts`: 11 pages at 360/390/768/1024/1280/1440, no horizontal scroll, no uncaught errors.
- `ui-map-header-compositing.spec.ts`: 9 viewports (see `04`).
- `ui-mega-help-visibility.spec.ts`: 8 desktop viewports (see `05`).
- `ui-whatsapp-mobile-circle.spec.ts`: 7 phone widths plus desktop (see `06`).
