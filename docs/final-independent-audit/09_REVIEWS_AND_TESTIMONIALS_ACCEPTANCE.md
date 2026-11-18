# 09 — Reviews and testimonials acceptance

**Date:** 2026-11-17 · Production `585c8e9`

## Store testimonials (homepage “What our customers say”)

| Layer | Status | Evidence |
|---|---|---|
| Component | **PASS** | Full-width dual-row design in codebase; empty ⇒ not rendered |
| Theme controls | **PASS (code)** | Homepage section registry includes reviews |
| Admin | **PASS (route)** | `/admin/reviews` (+ testimonials) |
| Published content | **NONE** | SQL `store_testimonials` = **0** |
| Public visibility | **Correctly hidden** | No review region on live homepage |
| Fake Google 4.9/157 | **Not present** | Integrity rule preserved |

## Product reviews

| Layer | Status | Evidence |
|---|---|---|
| Model + moderation API | **PASS (code)** | `product_reviews`; pending → approve/reject |
| Published rows | **NONE** | SQL count = **0** |
| Structured data | Only with ≥1 approved | No invented aggregateRating |

## Classification

**Engineering ready · Admin ready · Content unavailable · Not publicly visible · Owner input required**

Do not publish synthetic reviews on production.
