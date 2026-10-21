# Responsive QA

Tool: `QA Viewports.html` (real-width same-origin iframes; overflow + text-collision audit). Details and defect table: FINAL_QA_REPORT.md.

| Width | Geometry (overflow + overlap, 16 states) | Visual |
|---|---|---|
| 1440 × 900 | Pass 16/16 | Not captured (tool limit) |
| 1280 × 800 | Pass 16/16 | Not captured |
| 1024 × 768 | Pass 16/16 | Not captured |
| 905 × 800 | Pass 16/16 | Inspected: home, Chromebooks, PDP, warranty (`qa-evidence/0x-v5-final-905.jpg`) |
| 768 × 1024 | Pass 16/16 | Not captured |
| 430 × 932 | Pass 16/16 (after fix #9) | Not captured |
| 390 × 844 | Pass 16/16 | Not captured; functional mobile suite at 390 passes 11/11 |
| 360 × 780 | Pass 16/16 | Not captured |

Final run: 128/128. `scrollWidth` ≤ viewport at every width and state.

## Breakpoints in code
<760 mobile (hamburger, filter drawer dialog, stacked hero, Chromebook chips hidden) · <900 PDP/cart single column · <980 content pages single column · <1000 tablet hero/story · ≥1180 desktop nav links + mega feature card.

## Still required on real devices
iOS Safari + Android Chrome: pinned story with touch momentum, address-bar resize, compare tray over PDP thumbnails at tablet widths, keyboard overlap on forms.
