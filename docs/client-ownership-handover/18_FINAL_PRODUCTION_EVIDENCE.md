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

## Production (to be completed after the release deploys)
| Check | Result |
|---|---|
| PR / merge commit | pending |
| Deployment id / READY | pending |
| Homepage 200, V5 default unchanged (no publication) | pending |
| Security headers present, `X-Powered-By` absent | pending |
| `/admin/online-store` loads for owner (read-only check) | owner session required |
| `app.laptopshub.pk` CRM still 200 | pending |
