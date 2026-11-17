# 13 — Performance baseline

**Date:** 2026-11-17  
**Source:** Live production probes + prior Lighthouse lab data (2026-11-16)

## Edge caching

| Check | Result |
|---|---|
| `x-vercel-cache` | `HIT` on homepage |
| Edge routing | `bom1::sin1` (Mumbai edge → Singapore origin) |
| ISR stale time | `x-nextjs-stale-time: 300` (5 min) |
| Prerender | `x-nextjs-prerender: 1` (homepage is static) |
| Cache-Control | `public, max-age=0, must-revalidate` (correct for ISR) |

## Lighthouse lab scores (from 2026-11-16 closeout, local build)

| Page | Mobile perf | Desktop perf | Accessibility | Mobile LCP | Mobile TBT | CLS |
|---|---|---|---|---|---|---|
| Home | 59 | 84 | 100/100 | 5.3s | 663ms | 0 |
| Collection | 62 | 86 | 100/96 | 4.0s | 1133ms | 0 |
| Product | 66 | 97 | 100/100 | 3.9s | 975ms | 0 |

**Note:** These are local lab scores (Lighthouse 12.6.1, Windows, CPU throttled). Not comparable with field data.

## Image optimization

- Card photos use `srcset`/`sizes` requesting displayed width from Shopify CDN
- Measured savings: 680KB → 139KB at phone width (400w)
- Hero images not yet optimized (~740KB possible savings per Lighthouse)

## Network (live 2026-11-17)

- Homepage: 60+ requests, all 200 (CSS chunks + JS chunks immutable-cached)
- No failed requests on clean load
- RSC prefetch `ERR_ABORTED` on navigation are normal browser cancellations

## Open items

- Hero image sizing (Lighthouse: ~740KB savings possible)
- Mobile performance scores below 70 (CPU-bound, local lab only)
- TBT above 500ms on collection page (1133ms local lab)
- Real User Monitoring not enabled (Vercel Analytics/Speed Insights)

## Verdict

**PASS** for edge caching, ISR configuration, image CDN optimization on cards.  
**PARTIAL** for mobile performance (lab scores; hero images; no RUM).
