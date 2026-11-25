# 01 — Branded search baseline (before the SEO release)

Captured 2026-11-25. These are read-only observations. Google results vary by user, location and time.

## The complaint
Searching **Laptops HUB**, **Laptops Hub Pakistan**, **Laptops HUB Bahawalpur**, **laptopshub.pk** or **www.laptopshub.pk** did not reliably show the official website.

## What Google showed
| Check | Observation |
|---|---|
| `site:laptopshub.pk` | **2 results**: `/collections/laptops` and one product page. Google showed a banner: "Do you own laptopshub.pk? Try Google Search Console". |
| Site name shown on the collection result | **"Janvi Foods"**. This text appears nowhere in the code, the database, or the product titles. It is stale or wrong Google data. |
| Favicon shown | An old generic "N" icon. The live favicon is the official Laptops HUB artwork, so Google had not re-crawled it. |
| Product snippet | An older description ("Unleash productivity with the Dell Latitude 3380…"), from an earlier crawl. |
| Google Business Profile | A Laptops HUB profile exists (University Chowk, Bahawalpur). It is managed outside this project. Whether it links to https://www.laptopshub.pk is not yet verified (needs the profile owner). |
| Competing results | Similarly named shops and domains in other cities rank for "laptops hub". |

## What the site served (production, before)
From `seo-baseline-before.json`: a gentle crawl of 10 pages, 700 ms apart, GET only.

| Signal | Before |
|---|---|
| Homepage `<title>` | `Laptops HUB` (no city or category words) |
| Homepage canonical | **missing** |
| Open Graph `og:site_name`/image | **missing on every page** |
| Business JSON-LD | `Organization` + `WebSite` only (thin; no logo, address, phones or socials) |
| Homepage H1 text | Words ran together in the indexed text (hero spans had no spaces) |
| `/compare` | `index, follow` **and listed in the sitemap** (thin, user-specific page) |
| Sitemap | 200, 280 URLs (1 home, 39 collections, 226 products, 8 pages, 5 guides, 1 compare); all `https://www.` |
| robots.txt | OK. Allows the storefront; blocks /admin, /api, /order, /checkout, /cart, /track-order, /search, /preview |
| Host consolidation | `http://laptopshub.pk` → `https://laptopshub.pk` → `https://www.laptopshub.pk` (308s, two hops); `http://www` → `https://www` (308) |
| 404 page | 404 status with `noindex` |

## Root causes (in order of impact)
1. **Google barely knows the site.** No Search Console property existed, so no sitemap had ever been submitted. Only about 2 URLs were indexed.
2. **Stale Google data.** The wrong site name, the old favicon and the old snippets all come from crawls of an earlier site, before this storefront.
3. **Weak brand signals on the homepage.** There was a bare title, no canonical, no social card, a thin business node and garbled H1 text.
4. **Name competition.** "Laptops Hub" is a generic phrase used by other shops. The fix is clear brand + city signals and consistent business details, not tricks.
5. **Duplicate product titles.** 9 groups (19 live products) share identical page titles (see 06).

Crawlability itself was **not** the problem: status codes, robots, sitemap and redirects were all correct.
