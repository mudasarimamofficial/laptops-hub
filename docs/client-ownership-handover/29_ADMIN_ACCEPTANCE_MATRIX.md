# 29 — Admin acceptance matrix: 12 checks per merchant screen (2026-11-26)

Every cell is backed by an automated test on the **isolated** stack (local Supabase, local fake mail) or by code. "The
form renders" is never counted as a pass. Production was not written to.

**Key:**
- **✔** — proven by a browser spec (named in the Evidence column).
- **C** — enforced in code and covered by unit tests, without a browser spec for that screen.
- **◐** — partly proven (see note).
- **✗** — not tested.
- **—** — not applicable.

**The 12 checks:**
1. Right role in, wrong roles out.
2. Create or edit.
3. Server validation.
4. Save succeeds.
5. Reload keeps it.
6. Public output or operations follow.
7. SEO output correct.
8. Drafts stay private.
9. Undo or restore.
10. Failures understandable.
11. Unauthorised and Preview writes blocked.
12. Understandable without docs.

**Check 11 for every screen.**
- Every admin route that writes data goes through `createAuthorizedStaffWriter` / `assertMerchantMutationAllowed` (Preview → Production write guard; `tests/unit/merchant-write-guard.test.ts`, `preview-read-only.test.ts`).
- Every admin write API refuses cross-site requests in the middleware (G47, PR #96: `p1-admin-cross-site-g47` + `tests/unit/admin-origin.test.ts`).
- Role refusals are listed per row.

**Check 12** is a human judgement. It needs the owner's walkthrough with `docs/LAPTOPS_HUB_ADMIN_MERCHANT_HANDBOOK.md` and `15_MERCHANT_GUIDE_HOMEPAGE_EDITING.md`. It is marked **R** (review pending) everywhere. The 36-step owner acceptance spec walks the merchant path end to end, but it cannot judge clarity.

| Screen | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | Evidence (isolated specs) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Products: create, variants, price, stock | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✗ | ◐ | ◐ | ✔ | ✔ | R | `p0-variant-order-journey` (9), `p0-inventory-oversell` (3), `p0-admin-discounts-stock` (stale stock refused), `z-owner-acceptance` 1–9. Product SEO tags not asserted. Unpublished variants refused at checkout, but a draft product page is not asserted 404. No undo apart from backups. |
| Product specs & condition | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | — | ✔ | ✔ | R | `p0-product-specs-edit` (2) |
| Product media (G13) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ◐ | — | ◐ | ✔ | ✔ | R | `p1-product-media-g13` (4). Alt text shown publicly. Remove keeps the file. |
| Product bulk / import / export | ◐ | ✔ | ◐ | ✔ | ◐ | ✗ | — | — | ✗ | ◐ | C | R | `p1-product-bulk-select` (1). CSV import has only the script `scripts/test-shopify-csv-commit-smoke.mjs`, no browser spec. |
| Product taxonomy | ✔ | ✔ | ✔ | ✔ | ✔ | ◐ | — | — | — | ✔ | C | R | `p1-product-taxonomy` (1) |
| Collections (G05, G12) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ◐ | ✔ | ✔ | R | `p1-collection-modes-g12` (5), `p0-collection-management` (3), `p0-merchant-inventory-collections`, `seo-search-appearance` (collection og:url). Clearing rules brings the picks back. |
| Inventory desk | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | ◐ | ✔ | ✔ | R | `p0-merchant-inventory-collections` (receive, count, refuse below zero, history; editor refused), `p1-settings-identity-inventory`. The ledger is history, not undo. |
| Orders + order detail | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | ✔ | ✔ | ✔ | R | `launch-journey` (10), `p0-variant-order-journey` (cancel restocks), `z-owner-acceptance` 16–22. Retry result now stays visible (PR #95). |
| COD cash (G22) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | ✔ | ✔ | ✔ | R | `p1-cod-ledger-g22` (3). Production: migration applied 2026-11-26 (D15 closed). |
| Discounts | ✔ | ✔ | ✔ | ✔ | ✔ | ◐ | — | ◐ | ✗ | ◐ | ✔ | R | `p0-admin-discounts-stock` (draft + dated re-save round trip; anonymous refused). Public price effect not asserted in this spec (the live 5% campaign is verified on production pages). |
| Shipping zones | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | ◐ | ✔ | ✔ | R | `shipping-zones` (5), `p0-admin-isolation-and-checkout-gates`. Deactivate only; zones cannot be deleted (by design). |
| Customers | ◐ | — | — | — | — | — | — | — | — | ✗ | C | R | Read-only list: only the access matrix (`admin-mobile-matrix`). |
| Inquiries | ◐ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | — | ✔ | ✔ | R | `home-inquiry` (5); staff alert `p1-notifications-g24`. Editor-role visibility mismatch (G27) still open. |
| Product reviews | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ◐ | ✔ | ✔ | R | `p1-reels-reviews-blog` (pending until approved, rating + JSON-LD; fulfillment refused) |
| Store testimonials & map | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ | R | `p1-store-testimonials-map` (5): editor drafts and cannot publish; hide removes; HTML stays text |
| Reels (shoppable) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ | R | `p1-reels-reviews-blog`, `p1-premium-reels-shoppable`, `p1-social-proof`; restore of reel links `p1-backup-v3…` (G17) |
| Merchandising / social proof / badges | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | ◐ | ✔ | ✔ | R | `p1-social-proof` (5): sales claims cannot be set; no personal data |
| Blog (guides) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ◐ | ✔ | ✔ | R | `p1-reels-reviews-blog` (empty publish refused, draft 404), `seo-search-appearance` (metadata, JSON-LD), `p1-backup-v3-blog-taxonomy` (G18), `mobile-nav-reels-a11y` (sitemap) |
| Content / policy pages | ◐ | ◐ | ◐ | ◐ | ◐ | ✔ | ◐ | ◐ | ✗ | ◐ | C | R | Production code: `prehydration`, `content-pages` (2). History, restore, page SEO and new pages are in **draft PR #91, waiting for migration `20261126160000` (D16)**. Proven there 3/3 + 33/33 SQL. Backup v3 restores non-legal pages. |
| Navigation (header / footer) | ◐ | ✗ | ✗ | ✗ | ✗ | ✗ | — | — | ✗ | ✗ | C | R | **No browser spec.** Access only (`admin-mobile-matrix`). Known gaps G26 (stale header ≤60 s on some pages), G49 (no in-place edit, no draft or history). |
| Theme: homepage sections | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | R | `p1-theme-ordering-preview` (6, incl. preview 404/noindex for others), `p1-theme-copy-publish` (4, stale editor refused), `z-owner-acceptance` 28–32. G28 (editor sees Publish, then 403) open. |
| Theme: site-wide text, templates, product layout, cart & compare | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | R | `p2-theme-globals-publish` (3, incl. SEO title suffix), `p2b-theme-templates-publish`, `p2c-theme-product-layout`, `p2d-theme-cart-compare` |
| SEO (search appearance) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | R | `seo-search-appearance` (7): editor refused UI + API; reset restores |
| Settings: labels, store details | ✔ | ✔ | ◐ | ✔ | ✔ | ✔ | — | — | ◐ | ◐ | ✔ | R | `p1-storefront-labels` (2), `p1-settings-identity-inventory` (2), `admin-mobile-matrix` (save bar) |
| Settings: contact, social, WhatsApp | ✔ | ✔ | ◐ | ✔ | ✔ | ✔ | ✔ | — | ◐ | ◐ | ✔ | R | `contact-social-admin-persist` (2), `contact-social-whatsapp-order` (4), `contact-social-whatsapp` (4) |
| Settings: notifications (G24) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | — | ✔ | ✔ | R | `p1-notifications-g24` (6): admin cannot switch customer email on; staff-only test send; 390 px |
| Settings: backups & restore (G17) | ✔ | ✔ | ✔ | ✔ | — | ✔ | — | — | ✔ | ✔ | ✔ | R | `p1-backup-restore-cod-gate` (COD gate kept), `p1-backup-v3-blog-taxonomy` (v3 pages, reel links, theme; legal pages kept live) |
| COD go-live gate | ✔ | — | — | — | — | ✔ | — | — | — | ✔ | ✔ | R | `p0-admin-isolation-and-checkout-gates` (a failing gate makes checkout non-clickable). The switch is an owner decision (D4), not a form. |
| Staff & roles | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | ✔ | ✔ | ✔ | R | `p0-staff-invitations` (7): admin limits, anonymous refused, deactivate/reactivate |
| Your account / password / recovery | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | — | ✔ | ✔ | ✔ | R | `p1-staff-account-password` (2), `password-recovery` (6), `auth-hash-recovery-bridge` (4), `p0-admin-sign-out` |
| Media library | ◐ | ✔ | ◐ | ✔ | ◐ | ◐ | — | — | ✗ | ◐ | C | R | `p1-product-media-g13` (from the library). G45 (empty-state wording, no delete) open. |
| Analytics | ✔ | — | — | — | — | ✔ | — | — | — | ✗ | — | R | `p0-merchant-inventory-collections` (numbers match the database) |
| Activity log | ◐ | — | — | — | — | ◐ | — | — | — | ✗ | — | R | Audit entries asserted in `shipping-zones` and the API tests. The page itself has only access checks. |
| Admin search (Ctrl+K) | ✔ | — | ✔ | — | — | ✔ | — | — | — | ✔ | ✔ | R | `p0-admin-search` (5): role-scoped results |
| Help | ◐ | — | — | — | — | — | — | — | — | — | — | R | Access only. G41 (contradictory COD text) open. |

## Live defect list (open, with evidence)

| # | Defect | Evidence | Severity | State |
|---|---|---|---|---|
| 1 | Notification retry result vanished after a successful retry | Full baseline 2026-11-26: `launch-journey` retry test failed once; the order page unmounted the result | P2 | **FIXED, live (PR #95)** |
| 2 | Cross-site writes accepted by 31 of 42 admin write APIs (G47) | Code count 2026-11-26. Only SameSite cookie defaults protected them. | P1 security (defence in depth) | **FIXED, live (PR #96)**: one middleware check |
| 3 | Navigation editor has no browser test; no draft/history; stale header ≤60 s (G26, G49) | No spec; `22` §G26/G49 | P2 | Open |
| 4 | Editors see Publish / Restore / Reset, then get 403 (G28); nav and role mismatches (G27) | `22` | P2 | Open |
| 5 | Content-page history and restore not live (G19) | Migration pending | P1 | Owner decision D16 |
| 6 | COD reversal/correction not live (G22) | Migration applied 2026-11-26 | P1 | **FIXED, live** |
| 7 | Compare-at price not shown (G14) | `27` | P1 (design) | Owner decision D18 |
| 8 | Checkout quote "unserved city" message did not appear once in the 35-min full run | Full baseline 2026-11-26. It passed standalone 3 times. The trace was overwritten, so the cause is not determined. | P3 (test stability) | Watch |
| 9 | Remaining P2 audit gaps G29, G40, G41, G43–G46 and microcopy outside cart/compare (G48) | `22` | P2 | Open |

## Fresh baseline (2026-11-26, one uninterrupted run)

Full isolated suite of 53 specs on a production build of `main` at `7706154`:
- **219 passed, 1 failed, 6 did not run**, in 35.3 min.
- The 6 did not run because they are in the failed test's serial block (`launch-journey`).
- The failure was defect 8 above.

Rerun of `launch-journey` standalone:
- It passed the quote test, then exposed defect 1. That was fixed in PR #95.
- After the fix, `launch-journey` passed 10/10 twice.

This is a reliable baseline with one known flaky check. It is **not** a perfectly green full run.
