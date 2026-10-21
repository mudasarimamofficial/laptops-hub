# Functional QA

Automated: `QA Functional.html` → "Run functional suite" (about 3 minutes). Final result (232-product catalog) 162 checks, 162 pass; catalog reconciliation in `QA Catalog.html` 27/27; per-area table and defects in FINAL_QA_REPORT.md.

## Collection counts (re-derived from catalog, matched in UI)
all 226, laptops 170, gaming 2, MacBooks 2, Chromebooks 1, tablets 6, accessories 50, chargers 31, workstations 8, 2-in-1 14, business 107, dell 76, hp 58, lenovo 50, apple 3, microsoft 8, asus 3, acer 4, toshiba 3, i3 10, i5 113, i7 40, i9 1, gen 6–7 55, gen 8 41, gen 10+ 56, 4GB 32, 8GB 77, 16GB 37, 128GB 28, 256GB 87, 512GB+ 13, 13" 14, 14" 27, 15" 5, touch 8, <40k 40, 40–60k 84, >60k 52.

## Storage keys
`lh_cart` (lines), `lh_compare` (handles, max 4). `lh_inquiries` is legacy and removed on load; verified that cleanup leaves cart, compare and unrelated keys intact. Forms write nothing.

## Manual checks still recommended in a real browser
1. Real mouse/touch on hero parallax and pinned story (automated with synthetic events here)
2. Smooth scroll for chapter buttons on Safari
3. Toast timing and screen-reader announcement
4. Back/forward after scrolling (scroll restoration)
