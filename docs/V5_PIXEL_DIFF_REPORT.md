# V5 Pixel Diff Report

Baseline tooling: Playwright Chromium · Next.js `http://127.0.0.1:3000` · Reference `http://127.0.0.1:4173` (`reference/v5`).

| Route | Viewport | Browser | Reference shot | Implementation shot | Diff | Metrics | Root cause | Fix | Remaining |
|---|---|---|---|---|---|---|---|---|---|
| `/` home | 1897×860 | Chromium | Pending automated pair | `docs/visual-evidence/home-desktop-1897x860.png` | Pending | Smoke pass | Intro opacity-0 hid content in early captures | Hero always LCP-visible + skip wait in tests | Cutouts vs CDN photos; stage.png CSS stand-in |
| `/` home | 1440×900 | Chromium | Pending | `home-laptop-1440x900.png` | Pending | Smoke pass | Same | Same | Header actions crowding at mid widths TBD |
| `/` home | 768×1024 | Chromium | Pending | `home-tablet-768x1024.png` | Pending | Smoke pass | — | — | Composition stack vs V5 tablet |
| `/` home | 390×844 | Chromium | Pending | `home-mobile-390x844.png` | Pending | Smoke pass | — | — | Mobile layering vs V5 |
| `/#story` | 1897×860 | Chromium | Pending | `story-1897x860.png` | Pending | Smoke pass | Cutouts unavailable | Catalog multi-angle CDN | Angle fidelity |
| `/search` | 1280×800 | Chromium | Pending | `search-dell.png` | Pending | Smoke pass | — | Overlay added (not in this shot) | Overlay vs full page |
| `/collections/laptops` | 1280×800 | Chromium | Pending | `collection-laptops.png` | Pending | Smoke pass | — | Card chrome updated | Filter drawer polish |

## Known systematic deltas (justified)
1. **Media rights:** Dell/HP/Lenovo cutouts and `stage.png` remain in `reference/v5/assets` only — not served publicly (`docs/MEDIA_RIGHTS_CUTOUTS.md`).
2. **Live catalog:** Prices/counts/images reflect Supabase, not the frozen `lh-catalog.js` snapshot.
3. **Font rasterization / DPR:** Expect sub-pixel AA differences under Windows vs macOS reference captures.

## Next measurement pass
Serve reference + Next with identical viewports, disable animations (`prefers-reduced-motion` or skip), sync product fixtures where possible, then compute pixel/SSIM diffs into this table.
