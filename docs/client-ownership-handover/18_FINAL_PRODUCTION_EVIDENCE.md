# 18 — Evidence: tests and production verification (2026-11-24)

## Isolated test runs (local Supabase, `node scripts/dev/isolated-next.mjs build|start`, port 3003, no theme env flag)
| Suite | Result | Notes |
|---|---|---|
| `npx tsc --noEmit` | PASS | |
| `npm run test:unit` (46 files incl. new `home-copy.test.ts`) | PASS | |
| ESLint on changed files | PASS (0 errors) | |
| `next build` | PASS | |
| `p1-theme-copy-publish` (new) | **4/4 PASS** | edit → draft → public unchanged → preview → conflict 409 → publish live → restore; screenshots in `docs/evidence/theme-copy/` |
| `p1-theme-ordering-preview` | 4/5 PASS on the final build | "publishing the default layout changes nothing visible" fails **only on the local fixture DB**, which lacks the default HP hero listing; production has all three default hero products (checked read-only), so the published default renders identically there. Underlying edge case logged as LH-018 (P3) |
| `p1-storefront-labels`, `contact-social-whatsapp*` | PASS | |
| `home-inquiry` | 7/7 PASS when run alone; one test flaked once in a combined run (order-dependent) | |
| `p1-store-testimonials-map` "editor can draft a Google review" | FAIL — **pre-existing**, code not touched by this release (Google-review draft validation vs test expectation) | logged as LH-019 |

## Production (verified 2026-11-24, read-only)
| Check | Result |
|---|---|
| PR | https://github.com/mudasarimamofficial/laptops-hub/pull/69 — CI `quality` pass (2m10s), Vercel preview pass; merged as `539f37041665c9ffcf513494d50f5a6d20a22c3b` |
| Deployment | `dpl_4tWeJ3nKFXGhKgTqPTEqLjRavuUe` READY, target production, aliases `www.laptopshub.pk`, `laptopshub.pk` (git sha `539f370`) |
| Previous deployment (rollback candidate) | `dpl_m8iVeF98uAGhsyL8SGJbK2R8hzKc` @ `fc24550` |
| `https://www.laptopshub.pk/` | 200; H1 "The future of smarter laptop shopping." (V5 default, unchanged); no horizontal overflow; 0 console errors |
| Homepage copy | V5 defaults present ("Shop by brand", "Featured laptops", "Compare before you buy.", "Tell us what you're looking for.") |
| Inquiry phones | "Or call Laptops HUB" + 0309 3372974 / 0313 6565663 / 0339 9100199 now shown (from Settings) |
| Security headers | `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` present; `X-Powered-By` absent; HSTS unchanged |
| Apex / CRM | `laptopshub.pk` 308 → www; `app.laptopshub.pk` 200 (untouched) |
| `/admin/login`, Dell 7420 PDP | 200, 200 |
| `/api/admin/theme/homepage` anonymous | 401 (staff only) |
| Production data | `theme_publications` 0, `orders` 1 — unchanged by the release; no migrations, no env changes |
| Owner-session admin check of `/admin/online-store` on production | NOT TESTED (needs the owner's sign-in; engineering does not use the owner password) |

## Phase 2a release — site-wide header/footer copy (verified 2026-11-24, read-only)
| Check | Result |
|---|---|
| PR | https://github.com/mudasarimamofficial/laptops-hub/pull/71 — CI `quality` + Vercel preview pass; merged as `0f9e29de9c9a49a50ea6667ddbdc090b4c02be11` |
| Deployment | `dpl_9kgUXMDyyRHpbMDsbpReSSuk66ng` READY, target production, aliases `www.laptopshub.pk`, `laptopshub.pk` |
| Previous deployment (rollback candidate) | `dpl_4tWeJ3nKFXGhKgTqPTEqLjRavuUe` @ `539f370` |
| `/`, `/collections/all`, `/admin/login` | 200, 200, 200; `/` title "Laptops HUB", H1 V5 default |
| Header/footer defaults on a non-home page | footer description, "Visit & contact", "Chat on WhatsApp", search label "Search model, processor, RAM", title "All products · Laptops HUB" all present (unchanged) |
| Mega menu / nav | trigger "Laptops"; "View all products →" `/collections/all`, "Chromebooks →" `/collections/chromebooks`; Guides and Support links present with V5 hrefs (id-based behaviour matches the old label-based output) |
| Browser | 0 console errors, 0 px horizontal overflow at the pane width |
| Security headers | nosniff, SAMEORIGIN, Referrer-Policy, Permissions-Policy present; `X-Powered-By` absent |
| Apex / CRM | `laptopshub.pk` 308 → www; `app.laptopshub.pk` 200 (untouched) |
| `/api/admin/theme/homepage` anonymous | 401 |
| Production data | `theme_publications` 0, `orders` 1, `seo_defaults.title_suffix` "" , theme_versions created in last 3 h: 0 — no writes, no migrations, no env changes |
| Owner editing header/footer on production | NOT TESTED (owner sign-in required; first publish is the merchant's own action) |

## Phase 2b release — product / collection / 404 copy (verified 2026-11-24, read-only)
| Check | Result |
|---|---|
| PR | https://github.com/mudasarimamofficial/laptops-hub/pull/72 — CI `quality` (2m36s), Vercel, preview comments pass; merged as `336a5ae243f2cdebdea773a9db9a6c4a238baaf4` |
| Deployment | `dpl_H9V3oYjg8fgJS4iukeFfJ8gvdrQ4` READY, target production, aliases `www.laptopshub.pk`, `laptopshub.pk` |
| Previous deployment (rollback candidate) | `dpl_9kgUXMDyyRHpbMDsbpReSSuk66ng` @ `0f9e29d` |
| `/`, `/collections/all`, product page, `/admin/login` | 200 each |
| Product page (`/products/dell-5400-…`) | headings "Specifications", "About this listing", "Customer reviews", "More from Dell"; "SPEC SHEET", policy links "Delivery/Returns/Warranty · READ POLICY", "View all →" — identical V5 text; 0 console errors; 0 px overflow |
| Unmatched URL | 404, "This page doesn’t exist", title "Page not found · Laptops HUB" |
| Missing product | 404, "This product isn’t in the catalog", button "Browse all products" → `/collections/all` |
| Collection "no matches" state | NOT TESTED on production (depends on live inventory per price band); covered by the isolated test |
| Security headers / `X-Powered-By` | 4 headers present / absent |
| Apex / CRM | 308 / 200 (untouched) |
| `/api/admin/theme/homepage` anonymous | 401 |
| Production data | `theme_publications` 0, `orders` 1, theme_versions in last 6 h: 0 — no writes, migrations or env changes |

