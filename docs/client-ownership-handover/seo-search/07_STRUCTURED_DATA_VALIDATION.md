# 07 — Structured data

| Page | Types | Source of each value | Never included |
|---|---|---|---|
| Every storefront page | `Organization`+`ComputerStore` (`/#organization`), `WebSite` (`/#website`) | Contact & Social: name, logo (512 px official artwork), address (PostalAddress when "…, City, Pakistan"), first enabled phone (E.164), all enabled phones as contactPoints, email, enabled https socials (`sameAs`). WebSite name + alternate names: Laptops Hub, LaptopsHUB, laptopshub.pk. | ratings, reviews, opening hours, geo coordinates, price range, awards, SearchAction (retired by Google) |
| Product | `Product` + `BreadcrumbList` (existing) | Catalog: verified specs, PKR price, availability | invented GTIN/MPN, warranty, ratings |
| Guide | `Article` + `BreadcrumbList` | Article: SEO title/description, image or share image, author if set (else the business), published/modified dates | FAQ markup, fabricated quotes |

Tests: `tests/unit/seo-site.test.ts` checks the graph, that forbidden keys are absent, the filtering of disabled or `javascript:` links, and that `</script>` is escaped. `tests/e2e-isolated/seo-search-appearance.spec.ts` checks the rendered JSON-LD on the homepage and a guide.

Recommended manual check after deploy: https://search.google.com/test/rich-results and https://validator.schema.org on the homepage, one product and one guide.
