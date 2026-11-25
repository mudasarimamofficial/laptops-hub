# 12 — SEO test results

All runs on 2026-11-25, against the isolated local stack (local Supabase, fake mail), never production data.

| Suite | Command | Result |
|---|---|---|
| Unit (all) | `npm run test:unit` | PASS (includes new `tests/unit/seo-site.test.ts`) |
| Types | `npx tsc --noEmit -p .` | PASS |
| Lint | `npx eslint src tests --quiet` | PASS (0) |
| SEO e2e | `tests/e2e-isolated/seo-search-appearance.spec.ts` | **7/7 PASS** |
| Neighbouring e2e (admin-mobile-matrix, contact-social ×2, reels-reviews-blog, testimonials-map, theme-globals-publish, content-pages) | isolated config | 30/31. The single failure was a stale footer-duplicate locator in content-pages, fixed in PR #79 (merged) |
| CI `quality` (GitHub) | on PR #80 | see 13 |

## What the SEO e2e covers
1. Homepage: brand+city title, description, canonical (root), og:site_name/url/image (1200×630), twitter card, Organization+ComputerStore and WebSite JSON-LD (address, phones, sameAs, alternate names, no ratings/hours/SearchAction), brand images served, readable H1.
2. Hero heading words separated in the text.
3. `/compare` is `noindex, follow` and not in the sitemap; sitemap URLs are all on the site origin and include live products.
4. Owner edits the homepage title (including `<script>`) → public homepage follows, escaped → reset restores the default. The shared-titles report renders.
5. An editor sees the form disabled; PUT returns 403.
6. A guide gets Article + BreadcrumbList JSON-LD and article Open Graph from its own SEO fields (temporary QA article, deleted afterwards).
7. Collections have their own description (the collection's own text, else the brand+city fallback) and og:url/site_name.
