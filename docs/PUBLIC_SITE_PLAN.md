# Public website — pre-launch modes, evidence and activation plan

Updated 2026-10-23. **No Production change has been made.** `laptops-hub.vercel.app` still serves the owner redeploy
of `34f9839` (`dpl_DEGy9tXzDaDJoiFV3AbsT19SHcbH`): public, indexable, storefront and catalog photos visible, COD off.

## Modes (one Vercel variable, `SITE_PRELAUNCH`, read at build time)

| | Launch (unset) | **A — SEO-only pre-launch** (`1`) | **B — Restricted pre-launch** (`restricted`) |
|---|---|---|---|
| Storefront pages | V5 storefront | V5 storefront + slim notice bar: "Laptops HUB is preparing to launch. Online ordering is not available yet." | every storefront URL (old and new) → branded coming-soon page (V5 wordmark/tokens), HTTP 200 |
| Product data & prices on our pages | visible | visible | **not served** (layout loads no catalog; pages rewritten) |
| Public catalog / checkout / contact APIs | served (checkout 403) | served (checkout 403) | **503** |
| Catalog photos through our app (`/_next/image`) | yes | yes | **refused (404)**; local assets only |
| Content / policy pages | gated ("being finalised") | gated | not served (coming soon) |
| Admin (`/admin`, `/api/admin`) | sign-in + role checks | same | same (admin chrome only, no storefront) |
| Checkout | disabled (env + DB) | disabled | disabled (API 503) |
| `X-Robots-Tag` | — | `noindex` on every response | `noindex` on every response |
| Meta robots | `index, follow` (pages may set noindex) | `noindex, follow` everywhere | `noindex, follow` |
| Canonical links | production host | none | none |
| `robots.txt` | private routes disallowed + `Sitemap:` | public pages **crawlable**, private routes disallowed, no `Sitemap:` | same as A |
| `/sitemap.xml` | 267 URLs on `laptops-hub.vercel.app` | valid, empty | valid, empty |

Why crawlable: Google only obeys `noindex` on pages it can fetch; a `robots.txt` `Disallow: /` (the earlier
implementation) would have hidden the rule and left already-known URLs in the index. `noindex` is a search-engine
instruction, **not access control**.

## What stays publicly reachable in every mode (honest limits)

- **Catalog data via the public Supabase API.** RLS allows anonymous reads of active products, variants, media and
  collections (the anon key ships in browser code by design). Anyone using the API directly can list products,
  prices and image URLs in all three modes.
- **The 964 catalog photos are hosted on `cdn.shopify.com`** (all `approval = pending`). Those URLs stay public at
  Shopify regardless of this site; mode B only stops *our* site from showing or resizing them.
- Search engines drop already-indexed URLs only after they recrawl them and see `noindex` (days to weeks). Faster
  removal needs the owner's Google Search Console (Removals tool) — not available to engineering.

**Genuine restriction of data and photos** (beyond mode B) needs owner-approved changes outside this release:
(1) a database change that hides catalog tables from `anon` while pre-launch (RLS), and (2) removing or replacing the
photos on the Shopify CDN / re-hosting approved images privately. Vercel Pro deployment protection would hide the
site but not the Supabase API or the CDN.

## Recommendation

**Mode B (restricted)** now. Reasons: 0 of 964 photos have confirmed rights, no policy/contact page is approved, no
owner account exists, and checkout cannot open — so there is nothing a visitor can usefully do, while the public
storefront keeps distributing unapproved photos. Move to **Mode A** once media rights are confirmed (or photos
replaced) but policies are still pending; remove the variable at launch.

## Evidence (2026-10-23)

Local production-like builds (`VERCEL_ENV=production`, production host `laptops-hub.vercel.app`, `V5_CUTOUT_BASE`
unset), `scripts/visual/prelaunch-check.mjs`:

| Mode | Checks | e2e | console | axe |
|---|---|---|---|---|
| Launch | 24/24 (canonical + sitemap on production host, private routes disallowed, no notice) | 39 passed / 1 skipped | clean | 0 violations (10 routes) |
| A | 35/35 (11 old+new URLs: 200, header + meta noindex, no canonical; crawlable robots, empty sitemap; storefront + notice; CMS gated; admin sign-in; checkout 403) | 39 passed / 1 skipped | clean | 0 violations |
| B | 44/44 (11 URLs → coming soon without catalog data; APIs 503; remote image 404; admin works) | n/a (storefront replaced by design) | — | 0 violations |

Screenshots desktop 1440 / mobile 390 (local, not committed): no horizontal overflow, no console errors.

Protected Previews (commit `340f6d9`; branch-scoped Preview variable, no Production variable):

| Preview | Deployment | Verified |
|---|---|---|
| Launch | `dpl_6oZn1NSCpWt6qJLhTMzM7BDjnhL6` (`fix/v5-correctness-parity`) | e2e 39/1 skipped, console clean, no notice, meta `index, follow` (Vercel adds its own Preview `noindex` header) |
| A | `dpl_A4omsBWFHakfuTsHx8ccaQ7BnJ57` (`preview/prelaunch-seo`) | collection page: 200, `X-Robots-Tag: noindex`, meta `noindex, follow`, no canonical, notice shown, storefront + photos visible |
| B | `dpl_34Vcoz1GbyGqnNZPc5tvSumXkAFh` (`preview/prelaunch-restricted`) | product URL → coming soon (200, noindex, no catalog data); catalog API 503; remote photo 404; robots crawlable without sitemap; `/admin` → staff sign-in |

## Activation plan (owner approval required — not executed)

Production deploys come from `main` (Git) or a manual deployment; the current production code (`34f9839`) has no
pre-launch support, so activation = set the variable **and** deploy the commit that contains it.

1. Vercel → Project `laptops-hub` → Settings → Environment Variables → add `SITE_PRELAUNCH` = `restricted`
   (or `1` for mode A), environment **Production** only. (CLI: `vercel env add SITE_PRELAUNCH production`.)
2. Deploy commit `340f6d9` (the verified code; later commits are docs only) of `fix/v5-correctness-parity` to Production (Vercel: Deployments → the verified
   Preview of that commit → Redeploy → Production, which rebuilds with Production variables). COD variables stay
   `false`; `V5_CUTOUT_BASE` and `V5_CONTENT_PREVIEW` stay unset.
3. Post-checks (public, read-only): `node scripts/visual/prelaunch-check.mjs https://laptops-hub.vercel.app restricted`
   (or `prelaunch`) must pass; Vercel runtime logs clean; staff sign-in reachable.
4. Rollback (seconds): Vercel Instant Rollback to `dpl_DEGy9tXzDaDJoiFV3AbsT19SHcbH` (current site), or change/remove
   the variable and redeploy. Going live later: remove `SITE_PRELAUNCH` for Production and redeploy — launch mode
   restores canonicals, sitemap and indexing (verified: launch 24/24).

Note: while `SITE_PRELAUNCH` is set for Production, merging PRs to `main` keeps the site in pre-launch mode.

## Preview test resources to clean up after the decision
Branches `preview/prelaunch-seo`, `preview/prelaunch-restricted` and their branch-scoped Preview variables
(`SITE_PRELAUNCH`) — no effect on Production or other Previews. Remove with `git push origin --delete <branch>` and
`vercel env rm SITE_PRELAUNCH preview <branch>`.
