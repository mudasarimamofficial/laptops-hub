# Final sitewide optimization — 2026-11-23

Baseline `main`: `992723d904ea815eb9cfe548a6f65a87cbe84be1`

## Delivered

| Area | Result |
|------|--------|
| Media / responsive images | Shopify CDN container-aware srcset; LHImg displayWidth; next/image formats AVIF/WebP |
| SEO / AEO / GEO | Product seo_* consumed; OG/Twitter; Organization/WebSite + Product/Breadcrumb JSON-LD; discounted Offer prices |
| Discount engine | Admin `/admin/discounts`; Storewide 5% Off active in DB; quote + COD RPC + storefront UI |
| Supabase Free resilience | keepalive RPC + `/api/cron/keepalive` + GitHub Action (4×/day) |
| Premium scrollbars | Storefront + admin thin rounded thumbs (pointer:fine) |
| Tests | pricing + image-url unit PASS; `tsc --noEmit` PASS |

## Linked evidence
- `docs/PERFORMANCE_BEFORE_AFTER_2026-11-23.json`
- `docs/SEO_AEO_GEO_COVERAGE_2026-11-23.csv`
- `docs/DISCOUNT_ENGINE_ACCEPTANCE_2026-11-23.md`
- `docs/SUPABASE_FREE_RESILIENCE_2026-11-23.md`
- `docs/RELEASE_ACCEPTANCE_2026-11-23.md`

## External / business gates
- Live COD place-order: not authorized
- Field Core Web Vitals / Lighthouse 90+: not claimed without lab/field run
- Keepalive scheduled ping: needs first GitHub Actions run with `CRON_SECRET`
- SITE_PRELAUNCH: must not be silently flipped — verify Production env before claiming indexability
- NVDA / reel media rights: unchanged NOT TESTED / BUSINESS PENDING
