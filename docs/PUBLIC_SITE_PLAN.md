# Public website (`laptops-hub.vercel.app`) — findings and owner plans

Checked 2026-10-23, read-only. **No alias, protection, target or environment change was made by engineering.**

## Findings

| # | Finding | Evidence |
|---|---|---|
| 1 | Until ~07:11 UTC 2026-10-23 the alias served `dpl_BrACMxR5SfDx317aRs9ExLr7VNBh`, a dashboard **redeploy** of `ea652f2` (PR #1 head) to Production. `main` has not changed since `18804fa`; Git pushes to feature branches only create Previews, so the alias stayed on that manual deployment. | Vercel deployment list |
| 2 | On that build every `/pages/*` route returned **500**: the page imports `src/lib/security/sanitize-html.ts` for the `LEGAL_CONTENT_SLUGS` constant, and that module loads `isomorphic-dompurify` → `jsdom`, which fails on Vercel's Node runtime (`ERR_REQUIRE_ESM` in `html-encoding-sniffer`). Fixed on this branch in `568ce08` (sanitize-html). | runtime logs of `dpl_BrACM…` |
| 3 | **The owner account then redeployed `34f9839` (this branch) to Production**: `dpl_DEGy9tXzDaDJoiFV3AbsT19SHcbH`, `source: redeploy`, now aliased to `laptops-hub.vercel.app`. Not done by engineering. | `get_deployment` |
| 4 | Current public site: V5 storefront, `/pages/*` and `/guides` **200** (content gated, "being finalised"), COD **403** `checkout_disabled`, `/admin` → login, no runtime errors, V5 cutouts not served. | read-only HTTP checks |
| 5 | The site is **public and indexable** (`<meta name="robots" content="index, follow">`, robots.txt allows `/`) and shows catalog photos whose media rights are not yet approved. | read-only HTTP checks |
| 6 | **SEO defect:** robots.txt and all 267 sitemap URLs point to the deployment host `laptops-ljtkmy34t-….vercel.app`, which redirects anonymous visitors to Vercel SSO (302). Cause: `siteUrl()` used `VERCEL_URL` when `SITE_URL` is unset. **Fixed on this branch** (production uses `VERCEL_PROJECT_PRODUCTION_URL`); takes effect only with the next production deployment. | `/sitemap.xml`, `/robots.txt` |
| 7 | The project is on the Vercel **Hobby** plan (log retention message): Vercel Authentication/password protection cannot cover the production domain on Hobby. | logs API response |
| 8 | The production database is shared by Preview and Production; this branch's code works with the current database (Option A only) and with Option B (verified locally). | `docs/MIGRATION_PRODUCTION_APPROVAL.md` |

Finding 2 is therefore **already resolved in production** by the owner's redeploy (finding 3). The plans below are
about what the public should see until the release gates pass.

## Plan A — protect the public site while development continues

| Option | How (owner action) | Effect | Risk | Reversible |
|---|---|---|---|---|
| A1 Pre-launch mode (**recommended**) | Set `SITE_PRELAUNCH=1` for Production in Vercel, then redeploy the reviewed commit that contains this branch's site-url change | Site stays reachable; `X-Robots-Tag: noindex, nofollow` on every response, robots.txt `Disallow: /`, empty sitemap | Visitors with the link still see the storefront and catalog photos | Yes: unset + redeploy |
| A2 Take the site down | Vercel dashboard: remove the production deployment's alias, or Instant Rollback is **not** suitable (the previous build has the 500s) | `laptops-hub.vercel.app` returns 404 | No public presence; old links break | Yes: re-promote `dpl_DEGy9…` |
| A3 Real access control | Upgrade to Vercel Pro and enable protection for all deployments incl. production, or password protection | Only authorized viewers | Cost; requires plan change (account setting) | Yes |

Recommendation: **A1** while media rights and policies are pending (the storefront is safe to view — COD off,
content gated — but should not be indexed with unapproved media and no policies). If the owner does not want the
catalog photos publicly viewable at all before the media-rights decision, choose **A2** (or A3).

## Plan B — minimal safe fix for the public content-page errors

| Option | What | Status |
|---|---|---|
| B1 Keep the owner's redeploy of `34f9839` | Fixes the 500s (verified), COD off, content gated | **Live now** (owner action) — no further step needed for the 500s |
| B2 Next production deployment = reviewed release candidate | Deploy the commit that also carries the sitemap/robots host fix (finding 6) and, if chosen, `SITE_PRELAUNCH=1` | Prepared on this branch; needs owner approval (`docs/RELEASE_PLAN.md`) |
| B3 Hotfix on the old `ea652f2` build | Swap the sanitizer only | Not recommended any more: superseded by B1, would create a divergent branch |

Recommendation: **B1 now, B2 at the next approved production deployment.** Note that B1 put an unreviewed
feature-branch build on Production; PR review (#1 → #2) should still happen before the next production deployment,
and production should then be deployed from `main` (see `docs/RELEASE_PLAN.md`).

Constraints for any option: COD stays disabled (`COD_CHECKOUT_ENABLED` / `NEXT_PUBLIC_COD_CHECKOUT_ENABLED` false,
`store_settings.cod_checkout.enabled` false); `V5_CUTOUT_BASE` and `V5_CONTENT_PREVIEW` stay unset; no content is
published.
