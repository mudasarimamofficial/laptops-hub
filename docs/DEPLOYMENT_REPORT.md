# Deployment report

## Preview — 2026-10-23 (checkout race fix + isolated tests)

| Field | Value |
|---|---|
| Git commit | `038ac89` on `fix/v5-correctness-parity` (pushed; not merged) |
| Deployment | `dpl_4CjAookWX8ZuQmzguQsBALkhYBwo` (Git integration, target **Preview**, Ready) |
| URL | https://laptops-3utcomm5j-mudasarimamofficial-gmailcoms-projects.vercel.app (SSO; checked via temporary share link) |
| Checks | `/`, `/pages/shipping`, `/collections/laptops` 200 · `/admin` → 307 login · COD POST 403 `checkout_disabled` · no runtime errors for this deployment |
| Local before push | tsc, lint (0 errors), unit, `npm run build`; isolated suite on local Supabase (`docs/ISOLATED_TESTS.md`) |

No Production promotion, alias change, COD enablement, legal approval or media publication.

## Preview — 2026-10-22 (V5 content parity)

| Field | Value |
|---|---|
| Git commit | `568ce08b41b5a1b44b1b23cd9e084acd6e8a2580` (content: `3e0f01e`; sanitizer fix: `568ce08`) |
| Branch | `fix/v5-correctness-parity` (pushed; not merged; no new PR) |
| Vercel project | `laptops-hub` · `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` · team `team_l7hth478q4bLcmoKR21X7uqm` |
| Deployment | `dpl_CPF9iwcqGWj8C6k2FY9KFp5kyfTq` (Git integration, target **Preview**) |
| URL | https://laptops-p0o7svszl-mudasarimamofficial-gmailcoms-projects.vercel.app (SSO protected; checked via temporary share link) |
| Supabase | `xvmmjkrkgznnakcobmww` (same project; 226 public products served, drafts 404) |
| Env | `COD_CHECKOUT_ENABLED` false · `V5_CUTOUT_BASE` unset · `V5_CONTENT_PREVIEW` unset (content pages gated) |
| Runtime errors | none for this deployment (previous deployment `dpl_Ex7Go…` had the jsdom crash, fixed here) |

| Check (on Preview) | Result |
|---|---|
| e2e (`PLAYWRIGHT_STORAGE_STATE`) | 39 passed, 1 skipped |
| Routes | 226/226 PDP 200 · 6/6 drafts 404 · 39/39 collections · 9/9 pages · `/pages/x`, `/guides/x` → 404 |
| Content gating | shipping (legal) gated + noindex, no template copy in HTML; sitemap 267 URLs, 0 content URLs; no owner-checklist text in client bundles |
| Security | COD 403 · `/admin*` → login · unauthenticated admin PATCH/POST 401 · contact cross-site 403 · 11 client chunks: no secrets, anon JWT only |
| Console sweep | clean except the expected 404 on the missing route |

### Not done
- No Production promotion, alias change, COD enablement, legal approval or media publication.
- Production alias `laptops-hub.vercel.app` still serves the older `ea652f2` redeploy (owner decision).

---

## Preview — 2026-10-22 (V5 reconstruction)

| Field | Value |
|---|---|
| Git commit | `44eeab531291aca843694ceb7a89b7366508496e` (first Preview of this branch: `247804d`, `dpl_EfZzWamkGPeNLh58PbP2JNoNvRtP`) |
| Branch | `fix/v5-correctness-parity` (pushed; not merged; no PR yet) |
| Vercel project | `laptops-hub` · `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` · team `team_l7hth478q4bLcmoKR21X7uqm` |
| Deployment | `dpl_6BhEe3QLnM9pDijLqTajWTABHDhq` (Git integration, target **Preview**) |
| URL | https://laptops-oen9ihlte-mudasarimamofficial-gmailcoms-projects.vercel.app (branch alias `laptops-hub-git-f-2a9729-mudasarimamofficial-gmailcoms-projects.vercel.app`) |
| Access | Vercel SSO protected; checks used temporary share links (expire 2026-10-23) |
| Build | READY (~40 s) |
| Env | Preview env from Vercel; `COD_CHECKOUT_ENABLED` false; `V5_CUTOUT_BASE` **unset** (catalog photos in hero/story) |
| Runtime errors (2 h) | none |

### Hosted verification
| Check | Result |
|---|---|
| Route check (`scripts/visual/check-routes.mjs --share=…`) | 226/226 public PDPs 200 · 6/6 drafts/archived 404 · 39/39 collections 200 · 9/9 core pages 200 · unknown route/collection 404 (`docs/ROUTE_CHECK_PREVIEW.json`) |
| COD | `POST /api/checkout/cod` → 403 `checkout_disabled` |
| Admin | `/admin`, `/admin/orders` → 307 `/admin/login`; unauthenticated `POST/PATCH /api/admin/*` → 401 |
| Draft isolation | draft handle absent from `/api/catalog/compare-summary` and `/api/catalog/compare` |
| Secrets | 13 client chunks (home, collection, PDP, cart, compare): no service-role strings, only anon JWTs |
| Media | no cutout URLs in HTML; `stage.webp` served |
| SEO | `sitemap.xml` 268 URLs on the deployment origin; robots disallows private paths and links the sitemap |
| Visual (hosted vs V5) | `docs/V5_PIXEL_DIFF_REPORT.md` → "Hosted Preview vs V5": all templates 0–0.38% (same as local); hero 3.9–10.9% and story 14.8–19.7% because cutouts are gated (catalog-photo fallback) |
| Fix found on Preview | hero fallback photos showed white boxes (blend isolated by a transform) → fixed in `44eeab5` |

### Not done
- No Production promotion, alias change or COD enablement from this session.
- Production domain finding: `laptops-hub.vercel.app` is public and serves an older Production redeploy of `ea652f2` (owner action). See `docs/PRODUCTION_READINESS.md`.

---

## Earlier — 2026-10-21

| Field | Value |
|---|---|
| Git commit | `9f0ccb2` |
| Branch | `feat/v5-storefront-admin` |
| Deployment ID | `dpl_Geom2QJFSTdLhrGgv9naH7f32q5u` (Preview) |
| Build | READY |
| COD | Disabled |
