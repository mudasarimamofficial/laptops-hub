# Next client delivery phase (post PR #14)

**Branch:** `feat/client-delivery-phase-next`  
**Base:** `main` @ `d60f180` (PR #14 production)  
**Constraint:** V5 frozen · no invented facts · no COD enable without owner approval · no rights-unsafe media

## Workstreams (do not duplicate existing admin surfaces)

| # | Client need | Existing surface | Next work |
|---|---|---|---|
| 1 | Genuine reviews | Admin → Reviews (moderated) | Intake/publish only owner-approved real reviews; never fabricate |
| 2 | Licensed reels | Admin → Reels (rights-gated) | Owner-supplied licensed clips + rights metadata; play/consent already built |
| 3 | Blog | Admin → Blog | Editorial posts from owner copy only |
| 4 | Product badges | Admin → Badges & social proof | Schedule real merchandising labels; no fake social proof |
| 5 | Storefront label cleanup | Storefront + `data/lh-content.js` pending blocks | Remove/replace stale labels; use pending blocks for unknowns |
| 6 | Shopify-quality admin UX | Admin shell (search, shortcuts shipped) | Incremental UX polish only — no redesign |
| 7 | COD operational readiness | Readiness gates + 403 COD | Owner inputs: policies, fees, email transport, COD flags — engineering prep only until approved |

## Out of scope until owner says otherwise

- Enabling COD / changing shipping tariffs  
- Publishing unlicensed third-party video  
- Inventing testimonials, ratings, or sales claims  
- Hostinger CRM changes  
- Replaying migrations (ledger already 29/29)

## Execution order (owner brief 2026-11-18)

1. Commit release + phase docs on this branch  
2. Acceptance matrix vs live production (not empty-table ≠ missing)  
3. Homepage reviews via `store_testimonials` (import/provenance/admin + V5 marquee)  
4. Generation reels (rights-gated; no ronin.pk media)  
5. Blog, badges, label cleanup  
6. Premium admin UX (Shopify-benchmark productivity)  
7. COD launch prep (no production enable without approval)  
8. Incremental PRs + isolated write tests; Preview uses prod DB (read-only QA discipline)  
