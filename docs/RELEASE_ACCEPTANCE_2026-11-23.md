# Release acceptance — 2026-11-23

## Baseline
- Previous main: `992723d`
- Previous production deploy: `dpl_7taivjMfTu42pMcEE8Sau7MNvwXJ` @ `676698e`

## Gates

| Gate | Status |
|------|--------|
| TypeScript (`tsc --noEmit`) | PASS |
| Unit pricing + image-url | PASS |
| Production build | (recorded at merge) |
| Migration applied (`xvmmjkrkgznnakcobmww`) | PASS — Storewide 5% Off active; keepalive RPC present |
| SITE_PRELAUNCH on Production | unset → launch indexing mode preserved |
| Live COD order test | BLOCKED (business) |
| Field Lighthouse / CWV | NOT TESTED |
| Keepalive scheduled run | PARTIAL until first Actions run |
| NVDA / reel rights | NOT TESTED / BUSINESS PENDING |

## Rollback
Redeploy previous READY deployment `dpl_7taivjMfTu42pMcEE8Sau7MNvwXJ` and/or disable the Storewide 5% campaign in Admin → Discounts.
