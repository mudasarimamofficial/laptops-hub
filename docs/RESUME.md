# Resume here

State: **Phases 3–7 in progress on branch `feat/v5-storefront-admin`** (2026-10-21).

## Confirmed baseline
- `d6f7e03` — P0 requireStaff + column grants (security probes 9/9)
- `18804fa` — COD shipping quote + city/province zone match
- Migrations through `20261021151000_content_pages_pending_seed`
- Catalog: **232 / 226 / 6 / 964**
- Vercel preview only; **COD off**; **no `--prod`**

## Done this continuation
- V5 homepage stack: cinematic hero, pinned product story, brands/featured/budget/Chromebook/compare teaser, mega + mobile nav, compare tray
- Collections: DB-seeded + matcher resolve; search filters (brand/category/price/sort)
- PDP: gallery, compare, related products; product-card compare
- Admin: product edit (PATCH), order detail + status transitions, COD collection API/UI, content CMS (pending pages seeded)
- Durable rate limit RPC + memory fallback
- Auth matrix script: **24/24** anon denial + RLS (`npm run test:security:auth-matrix`)
- P0 still **9/9**; unit tests pass; `npm run build` pass

## Still open
- Browser E2E with real staff roles (needs owner `admin_memberships` bootstrap)
- Playwright visual parity vs original V5 screenshots (measurable diffs)
- Full CMS from `data/lh-content.js` into published pages (owner approval)
- Media reorder / variant create / staff invite UI
- Enable COD only after owner shipping + policy approval

## Owner still required
- Bootstrap `admin_memberships` owner row
- Real shipping zones/fees; approve policies & media
- Explicit launch before public COD / `vercel --prod`

## Do not
- Enable public COD / `vercel --prod` without explicit approval
- Invent policies or specs
