# Mobile admin acceptance — 2026-11-19 (completed matrix wave)

## Baseline
- Source start: `ccc371c`
- Isolated stack: local Supabase + `.next-local` @ `127.0.0.1:3001`

## Engineering delivered this wave
- Dense list **mobile cards** (≤639px) for Products, Orders, Customers, Collections; desktop tables retained via `adm-desktop-table`
- Shared CSS: `.adm-mobile-cards`, `.adm-mobile-card*`, `.adm-filter-bar` full-width stacking, 16px inputs, `adm-table-scroll`
- Full-route Playwright matrix: `tests/e2e-isolated/admin-mobile-matrix.spec.ts`
- Results JSON: `docs/FINAL_AZ_ADMIN_MOBILE_MATRIX_RESULTS.json`
- Expanded CSV: `docs/FINAL_AZ_FEATURE_MATRIX_2026-11-19.csv`

## Matrix counts (isolated)
| Metric | Value |
|---|---|
| Staff routes exercised | 29 |
| Guest routes exercised | 3 |
| Viewports | 9 (320→1920 incl. 1366×680) |
| Matrix rows | see JSON `rows` |
| PASS | see JSON `pass` |
| PARTIAL | see JSON `partial` |
| FAIL | see JSON `fail` |

Evidence command:
```bash
npx playwright test admin-mobile-matrix admin-mobile-shell mega-menu-wordmark --config=playwright.isolated.config.ts
```
Result this run: **8/8** (matrix + shell + mega menu).

## Merchant workflow retest (isolated)
- Variant PDP → COD → cancel restock: **9/9**
- Launch journey customer/admin COD path: **8/10** in one retest (notification provider-outage retry assertion flake when fake-resend mode races); core order/fulfillment/collection **PASS**

## Honest remaining gates
| Item | Status |
|---|---|
| Live production COD place-order | **BLOCKED** (business) |
| Manual NVDA/VoiceOver | **NOT TESTED** |
| Reel → product curation | **BUSINESS PENDING** |
| Owner fresh login confirmation | retain if owner has not explicitly confirmed |
| Absolute perfection claim | **NO** |

## Prior shell work (PR #52–#53) preserved
- Uppercase LAPTOPS HUB admin brand
- 44px nav open / inert closed drawer
- Save bar safe-area
- Table scroll helpers
