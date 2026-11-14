# Laptops HUB — E2E Test Report (2026-11-14)

**Code under test:** `feat/merchant-operating-system` — third pass (social proof, badges, reel autoplay) on top of `3dae91a`; the commit that contains this report. **Stack:** isolated only. **Browser:** Playwright Chromium 1.64.1 (headless). WebKit/real devices not run.
- Local Supabase seeded by `scripts/test-fixtures/seed-isolated.mjs`, plus a local owner account
- `next build` + `next start -p 3001`
- Fake Resend on `:4599`

**Machine-readable results:** `docs/LAPTOPS_HUB_E2E_TEST_REPORT.json` (per-test status and duration).

No test touched production. Every isolated spec refuses to run unless Supabase is on 127.0.0.1/localhost (`assertLocalOnly`).

## Results

| Suite | Command | Result |
|---|---|---|
| Isolated Playwright journeys (10 spec files) | `npx playwright test --config=playwright.isolated.config.ts` | **57/57 PASS** (~7 min) |
| P0 admin isolation + checkout gates (now 8 admin routes × 5 widths) | `p0-admin-isolation-and-checkout-gates.spec.ts` | 10/10 |
| P1 social proof, badges, reel playback | `p1-social-proof.spec.ts` | 5/5 |
| P1 storefront labels | `p1-storefront-labels.spec.ts` | 2/2 |
| P1 reels, reviews, blog | `p1-reels-reviews-blog.spec.ts` | 4/4 |
| Launch journeys (COD order, notifications, retry) | `launch-journey.spec.ts` | 10/10 |
| Content pages gating | `content-pages.spec.ts` | 8/8 |
| Home inquiry | `home-inquiry.spec.ts` | 7/7 |
| Staff password recovery | `password-recovery.spec.ts` | 5/5 |
| Shipping zones admin | `shipping-zones.spec.ts` | 4/4 |
| Pre-hydration form safety | `prehydration.spec.ts` | 2/2 |
| Unit tests (27 files, incl. `social-proof.test.ts`, run under UTC and America/New_York too) | `npm run test:unit` | **PASS** |
| Shipping/COD SQL matrix | `scripts/db-tests/shipping-cod-matrix.sql` (local, ROLLBACK) | **26/26 PASS** |
| Reels/reviews SQL matrix | `scripts/db-tests/reels-reviews-matrix.sql` (local, ROLLBACK) | **17/17 PASS** |
| Merchandising SQL matrix | `scripts/db-tests/merchandising-matrix.sql` (local, ROLLBACK) | **15/15 PASS** |
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

- **Reels.** No row on the homepage by default. Admin refuses a ronin.pk link and an unlicensed publish (the database refuses the latter too). A published, owned reel appears with `preload="none"` and a product link; unpublishing through the admin API removes the row.
- **Reviews.** The product page shows "No reviews yet" and no `aggregateRating`. Cross-site posts get 403. A submitted review is stored `pending` with a 32-hex IP hash and is not shown. After approval it appears with "4.0 out of 5 · 1 review" and `aggregateRating`, without the reviewer's email. Rejecting hides it again.
- **Blog.** Publishing an empty post is refused. A published post renders at `/guides/<slug>`, is listed on `/guides` and in the sitemap, and has `<script>` and `javascript:` links stripped. Back to draft gives 404.
- **Roles.** Fulfillment staff get 403 on the post, reel and review-moderation APIs.
- **Social proof (zero baseline).** With notices and "Top seller" switched on but only placed/cancelled/shipped orders (threshold: delivered), `/api/activity/recent` returns `[]`, Admin shows 0 qualifying orders / 0 top sellers, and no notice or badge appears on the PDP within 9.5 s.
- **Social proof (real orders).** After 3 delivered sandbox orders, the API returns 2 items with only `city/handle/imageUrl/title/when` keys; the raw response contains no customer name, phone, order number, street or city. The PDP shows the flame "Top seller" badge and the notice "A customer ordered … today" (never "paid/bought"). Dismissing stops notices for the session; `/checkout` never shows one.
- **Editorial labels.** An editor sets "Popular pick" (audited, star style on the PDP); forging `top_seller` through the API gives 400; editors get 403 on the settings API and do not see the settings form.
- **Reel playback.** With an original synthetic WebM served to the test: exactly one video plays, muted; `preload="none"`; pressing sound on the second reel plays it unmuted and stops the first. Under `prefers-reduced-motion` nothing plays until the play button is pressed. A 404 video shows "This video is not available right now." Creator name and tag render only for the consented row.

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
