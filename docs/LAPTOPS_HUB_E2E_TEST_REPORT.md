# Laptops HUB — E2E Test Report (2026-11-14)

**Code under test:** `a534b18`. **Stack:** isolated only.
- Local Supabase seeded by `scripts/test-fixtures/seed-isolated.mjs`, plus a local owner account
- `next build` + `next start -p 3001`
- Fake Resend on `:4599`

**Machine-readable results:** `docs/LAPTOPS_HUB_E2E_TEST_REPORT.json` (per-test status and duration).

No test touched production. Every isolated spec refuses to run unless Supabase is on 127.0.0.1/localhost (`assertLocalOnly`).

## Results

| Suite | Command | Result |
|---|---|---|
| Isolated Playwright journeys (8 spec files) | `npx playwright test --config=playwright.isolated.config.ts` | **48/48 PASS** (3.8 min) |
| P0 admin isolation + checkout gates | `p0-admin-isolation-and-checkout-gates.spec.ts` | 10/10 |
| P1 storefront labels | `p1-storefront-labels.spec.ts` | 2/2 |
| Launch journeys (COD order, notifications, retry) | `launch-journey.spec.ts` | 10/10 |
| Content pages gating | `content-pages.spec.ts` | 8/8 |
| Home inquiry | `home-inquiry.spec.ts` | 7/7 |
| Staff password recovery | `password-recovery.spec.ts` | 5/5 |
| Shipping zones admin | `shipping-zones.spec.ts` | 4/4 |
| Pre-hydration form safety | `prehydration.spec.ts` | 2/2 |
| Unit tests (25 files) | `npm run test:unit` | **PASS** |
| Shipping/COD SQL matrix | `scripts/db-tests/shipping-cod-matrix.sql` (local, ROLLBACK) | **26/26 PASS** |
| Typecheck / lint | `npx tsc --noEmit -p .` / `npx eslint src tests --quiet` | **0 errors** |
| Production build | `npx next build` | **PASS** (fonts self-hosted) |

## What the P0/P1 specs prove

- **Admin isolation.** At 360, 390, 768, 1280 and 1440 px on `/admin`, `/admin/settings`, `/admin/products` and `/admin/orders`, none of these appear: storefront header, footer, or skip link. No horizontal overflow. The mobile drawer opens, and Escape closes it.
- **Storefront chrome.** Home, collection and checkout keep their storefront chrome.
- **Readiness matrix.** All 8 gates render. The status reads "Ordering open" on the fixture. The service-role key is absent from the HTML.
- **Rs 0 + Rs 0 zone.**
  - The page shows "Free delivery · No COD fee", "Delivery: Free", and cash due equal to the price.
  - The server quote returns `{shippingPaisa: 0, codFeePaisa: 0, totalDuePaisa: price}`.
  - The zone is restored afterwards.
- **Nonzero fees.** Exact fees and totals render. For an unserved city (Gwadar), the message reads "do not currently deliver COD" and the order button is disabled. The quote API returns no raw SQL text.
- **Blocking gate.** With `cod_checkout.enabled=false`, the shopper sees "Online ordering opens soon" and the button is disabled. Admin shows "Ordering closed" with `db_setting` = fail. The setting is restored afterwards.
- **Labels.** On `/` and `/collections/all` none of the following appear:
  - "N listings", "products in the catalog", "View all N"
  - "NN — X" section numbers, "· n/4" angle counters
  - "Laptops HUB hero" captions

  The owner toggles "Show catalog counts" in Admin, and the stored value reads back as `{showCatalogCounts:true, …false}`. The checkbox stays checked after reload, the public footer count appears, and section numbers stay hidden. The setting is removed afterwards.

## Notes for re-runners

- Load the local env first: `set -a; . ./.env.local; set +a`.
- The recovery endpoint is deliberately limited to 3 per hour per email, and password changes are limited too. Back-to-back reruns therefore hit those limits. Clear the **local** buckets with:
  ```bash
  docker exec supabase_db_Laptops_Hub_Vercel_Development psql -U postgres -c "delete from public.rate_limit_buckets;"
  ```
- Screenshots go to `test-results/p0-evidence/`, which is gitignored.

## Not tested in this pass

- Production / Preview deployments: no deploy was made.
- Real email delivery.
- Production Supabase advisors: access was denied.
- Merchant smoke, theme RLS and CSV scripts were not re-run. Their last recorded passes are in `PRODUCTION_RELEASE_CANDIDATE.md`, and none of their code paths changed in this pass.
