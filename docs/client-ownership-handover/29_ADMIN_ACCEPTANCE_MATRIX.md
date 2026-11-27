# 29 — Admin acceptance matrix: 12 checks per merchant screen (2026-11-26, updated 2026-11-27)

> **2026-11-27 update:** these rows were updated with new browser evidence: navigation, import/export, discounts, theme roles, customers, media, analytics, activity, help and the defect list. PRs, deploys and the owner walkthrough are in `32_ACCEPTANCE_CLOSURE_2026-11-27.md`. Check 12 is still **R** everywhere.

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
| Product bulk / import / export | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ◐ | ✔ | ✔ | R | `p1-product-bulk-select` (1), **`p1-product-import-seo` (4, 2026-11-27)**: dry run is required before commit (`preview_required`); quoted CSV cells parse; update-by-handle changes only filled columns and keeps stock; new products without a price become drafts; SEO and JSON-LD reach the public page; drafts are not public; editor refused. Undo is by backup only. |
| Product taxonomy | ✔ | ✔ | ✔ | ✔ | ✔ | ◐ | — | — | — | ✔ | C | R | `p1-product-taxonomy` (1) |
| Collections (G05, G12) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ◐ | ✔ | ✔ | R | `p1-collection-modes-g12` (5), `p0-collection-management` (3), `p0-merchant-inventory-collections`, `seo-search-appearance` (collection og:url). Clearing rules brings the picks back. |
| Inventory desk | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | ◐ | ✔ | ✔ | R | `p0-merchant-inventory-collections` (receive, count, refuse below zero, history; editor refused), `p1-settings-identity-inventory`. The ledger is history, not undo. |
| Orders + order detail | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | ✔ | ✔ | ✔ | R | `launch-journey` (10), `p0-variant-order-journey` (cancel restocks), `z-owner-acceptance` 16–22. Retry result now stays visible (PR #95). |
| COD cash (G22) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | ✔ | ✔ | ✔ | R | `p1-cod-ledger-g22` (3). Production: migration applied 2026-11-26 (D15 closed). |
| Discounts | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ | ◐ | ◐ | ✔ | R | `p0-admin-discounts-stock`; **`p1-discount-propagation` (2/2, 2026-11-27)**: a draft changes nothing; Activate changes the checkout quote, the announcement bar and the product page price; Disable reverts all three. Undo means disable; there is no version history. |
| Shipping zones | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | ◐ | ✔ | ✔ | R | `shipping-zones` (5), `p0-admin-isolation-and-checkout-gates`. Deactivate only; zones cannot be deleted (by design). |
| Customers | ✔ | — | — | — | — | — | — | — | — | — | C | R | **Read-only by design**: the list is derived from orders. No edit, export or delete, so there is no personal-data editing surface. Roles: owner/admin/manager (sidebar matches the page). |
| Inquiries | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | — | ✔ | ✔ | R | `home-inquiry` (5); staff alert `p1-notifications-g24`. G27 closed: the sidebar matches page access for every admin route (audit 2026-11-27, PR #101). |
| Product reviews | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ◐ | ✔ | ✔ | R | `p1-reels-reviews-blog` (pending until approved, rating + JSON-LD; fulfillment refused) |
| Store testimonials & map | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ | R | `p1-store-testimonials-map` (5): editor drafts and cannot publish; hide removes; HTML stays text |
| Reels (shoppable) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ | R | `p1-reels-reviews-blog`, `p1-premium-reels-shoppable`, `p1-social-proof`; restore of reel links `p1-backup-v3…` (G17) |
| Merchandising / social proof / badges | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | ◐ | ✔ | ✔ | R | `p1-social-proof` (5): sales claims cannot be set; no personal data |
| Blog (guides) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ◐ | ✔ | ✔ | R | `p1-reels-reviews-blog` (empty publish refused, draft 404), `seo-search-appearance` (metadata, JSON-LD), `p1-backup-v3-blog-taxonomy` (G18), `mobile-nav-reels-a11y` (sitemap) |
| Content / policy pages | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | R | **G19 live 2026-11-27** (migration `20261126160000` owner-approved and applied; PR #91 `365a0a1`). `p1-content-revisions-g19` (3) on merged code, `content-pages` (2), SQL matrix 33/33: history, restore as a new version, page SEO, new pages, address change with 308, legal gate. Production: 13 baseline revisions equal the live text. The owner's UI check is still pending. |
| Navigation (header / footer) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | ✔ | ✔ | ✔ | R | **`p1-navigation-editor-g26-g49` (5, 2026-11-27, PR #99)**: in-place edit reaches the desktop header, phone menu and footer on cached pages and survives reload; restore from 10-version history; unsafe addresses refused; stale save gets 409 with Reload; an emptied menu is respected; width warning; editor can save and restore versions but not reset defaults; fulfillment refused. Saves publish at once (no draft, by design). |
| Theme: homepage sections | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | R | `p1-theme-ordering-preview` (6, incl. preview 404/noindex for others), `p1-theme-copy-publish` (4, stale editor refused), `z-owner-acceptance` 28–32. **G28 closed** (`p1-role-ux-g27-g28`, PR #101): editors see Publish/Restore disabled with the reason; the server still refuses with 403. |
| Theme: site-wide text, templates, product layout, cart & compare | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | R | `p2-theme-globals-publish` (3, incl. SEO title suffix), `p2b-theme-templates-publish`, `p2c-theme-product-layout`, `p2d-theme-cart-compare` |
| SEO (search appearance) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | R | `seo-search-appearance` (7): editor refused UI + API; reset restores |
| Settings: labels, store details | ✔ | ✔ | ◐ | ✔ | ✔ | ✔ | — | — | ◐ | ◐ | ✔ | R | `p1-storefront-labels` (2), `p1-settings-identity-inventory` (2), `admin-mobile-matrix` (save bar) |
| Settings: contact, social, WhatsApp | ✔ | ✔ | ◐ | ✔ | ✔ | ✔ | ✔ | — | ◐ | ◐ | ✔ | R | `contact-social-admin-persist` (2), `contact-social-whatsapp-order` (4), `contact-social-whatsapp` (4) |
| Settings: notifications (G24) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | — | ✔ | ✔ | R | `p1-notifications-g24` (6): admin cannot switch customer email on; staff-only test send; 390 px |
| Settings: backups & restore (G17) | ✔ | ✔ | ✔ | ✔ | — | ✔ | — | — | ✔ | ✔ | ✔ | R | `p1-backup-restore-cod-gate` (COD gate kept), `p1-backup-v3-blog-taxonomy` (v3 pages, reel links, theme; legal pages kept live) |
| COD go-live gate | ✔ | — | — | — | — | ✔ | — | — | — | ✔ | ✔ | R | `p0-admin-isolation-and-checkout-gates` (a failing gate makes checkout non-clickable). The switch is an owner decision (D4), not a form. |
| Staff & roles | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | ✔ | ✔ | ✔ | R | `p0-staff-invitations` (7): admin limits, anonymous refused, deactivate/reactivate |
| Your account / password / recovery | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | — | ✔ | ✔ | ✔ | R | `p1-staff-account-password` (2), `password-recovery` (6), `auth-hash-recovery-bridge` (4), `p0-admin-sign-out` |
| Media library | ✔ | ✔ | ◐ | ✔ | ◐ | ◐ | — | — | ✗ | ✔ | C | R | `p1-product-media-g13` (from the library). G45 wording fixed (`p1-admin-accuracy-g41-g45`, PR #104): the page no longer claims rights status hides images. **No delete or copy-URL** (CMS uploads stay; documented limitation). Bulk Shopify media migration is D17. |
| Analytics | ✔ | — | — | — | — | ✔ | — | — | — | ✗ | — | R | **Read-only by design.** `p0-merchant-inventory-collections` (numbers match the database). No export; the date range is the only control. |
| Activity log | ✔ | — | — | — | — | ✔ | — | — | — | ✔ | — | R | **`p1-activity-search` (4/4, 2026-11-27, PR #103)**: search by plain label, technical action or record id; staff and period filters combine and clear; staff shown by email; hostile text is neutralised; editor refused. Read-only audit trail by design. |
| Admin search (Ctrl+K) | ✔ | — | ✔ | — | — | ✔ | — | — | — | ✔ | ✔ | R | `p0-admin-search` (5): role-scoped results |
| Help | ✔ | — | — | — | — | ✔ | — | — | — | — | — | R | **`p1-admin-accuracy-g41-g45` (2, PR #104)**: ordering status follows the same readiness check as Overview; tasks shown per role and each link opens; no contradictory COD text on Overview, Help or Settings. |

## Live defect list (open, with evidence)

| # | Defect | Evidence | Severity | State |
|---|---|---|---|---|
| 1 | Notification retry result vanished after a successful retry | Full baseline 2026-11-26: `launch-journey` retry test failed once; the order page unmounted the result | P2 | **FIXED, live (PR #95)** |
| 2 | Cross-site writes accepted by 31 of 42 admin write APIs (G47) | Code count 2026-11-26. Only SameSite cookie defaults protected them. | P1 security (defence in depth) | **FIXED, live (PR #96)**: one middleware check |
| 3 | Navigation editor has no browser test; no draft/history; stale header ≤60 s (G26, G49) | `p1-navigation-editor-g26-g49` (5) | P2 | **FIXED, live (PR #99)**: in-place edit, history and restore, header/footer/phone in sync, conflict 409 |
| 4 | Editors see Publish / Restore / Reset, then get 403 (G28); nav and role mismatches (G27) | `p1-role-ux-g27-g28` (3); role audit | P2 | **FIXED, live (PR #101)**; no permission widened |
| 5 | Content-page history and restore not live (G19) | Migration applied 2026-11-27 (owner-approved), `26` §G19-10 | P1 | **FIXED, live (PR #91)** |
| 6 | COD reversal/correction not live (G22) | Migration applied 2026-11-26 | P1 | **FIXED, live** |
| 7 | Compare-at price not shown (G14) | `27` | P1 (design) | Owner decision D18 |
| 8 | Checkout quote "unserved city" message did not appear once in the 35-min full run | **Root cause found 2026-11-27**: a slower answer for an earlier address could replace the current one. `p0-checkout-quote-race`: old code 0/5, fixed 5/5 | P2 (wrong fees could be shown) | **FIXED, live (PR #102)** |
| 9 | Remaining P2 audit gaps G29, G40, G43, G44, G46 and microcopy outside cart/compare (G48) | `22`; theme assessment in `32` §6 | P2 | Open. **G41 and G45 FIXED (PR #104).** |
| 10 | CSV import: quoted cells mis-parsed; update-by-handle blanked fields and reset stock; commit possible without preview | `p1-product-import-seo` | P1 | **FIXED, live (PR #100)** |
| 11 | Header overflow with 8 links hid the cart; Support link vanished when FAQ unpublished | `p1-navigation-editor-g26-g49` | P2 | **FIXED, live (PR #99)** |

## Fresh baseline (2026-11-26, one uninterrupted run)

Full isolated suite of 53 specs on a production build of `main` at `7706154`:
- **219 passed, 1 failed, 6 did not run**, in 35.3 min.
- The 6 did not run because they are in the failed test's serial block (`launch-journey`).
- The failure was defect 8 above.

Rerun of `launch-journey` standalone:
- It passed the quote test, then exposed defect 1. That was fixed in PR #95.
- After the fix, `launch-journey` passed 10/10 twice.

This is a reliable baseline with one known flaky check. It is **not** a perfectly green full run.

**2026-11-27:** the flaky check was a real race in the checkout page, now fixed (defect 8, PR #102). A new full uninterrupted run after this pass's merges has **not** been done yet.
