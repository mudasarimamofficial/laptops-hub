# PR #57 gap closure + content naming/price — 2026-11-23

## Defects verified

| Defect | Evidence | Classification |
|--------|----------|----------------|
| Featured Configuration `Dell Dell Latitude 3440` | Playwright probe home `featuredHeading` | Presentation: `brand` + `model` where model already includes brand |
| 211/226 active products: model starts with manufacturer | SQL audit on `xvmmjkrkgznnakcobmww` | Presentation risk if UI concatenates brand+model |
| Homepage promo/hero/story/brand “From” used list `pricePaisa` | `home-page-view.tsx` pre-fix | Discount display inconsistency vs PDP/cards |
| Discount `products`/`collections` scope accepted by API but not applied in storefront engine | Code review | Admin could configure incorrect pricing |
| Keepalive GH success with missing secret (skip exit 0) | Prior workflow | Misleading success |
| Keepalive evidence only `workflow_dispatch` | GH runs list | Schedule not yet observed |
| Homepage hero/story Shopify images downloaded at full natural width | Probe: 8 oversized; ~1.0MB image bytes on `/` | Performance bottleneck |

## Fixes

1. `formatProductDisplayName` + SEO helpers; PromoSection / hero / story / compare use them.
2. Homepage selling prices via `getActiveAutomaticDiscount` + `priceWithCampaign` (cart still stores list).
3. Storewide-only automatic discounts in engine + API; admin schedule fields; reject non-storewide writes.
4. Keepalive: GH fails without `CRON_SECRET`; notifications cron touches DB; failure email to `STORE_NOTIFY_EMAIL`.
5. Hero + product-story Shopify `width=` / `srcset`.

## Tests

- `tests/unit/product-display-name.test.ts` PASS
- `tests/unit/pricing.test.ts` PASS (incl. non-storewide no-op)
- `tests/unit/image-url.test.ts` PASS
- `tsc --noEmit` PASS

## Lab performance (diagnostic — not field CWV)

See `docs/visual-evidence/perf-2026-11-23/`.

## Rollback

1. Soft: Admin → Discounts → disable Storewide 5% (DB campaign; redeploy alone does not undo migration).
2. Code: redeploy prior READY `dpl_F3R21w694a3187bRyx9L8ZAh2kSu` @ `2480f47` or `dpl_4ACDBP9S…` @ `992723d`.

## External blockers

- First GitHub **schedule**-triggered keepalive run still PENDING (next UTC windows 01:17/07:17/13:17/19:17).
- Optional cron-job.org / UptimeRobot independent monitor: **BLOCKED** until owner creates account + Bearer job.
