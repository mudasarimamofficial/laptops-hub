# 17 — Search monitoring checklist (dated)

**State on 2026-11-25:** SEO engineering is implemented. Google indexing is **pending**.
- Homepage: the historical crawl (22 Oct 2026) got 403 and the page is **not indexed**. The live test on 25 Nov passes ("Page can be indexed").
- Sitemap: Success, 279 discovered URLs (read 25 Nov 2026).
- Priority indexing requests (25 Nov, once each): `/`, `/collections/all`, `/collections/laptops`, `/guides`, `/pages/contact`.

**Rules**
- Do not repeat indexing requests unless the page has changed in a meaningful way (repeats do not move the queue).
- Do not report "indexed" or "ranking" until Search Console shows it. Record the date and the numbers below.

| Date to check | Where in Search Console | Record | Result |
|---|---|---|---|
| 2026-11-28 | URL Inspection → `https://www.laptopshub.pk/` (Google index tab, not the live test) | "URL is on Google"? last crawl date and status | _pending_ |
| 2026-11-28 | Indexing → Pages | Indexed / Not indexed counts and top reasons | _pending_ |
| 2026-12-02 | Indexing → Sitemaps | Status, discovered pages | _pending_ |
| 2026-12-02 | Performance → Search results → Queries filter "laptops hub" | impressions, clicks, average position | _pending_ |
| 2026-12-09 | Pages report | indexed trend; any "Server error (5xx)", "Blocked (403)" or "Duplicate without user-selected canonical" | _pending_ |
| 2026-12-09 | Google search "Laptops HUB Bahawalpur" (signed out) | whether the official site shows and with which site name and favicon | _pending_ |
| monthly | Performance + Pages | trend | _pending_ |

**If the homepage is still not indexed after 2026-12-09:** run the live test again. If it passes, check *Pages* for the reason (for example "Discovered – currently not indexed" or "Crawled – currently not indexed"), and look for duplicate or canonical issues before requesting indexing again (once).
