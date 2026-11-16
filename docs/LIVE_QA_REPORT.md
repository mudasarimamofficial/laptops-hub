# Live QA report — production, 2026-11-16

Production: deployment `dpl_ErqN6evfpCNXoidJrp5xGVAqiDnC`, merge commit `772276b` (PR #10), regions `[sin1]`.
`laptopshub.pk` → 308 → `www.laptopshub.pk`, both aliased to this deployment. `app.laptopshub.pk` (Hostinger CRM) 200, unchanged.
Database: 29/29 migrations (`docs/evidence/migrations/prod_apply_2026-11-16.txt`).

All checks are **read-only**: no sign-in, no form submission, no cart, checkout or order actions.

| Check | Result | Evidence |
|---|---|---|
| Sitemap sweep | **267/267 URLs 200** | — |
| Routes × Chromium, WebKit, Firefox × desktop 1440 + phone: home, collections, collection, PDP, search, cart, checkout page, track order, admin login, 404 page | **78/78 PASS**: status correct, no horizontal overflow, no page errors, no "Application error" | `docs/evidence/live-qa/results.json` |
| Homepage reviews | Section absent (no published reviews); no "4.9" / "157 reviews" claims | same |
| Homepage map | Iframe not loaded until near the bottom, then loads the Google embed; "Open in Google Maps" not covered (elementFromPoint), all 6 browser/viewport combinations | same, `home-bottom-*.png` |
| Public COD | Not offered; `store_settings.cod_checkout.enabled = false` | same, migration evidence |
| Function region | `x-vercel-id …::sin1::` on dynamic routes | headers |
| Security headers / iframe | No CSP or X-Frame-Options blocking the embed | headers |
| Robots | admin, api, order, checkout, cart, track-order disallowed | robots.txt |

## Live response times (unauthenticated, measured from Pakistan, 12 samples each)

| Route | p50 | p95 |
|---|---|---|
| `/admin` (middleware redirect) | 103 ms | 230 ms |
| `/admin/login` | 223 ms | 552 ms |
| `/checkout` | 290 ms | 354 ms |
| `/collections/all` | 252 ms | 315 ms |
| PDP | 249 ms | 287 ms |
| `/search?q=dell` | 255 ms | 288 ms |

Raw samples: `docs/evidence/live-qa/live-ttfb.json`. For comparison, on the earlier iad1 deployment the same
storefront routes took 1.5–2.9 s total on the first request after migration (single samples).

## Not verified live

- **Authenticated admin journeys and their p50/p95** (dashboard, products, editor, variants, inventory, collections,
  orders, blog, reviews, settings, staff, theme editor). This needs a staff sign-in on production, and the agent does
  not enter real credentials. The owner can sign in and check these pages; the modelled figures are in
  `ADMIN_PERFORMANCE_REPORT.md` (365 ms modelled; **not** a production measurement).
- Sign-out replay protection on production (verified on the isolated stack, 4/4).
- Any order, payment or email flow: COD is disabled and no email provider is configured.
