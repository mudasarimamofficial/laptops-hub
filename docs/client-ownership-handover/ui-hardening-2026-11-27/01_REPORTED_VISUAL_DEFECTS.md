# 01 — Reported visual defects (owner report, 2026-11-27)

Each defect lists severity, where it shows, how to reproduce it, and how it was resolved. Root-cause measurements are in `02`; test and deploy records are in `10` and `11`.

| ID | Severity | Defect as reported | Page / viewport | Resolution | PR | Production |
|---|---|---|---|---|---|---|
| VIS-001 | P1 | Mobile promotion bar/header contaminated by the Google Map ("Open in Maps" visible); header looks faded | Home, phones (proven at 375×667) | **Fixed.** On phones the map is an ordinary section after the footer; the header is nearly opaque on phones | #107 `3296c9e` | `HJg5y5VZStTA6wWjX2Erp2rc2Nyd` success; live recheck 0 bleed points |
| VIS-002 | P1 | Desktop top-right artifact that changes after scrolling | Home, desktop/tablet (768–1918 wide) | **Fixed (two causes).** (a) The pinned map reached the header on short or zoomed windows: it now pins only at ≥761×700. (b) The hero's decorative light sweep painted over the promotion bar during the 2.6 s intro: the decorations are now clipped to the hero | #107, #110 | (a) live; (b) see `11` |
| VIS-003 | P2 | Mobile promotion text clipped ("FLAT 5% OFF STOREWIDE — Automatically Applied. No Code Needed." + "Shop now") | Home, phones | **Fixed.** The "clipping" was the map painting over the bar (VIS-001). "→ Shop now" no longer splits across lines | #107 | live: promo overflow 0 at 375 |
| VIS-004 | P2 | Mobile map card oversized; overlaps the map and the WhatsApp button | Home, phones | **Fixed.** Order is now map → card → end of page. The card is an ordinary block 16px below the map (no absolute position, no negative margin). The map is 280–380px tall, with bottom space kept clear of the WhatsApp button | #107 | live: map 307px, card 16px below, `position: relative` |
| VIS-005 | P2 | Mega-menu Help group clipped | Desktop header menu (1366×768 measured) | **Fixed.** Help was cut off ~6px behind the footer because the sticky category column was taller than the scrolling body. The column now always fits, and if it can't it scrolls on its own | #109 `756c668` | `5AFT3tF4eWTPzVGGXWigqvoUXLtE` success; live: Help 12px clear |
| VIS-006 | P2 | WhatsApp button on mobile is not a circle | All pages, phones | **Fixed.** 56×56 circle with the icon centred on phones; the desktop pill is unchanged; same merchant link | #108 `956899d` | `H5pCTPGu74nz5Vix165V17viSUqL` success; live: 56×56 at 390, 202×52 pill at 1366 |
| VIS-007 | P2 | Site-wide responsive audit | 9 routes × 11 viewports | **Audited.** New spec. The only finding was VIS-002(b) | #110 | see `03` |
| VIS-008 | P3 | Full-page whitespace and scroll continuity | Home | **Investigated, no blank screens.** The large band in stitched screenshots is the pinned product story's scroll runway (intentional V5) | #110 (test) | see `03` |

## Reproduction (before the fixes)

- **VIS-001/003:** open `/` on a 375×667 phone and scroll down slowly. Before the footer arrives, the map (pinned behind the page) shows through the header, and the promo bar's text is painted over.
- **VIS-002(a):** open `/` at 1918×542, or zoom the browser to 125%+ on a laptop. The pinned map's top edge comes within 10px of the header and overlaps it on shorter windows.
- **VIS-002(b):** open `/` at 1366×768 and look at the right half of the dark promo bar during the first ~2.6 s.
- **VIS-004:** on a phone, scroll to the end. The card sat over the map with a negative margin, and the map was up to 440px tall.
- **VIS-005:** at 1366×768, open "Laptops" in the header. The last group (Help) is cut off at its bottom edge.
- **VIS-006:** on a phone, the WhatsApp button measured 68×52 (desktop pill padding kept).
