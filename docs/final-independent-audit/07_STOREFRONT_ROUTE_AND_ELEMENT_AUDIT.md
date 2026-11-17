# 07 — Storefront route and element audit

**Date:** 2026-11-17  
**Live host:** https://www.laptopshub.pk · production `dpl_8YQ3HoEmaw5bqAv4rxBS1Z5eSz3N` @ `585c8e9`

## Smoke (authenticated browser + HTTP)

| Route / surface | Result |
|---|---|
| `/` homepage | PASS — V5 hero, story, brands, featured, inquiry, map |
| Header / mega / search / compare / cart | PASS (controls present) |
| Add to cart → cart badge | PASS (earlier this session) |
| `/checkout` | PASS gate — “Online ordering opens soon”; Place COD disabled |
| `POST /api/checkout/cod` | 403 `checkout_disabled` (correct) |
| Reviews homepage section | Absent — 0 published testimonials (integrity) |
| Reels / Generation section | Absent — 0 published reels (integrity) |
| Map “Open in Google Maps” | PASS — present after footer |
| Apex `laptopshub.pk` | 308 → www |
| CRM `app.laptopshub.pk` | 200 · A `45.130.228.253` (untouched) |

## Catalog (DB)

| Metric | Value |
|---|---|
| Active products | 226 |
| Drafts | 6 |
| Soft-deleted | 1 (QA) |
| Variants | 234–235 |
| Media | 964 |
| Collections | 16 |

## Gaps / follow-ups

- Full viewport matrix (1920→320) and axe sweep not re-run this session — prior V5 evidence stands; re-run after visual-touching releases.
- Deep PDP variant matrix covered in isolated `p0-variant-order-journey` (local).
- Policy pages remain unpublished until owner copy (go-live gate).

## Verdict

**PASS** for live storefront identity, gated checkout honesty, empty-state integrity for reviews/reels.  
**PARTIAL** for exhaustive viewport/a11y re-sweep this session.
