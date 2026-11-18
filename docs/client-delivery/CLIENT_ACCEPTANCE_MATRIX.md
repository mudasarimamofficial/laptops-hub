# Client delivery acceptance matrix (post PR #14)

**Branch:** `feat/client-delivery-phase-next`  
**Production baseline:** `d60f180` / `dpl_F4La1bjFa5WDXgfjYZ5cZ5TiXi3P`  
**Rule:** Empty tables ≠ missing features. Component present ≠ content delivered.

| Requirement | Existing implementation | Gap | Admin control | Work required | Evidence | Status |
|---|---|---|---|---|---|---|
| Homepage Google-style reviews marquee (2 opposing rows, pause/play, dialog, a11y, V5) | `StoreReviews` + `store_testimonials`; section omitted when empty | **0 published** until owner verifies; 37 candidates ready as drafts | Admin → Reviews → Testimonials → Import Google snapshot | Merchant verifies GBP + Maps URL + consent, then publishes | Reconciliation JSON + import API | ENGINEERING DONE · CONTENT UNPUBLISHED |
| Hardcoded 4.9 / 157 rating | Not in product code; Maps profile link only | Source HTML contains claim — must not be shown until GBP confirmed | Theme `googleProfileUrl` | Keep suppressed | Unit greps + `store-reviews.tsx` | PASS (suppressed) |
| Genuine review intake without code changes | Form + draft Google without URL + bulk snapshot import | — | Testimonials admin | Done on this branch | Import button + publish blockers | PASS |
| Generation reels section | `ReelsSection` + Admin → Reels; rights-gated; ronin blocked | **0 authorized videos** in repo/prod | Admin → Reels | Owner must supply owned/licensed HTTPS files | `REELS_RIGHTS_CHECKLIST.md` | ENGINEERING DONE · CONTENT BLOCKED |
| Blog /guides | Admin Blog + `/guides` + import guide drafts | Empty `articles` until import/publish | Admin → Blog → Import guide drafts | Review 4 factual drafts; publish when approved | V5 templates → draft HTML | ENGINEERING DONE · CONTENT UNPUBLISHED |
| Merchandising badges | Featured / Staff pick + real-order Top seller; filled navy chips | Featured home row now prefers badge Featured handles | Admin → Merchandising | Assign genuine Featured/Staff pick | `merch-badges.tsx` + home Featured | PASS (polish) |
| Purchase activity toasts | Real confirmed/delivered orders only | OFF by default | Merchandising settings | Preserve; never fabricate | `PurchaseActivity` | PASS (honest) |
| Storefront prototype labels | Spec/budget/Chromebook counts now gated by `showCatalogCounts` (default off) | Collection result counts still show (useful UX) | Settings presentation | Optional further gating | `home-sections` / `home-client` | PASS (homepage) |
| Premium admin UX | Reels + Blog desks on AdminPageHeader; shipping readiness anchors | More desks still use leftover `lh-*` | Admin desks | Continue incremental | reels/blog/settings | PARTIAL |
| COD launch | Gates + 403; fees editable; free delivery via explicit 0 / threshold | Owner policies/fees/email/approval | Settings + shipping | Prep only; no prod enable | `#shipping` banner + 403 | BLOCKED on owner |

## Verification checklist (Google review candidates)

Before publishing any imported Google review:

1. Open the live Google Business Profile for Laptops HUB and find the same author + text + date.  
2. Paste the **individual review Maps URL** into `sourceUrl`.  
3. Confirm the customer may be named publicly (`consentConfirmed`).  
4. Confirm avatar display permission **or** clear `avatarUrl`.  
5. Set status → Published (owner/admin/manager only).  
6. Confirm homepage shows cards without any aggregate 4.9/157 badge unless independently verified and explicitly approved.
