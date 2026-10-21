# Performance audit

No Lighthouse or field measurements were possible in this environment. No scores are claimed.

## Implemented
- Scroll + pointer handled in one rAF loop (sched/frame), passive listeners, 100ms fallback
- Animated values written as CSS custom properties on two section roots; transforms/opacity only; React re-renders only on chapter change
- Lazy card images; second image loaded only on hover; galleries load per PDP only
- Catalog parsed once and memoised
- Hero cutouts are local PNGs (critical); product media on Shopify CDN

## Risks to measure
| Risk | Note |
|---|---|
| backdrop-filter on header, dialogs, glass panels | GPU cost on low-end Android |
| Large drop-shadow filter on hero main laptop | consider baked shadow PNG |
| Cutout PNG weight | convert to WebP/AVIF, add width/height |
| Shopify images requested at original size | use &width= params / srcset in theme |
| Hero rotating timer (6s setState) | pauses when hidden; fine |
| Single 100KB catalog JS | replaced by Liquid/Storefront API in theme |

## Measurement plan
Lighthouse mobile on home, collection, PDP; WebPageTest Moto G4 3G; Chrome Performance panel scroll trace through #story (target: no long tasks >50ms, no layout in scroll).
