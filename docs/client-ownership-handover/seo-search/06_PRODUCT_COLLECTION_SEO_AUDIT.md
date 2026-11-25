# 06 — Product and collection SEO

Production, 2026-11-25 (read-only queries):

| Measure | Value |
|---|---|
| Active products | 226 (all in the sitemap) |
| Products with a merchant SEO title/description override | 0. All use generated titles: brand · model · CPU/gen · RAM · storage, from verified specs |
| Product page titles shared by 2+ products | **9 groups / 19 products**, e.g. "Dell Latitude 5320 · Core i5, 11th Gen, 16GB RAM, 256GB Storage" ×3 |
| Collections in sitemap | 39 |
| Published guides | 4 articles (5 guide URLs incl. index), 0 with SEO fields set |

**Duplicates.** Google treats identical titles as copies and usually shows one. These are listed in Admin → SEO → *Products sharing one search title*. Owner choice: archive true duplicates, or set a distinct and true SEO title (condition, colour, keyboard and so on) for different units. Engineering does not merge or rename catalog items.

**Collections.** A collection's own SEO description is used when set. Otherwise a fallback: "<name> at Laptops HUB, Bahawalpur, Pakistan. Every listing shows the processor, memory, storage and display, with prices in PKR." Every collection now has og:url and og:site_name.

**Products.** Product + BreadcrumbList markup is unchanged (prices in PKR and availability come from the catalog). og:site_name/locale are now kept alongside the product image.
