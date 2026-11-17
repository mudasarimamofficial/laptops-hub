# 21 — Risk register and executive summary

**Date:** 2026-11-17

## Executive summary

Laptops HUB is an independent Next.js + Supabase e-commerce platform serving Pakistani laptop buyers at `www.laptopshub.pk`. It is **not** a Shopify theme — it is a purpose-built platform with its own admin, COD checkout, inventory, and content management.

**Current state:** The storefront is live-serving a 226-product catalog with correct pricing, specifications, images, and navigation. All commerce gates (COD checkout, theme publish) are correctly disabled pending owner configuration. The engineering is verified locally with 25/25 test suites passing.

**Launch readiness:** Engineering is complete. Launch is blocked on 6 owner-side inputs (content, email, shipping config, media rights, staging, and branch merge).

## Risk matrix

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Content pages 404 visible to users/search engines | HIGH (current) | Medium (SEO, trust) | Publish content pages or add noindex | Owner |
| No transactional email | HIGH (current) | High (no order/staff notifications) | Configure Resend + env vars | Owner |
| Security migration 28 not on production | MEDIUM | High (staff write escalation open) | Merge `feat/merchant-operating-system`, apply migration | Owner + Engineer |
| No staging environment | MEDIUM | Medium (untested deploys) | Create staging Supabase + Vercel env | Owner |
| Missing HTTP security headers | LOW | Medium (XSS/clickjacking surface) | Add headers in `next.config.js` | Engineer |
| No branch protection | MEDIUM | Medium (accidental force-push) | Enable required reviews on `main` | Owner |
| Media rights uncleared | HIGH (current) | High (legal) | Clear OEM image rights | Owner |
| Hero images unoptimized | LOW | Low (performance) | Implement srcset on hero | Engineer |

## Critical path to launch

```
1. Owner reviews + merges feat/merchant-operating-system → main
2. Owner backs up production Supabase
3. Owner applies migrations 15-28 (especially 28 for security)
4. Owner configures Resend email (API key, DNS, env vars)
5. Owner publishes content pages (about, contact, policies)
6. Owner configures shipping zones and fees
7. Owner enables COD checkout
8. Engineer adds security headers (can be same PR or follow-up)
9. Owner creates staging environment for future changes
```

## What works today (production)

- Full 226-product catalog with specs, images, prices
- Product search, filtering by spec, collection browsing
- Product comparison (up to 4 side-by-side)
- Cart with quantity management
- Inquiry form for customer questions
- Admin login with authentication
- SEO: sitemap, robots.txt, structured page titles
- Edge caching via Vercel CDN (Mumbai edge → Singapore origin)
- Domain routing: apex → www redirect, Vercel alias → www redirect
- CRM at `app.laptopshub.pk` isolated and untouched

## What does NOT work today (by design)

- COD checkout (disabled, correct gate)
- Theme publish to public homepage (gated)
- Transactional email (not configured)
- Policy/company pages (no content)
- Product reviews/testimonials (none published)
- Video reels (none published)
