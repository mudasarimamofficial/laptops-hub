# Release acceptance — 2026-11-23

## Production release

| Field | Value |
|------|--------|
| Source commit | `2480f479336c2d80e07070c670d860e90eed932a` |
| Pull request | [#57](https://github.com/mudasarimamofficial/laptops-hub/pull/57) — **MERGED** 2026-11-23T10:01:22Z |
| Production deployment | `dpl_F3R21w694a3187bRyx9L8ZAh2kSu` |
| Ready state | **READY** |
| Aliases | `www.laptopshub.pk`, `laptopshub.pk`, `laptopshubpk.vercel.app` |
| Supabase project | `xvmmjkrkgznnakcobmww` (Free plan preserved) |

## Baseline / rollback

| Item | Value |
|------|--------|
| Previous main | `992723d904ea815eb9cfe548a6f65a87cbe84be1` |
| Immediate prior READY | `dpl_4ACDBP9SPvcX9fG4NNYqAgqHTC3j` @ `992723d` |
| Earlier READY (PR #55) | `dpl_7taivjMfTu42pMcEE8Sau7MNvwXJ` @ `676698e` |
| Soft rollback (promo only) | Admin → Discounts → disable **Storewide 5% Off** |

## Gates

| Gate | Status |
|------|--------|
| TypeScript (`tsc --noEmit`) | PASS |
| Unit pricing + image-url | PASS |
| Production build (Vercel) | PASS |
| Migration applied (`xvmmjkrkgznnakcobmww`) | PASS — Storewide 5% Off active; keepalive RPC present |
| SITE_PRELAUNCH on Production | unset → launch indexing mode preserved |
| Home 200 + promo bar | PASS — `FLAT 5% OFF STOREWIDE` live |
| Robots / sitemap | PASS — Allow:/; sitemap 280 URLs; no sitewide noindex |
| PDP JSON-LD discounted price | PASS — Dell 5400 list 49000 → offer 46550.00 PKR |
| Keepalive unauthenticated | PASS — HTTP 401 |
| Keepalive scheduled (GitHub Actions) | PASS — run `45152922915` HTTP 200 `touch_keepalive` ping_count≥2 |
| Historical QA order `LH-261118-77C0F6` | PASS — intact (`placed`, subtotal_paisa 18100000) |
| Live COD order test | BLOCKED (business — no live customer COD) |
| Field Lighthouse / CWV | NOT TESTED |
| Full 9-viewport Playwright matrix this pass | NOT TESTED (prior #55 preserved) |
| NVDA / reel rights | NOT TESTED / BUSINESS PENDING |

## Production smoke (read-only) — 2026-11-23

1. `GET https://www.laptopshub.pk/` → 200, promo present, Organization JSON-LD present, no `noindex`.
2. `GET /robots.txt` → Allow public; Disallow admin/api/checkout/cart/order/search/preview; Sitemap absolute www URL.
3. `GET /sitemap.xml` → 200, ~42KB, 280 `<loc>` entries.
4. Sample PDP `/products/dell-5400-core-i5-8th-gen-8gb-ram-256gb-storage` → Product JSON-LD price `46550.00` matches `4900000 * 0.95` paisa.
5. `GET /api/cron/keepalive` without secret → 401.
6. Authenticated GH Actions keepalive → 200 DB touch verified.

## Outstanding operator items

- Optional: run lab Lighthouse mobile on home + one PDP for CWV diagnostic scores (not claimed as field data).
- Business: authorize live COD acceptance test if needed.
- Monitor Supabase Free usage; keepalive reduces pause risk but **does not guarantee** perpetual Free-plan uptime.
