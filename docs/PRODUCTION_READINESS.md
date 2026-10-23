# Production readiness

Updated: 2026-10-21 (V5 parity sprint)

| Gate | Status | Notes |
|---|---|---|
| A — Source integrity | PASS | Git history preserved; V5 in `reference/v5/` gitignored; secrets not committed |
| B — Visual parity | PARTIAL | Hero/header/card/search/cart advanced; cutouts blocked; pixel-diff matrix incomplete |
| C — Functional parity | PARTIAL | Browse/search/compare/cart work; COD UI present but checkout disabled |
| D — Data & security | PASS* | P0 probes 9/9; catalog counts stable; *re-run role matrix before enable COD |
| E — Business readiness | FAIL | Media rights, shipping fees, legal, contact, staff bootstrap pending owner |
| F — Release | BLOCKED | No `--prod` until E + B/C close; Preview deploy authorized |

## Engineering green lights
- `npm run build`
- `npm run test:unit`
- `npm run test:security:p0` → 9/9
- `npm run test:visual:v5` → 8/8 (smoke)

## Do not enable yet
- `COD_CHECKOUT_ENABLED=true`
- Production promote / custom domain cutover
