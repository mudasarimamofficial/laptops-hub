# 05 — Sitemap and robots.txt

**Sitemap** `https://www.laptopshub.pk/sitemap.xml`: 200, `application/xml`, **279 URLs** after release (280 before; `/compare` removed). The breakdown is home 1, collections 39, products 226, pages 8, guides 5. It is generated live from published content: archiving a product or unpublishing a page removes it automatically. `lastmod` is not emitted for products (the catalog read does not carry an update time); Google does not require it.

**robots.txt** allows the storefront and disallows `/admin/ /api/ /order/ /checkout /cart /track-order /search /preview/`. It points to the sitemap. No change was needed.

**Submission:** see 14 (requires a verified Search Console property).
