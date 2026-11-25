# 13 — Production deployment evidence

| Item | Value |
|---|---|
| PR #79 (isolated test baseline fixes) | merged → `ca3abd4`, production deploy **Ready** |
| PR #80 (SEO) | CI `quality` pass, Vercel preview pass → merged `e234b72`, production deploy **Ready** (2026-11-25) |
| Migrations | none |
| Visual | homepage unchanged (V5 frozen); no console errors on the live homepage |

## Gentle production crawl after release (GET only, 700 ms apart)

| Path | Status | robots | canonical | JSON-LD | title |
|---|---|---|---|---|---|
| `/` | 200 | index, follow | `https://www.laptopshub.pk` | Organization+ComputerStore, WebSite | Laptops HUB — Laptop Shop in Bahawalpur, Pakistan |
| `/collections/all` | 200 | (default index) | `/collections/all` | org, website | All products · Laptops HUB |
| `/collections/laptops` | 200 | default | `/collections/laptops` | org, website | All laptops · Laptops HUB |
| a product | 200 | index, follow | own URL | org, website, BreadcrumbList, Product | Dell 5400 · Core i5, 8th Gen, 8GB RAM, 256GB Storage · Laptops HUB |
| `/guides` | 200 | default | `/guides` | org, website | Guides · Laptops HUB |
| a guide | 200 | default | own URL | org, website, **Article, BreadcrumbList** | Intel Core generations, explained · Laptops HUB |
| `/pages/contact` | 200 | default | own URL | org, website | Contact · Laptops HUB |
| `/compare` | 200 | **noindex, follow** | `/compare` | org, website | Compare laptops · Laptops HUB |
| `/cart` | 200 | index, follow (but **blocked in robots.txt**) | — | org, website | Laptops HUB |
| unknown URL | **404** | noindex | — | — | Page not found · Laptops HUB |

- `og:site_name` = "Laptops HUB" and `og:image` are present on every 200 page (before: missing everywhere).
- Sitemap: 200 `application/xml`, **279 URLs** (1 home, 39 collections, 226 products, 8 pages, 5 guides). `/compare` removed; all URLs on `https://www.`; no admin/cart/checkout/api.
- Brand images: `/brand/laptops-hub-logo-512.png` 200 image/png; `/brand/laptops-hub-share-1200x630.png` 200 image/png.
- Homepage business node (live): PostalAddress "1st Floor, Al Raheem Center Plaza, University Chowk", Bahawalpur, PK; telephone +923093372974; email; 3 contactPoints; sameAs Facebook/Instagram/TikTok/YouTube; WebSite alternateName Laptops Hub / LaptopsHUB / laptopshub.pk.
- Host consolidation unchanged and correct: apex and http → `https://www.laptopshub.pk` (308).
