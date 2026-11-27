# 10 — Test results

All browser tests ran on the **isolated stack**: local `next start` on 127.0.0.1:3001, local Supabase fixture, fake email server. Every spec refuses non-local targets (`assertLocalOnly`). Counts are reported as Playwright printed them; skipped or interrupted tests are not counted as passed.

## New specs written in this pass

| Spec | Tests | Chromium | Firefox | WebKit |
|---|---|---|---|---|
| `ui-map-header-compositing` | 11 | 11/11 | 11/11 | 11/11 |
| `ui-whatsapp-mobile-circle` | 2 | 2/2 | 2/2 | 2/2 |
| `ui-mega-help-visibility` | 10 | 10/10 | 10/10 | 10/10 |
| `ui-responsive-cross-route` (9 routes × 11 viewports + 3 scroll-continuity) | 12 | 12/12 | 12/12 | 12/12 |
| `ui-filter-a11y` | 3 | 3/3 (red on old code) | 3/3 | 3/3 |

Supporting config: `playwright.isolated-xbrowser.config.ts` runs isolated specs in Firefox/WebKit. The base config pins a Chromium executable.

Two runs were not counted as passes:
- One WebKit run reported 3 failures, all `ENOENT` on trace files: a concurrent Chromium run had reset `test-results/`. The rerun alone: 12/12.
- One version of the `ui-filter-a11y` click test was wrong (the URL-controlled checkbox); it was corrected before commit.

## Full isolated suite (main `4e4daac`, Chromium)

### Run 1 — interrupted (19:30–19:37 PKT, by the previous session)

286 tests listed, 1 worker. **Not a valid result.** 60 passed, then the run broke down: after test 67 the app on 127.0.0.1:3001 stopped answering (`ERR_CONNECTION_REFUSED`), and every later test failed to start (`worker process exited unexpectedly`, code `0xC0000142`). That is what happens when the session that owns the processes ends, which matches the account loss. Playwright recorded 60 passed / 58 "failed" / 168 not run. Of the 58, **one was a real assertion failure that happened before the crash**: test 60, `launch-journey` "unserved address and invalid phone", which turned out to be a real app defect (HYD-001, below). Raw log and report preserved locally in `.isolated/preserved-run1-2026-11-27/` (not in git).

### Run 2 — complete (2026-11-27 19:42:34 → 20:20:36 PKT, 38.0 min)

Clean stack first: `supabase db reset --local` + the 8 later migrations (44 local; `20261118160000` storage bucket skipped as always locally, `cms_media_assets` created with `scripts/dev/isolated-cms-media-table.sql`), fresh `seed-isolated.mjs`, fresh `.next-local` build through `scripts/dev/isolated-next.mjs`, `check-isolated-app.mjs` OK, fake email on 4599. Chromium, 1 worker, main `4e4daac`.

| Total | Passed | Failed | Not run | Flaky |
|---|---|---|---|---|
| 286 | **275** | 3 | 8 (serial tests after a failure in the same file) | 0 |

The 3 failures, each diagnosed from its trace:

| Test | Cause | Kind | Action |
|---|---|---|---|
| `mobile-nav-reels-a11y` › mobile menu navigates | The "All products" navigation request never completed within 5 s while I was running `tsc` + `eslint` on the same machine | Machine load (test infrastructure) | Re-run alone: pass |
| `p1-backup-restore-cod-gate` | On a freshly seeded database `seo_defaults` does not exist when the backup is taken; restore (correctly) only upserts the settings the backup holds, so the test's change survived. The test's cleanup then left `title_suffix: "QA …"` in the local DB | **Test defect** (hidden dependency on an older database) | Test fixed: creates the row before the backup and removes it afterwards. The leaked local row was deleted by hand during the run (local only) so later tests were not affected |
| `z-owner-acceptance-36-steps` › 23–27 | 90 s test timeout: six PDP loads took 6–19 s each, waiting for `cdn.shopify.com` product images (10–18 s per image from this machine at that time) | External network (Shopify CDN, see D17) | Re-run: pass |

**Re-run of the three files in full** (so the 8 "not run" tests ran too), same build: **15/15 passed** (3.8 min).

**Result for main `4e4daac`: every one of the 286 tests has a passing result** — 275 in the uninterrupted run, 11 more in a same-build re-run of their files (3 failures with documented non-product causes + 8 not run). This is reported as "275 + re-run", not as a single green run.

### Fix branch (this pass): HYD-001 and SEO-001

New spec `ui-store-hydration` (3 tests). On the **old** build: `/checkout` **failed** (#418 on 3+ of 6 throttled loads); `/compare` and `/cart` passed. On the **fixed** build, together with the nearest specs (`launch-journey`, `seo-search-appearance`, `p0-checkout-quote-race`, `prehydration`, `merchant-os-buy-now`, `p1-discount-propagation`, `shipping-zones`): **31/31 passed**. Standalone repro (16 throttled loads): #418 on **5/8 before, 0/16 after**.

## Other gates on main `4e4daac`

| Gate | Result |
|---|---|
| `npx tsc --noEmit -p .` | clean |
| `npx eslint src tests --quiet` | 0 errors |
| `npm run test:unit` (63 files) | all pass (re-run on the fix branch: all pass) |
| Role HTTP matrix (`scripts/security-role-http-isolated.mjs`, fix build) | **126/126** (`docs/SECURITY_ROLE_HTTP_RESULTS.json`) |
| axe WCAG 2.0/2.1/2.2 A+AA, 7 routes × 390/1440 | 0 violations (2 before #111) |
| GitHub `quality` on #107–#111 | pass on each before merge |
