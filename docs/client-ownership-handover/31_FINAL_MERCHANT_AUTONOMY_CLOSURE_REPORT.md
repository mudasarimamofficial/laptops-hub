# 31 — Final report: merchant autonomy, admin and theme editor closure (2026-11-26)

**Status: READY FOR OWNER APPROVAL — NOT YET LIVE-COMMERCE CERTIFIED. This is not a complete handover certificate.**
Infrastructure ownership (D1, D2, D9) and one verified real order (D4) are still open.

> **2026-11-27 evening addendum (UI hardening close-out):** see `ui-hardening-2026-11-27/` (00–12).
> - #107–#111 are live (VIS-001 to VIS-008, plus the filter accessibility fix).
> - Full isolated run on `4e4daac`: 275 passed / 3 failed / 8 not run. Re-running those files: 15/15. No product cause (`ui-hardening-2026-11-27/10`).
> - New: HYD-001 (checkout hydration mismatch) and SEO-001 (`/cart` noindex), fixed in the PR listed in `ui-hardening-2026-11-27/11`.
> - The owner walkthrough (§5), D19, D1/D2/D9, D4 and D17 are unchanged and still open.

> **2026-11-27 addendum — acceptance-matrix closure:** see `32_ACCEPTANCE_CLOSURE_2026-11-27.md`.
> - **Live:** #99 navigation G26/G49, #100 import safety + import/SEO E2E, #101 role UX G27/G28, #102 checkout quote race (the "flaky" check was a real bug), #103 activity search, #104 G41/G45 accuracy. #105 adds a discount propagation E2E (test only).
> - **G19:** the owner approved it in chat; migration `20261126160000` was applied and PR #91 merged (`365a0a1`). Record: `26` §G19-10.
> - **Separate states:**
>   - engineering: the priority list is done or documented;
>   - merchant acceptance: **not done** (the owner walkthrough in `32` §5);
>   - third-party readiness: **not certified** (public repo D19, ownership D1/D2/D9, COD D4).

## 1. Latest commit and deploy

- `main` = `aa6ff87` (PR #96) at the time of writing; this report itself lands in a docs-only PR after it.
- Vercel production deploy for that commit: **success** (GitHub status "Vercel"). Read-only check: a cross-site POST to `/api/admin/posts` and `/api/admin/notifications/settings` answers 403; same-site without a session answers 401/405.
- Read-only production smoke after each merge: `/`, `/cart`, `/compare`, `/guides`, `/pages/privacy` and `/sitemap.xml` all 200. Admin APIs answer 401 to anonymous requests.

PRs in this pass:

| PR | Change | State |
|---|---|---|
| #88 | G12 collection modes, merchant order, visible errors | live |
| #89 | G13 product media: alt, primary, rights, upload | live |
| #90 | G22 COD ledger code | live; migration **applied 2026-11-26** with owner approval (`26` §G22-8) |
| #91 | G19 content-page history, restore, SEO, new pages | **draft**; merge only after migration (D16) |
| #92 | G24 notification settings, test send, inquiry alerts | live |
| #93 | G17 backup v3; G18 blog taxonomy | live |
| #94 | Theme editor: Cart & compare site-wide text (LH-012/G48 part) | live |
| #95 | Notification retry result stays visible (found by the full baseline) | live |
| #96 | G47: cross-site writes refused on every admin API | live |

## 2. P0 / P1 status

| Gap | Status |
|---|---|
| P0 G01–G03, G06, G07 (and the rest of P0) | **5 of 5 fixed, live** |
| G04, G05, G08–G11, G15, G16, G20, G21, G23, G25 | fixed, live (earlier PRs) |
| G12, G13, G17, G18, G24 | **fixed, live (this pass)** |
| G14 compare-at | **proposal only** (`27` + mock), not built (D18) |
| G19 content pages | **prepared**: draft PR #91 + migration `20261126160000` not applied (D16) |
| G22 COD corrections | **fixed, live**: migration `20261126140000` applied 2026-11-26 with owner approval, verified read-only |
| G47 cross-site admin writes (P2, security) | **fixed** in PR #96 |
| G42 / G48 | partly fixed |

Counts: P1 has 18 of 20 fixed. G14 waits for a design decision; G19 waits for its migration (D16).

## 3. Theme editor coverage

Draft, private preview, publish and rollback work for these panels:
- homepage sections (order, hide, settings, 46 copy fields);
- header & footer (11);
- product pages, collection pages, page-not-found text (25);
- product-page section layout;
- cart & compare (16, new).

Still code text (G48 remainder): search, checkout, order pages, reviews and map labels, inquiry form, content-page labels.
Production has **0 theme publications**: the storefront shows the frozen V5 defaults until the merchant publishes (D5).

## 4. Admin acceptance

`29_ADMIN_ACCEPTANCE_MATRIX.md`: 36 screens × 12 checks, each backed by a named isolated spec or code.

- **Strong:** products and variants, collections, inventory, orders, COD cash (isolated), reviews, testimonials, reels, blog, theme, SEO, shipping zones, notifications, backups, staff, account and recovery.
- **Weak:**
  - navigation editor: no browser spec;
  - product CSV import: script only;
  - customers, activity and help: access checks only;
  - content pages: G19 pending.
- **Check 12** (understandable without docs) needs the owner's walkthrough on every screen.

## 5. Tests

| Run | Result |
|---|---|
| Full isolated suite, one uninterrupted run on `main` `7706154` (53 specs) | **219 passed, 1 failed, 6 did not run** (35.3 min). The failure was a checkout-quote message that did not appear once. It passed standalone 3 times; the cause is not determined because the trace was overwritten. The 6 were in the same serial block. |
| `launch-journey` reruns | First rerun exposed the retry-message defect (fixed, PR #95). After the fix: 10/10 twice. |
| G47 regression set (15 specs, 75 tests) | **75/75 passed** (8.9 min), including the new `p1-admin-cross-site-g47` |
| Unit (`npm run test:unit`), typecheck, lint | pass (local and CI `quality`) |
| CI `quality` on every PR | green before each merge |

**Limits:**
- Not one perfectly green full run.
- Accessibility: axe scans of home and login only, plus keyboard checks in specific specs.
- Cross-browser: separate config, not re-run this pass.
- Content-page and COD-correction features are proven only on the isolated stack.

## 6. Migrations

| | Migrations |
|---|---|
| Applied in production | **44**; ledger aligned (`migration list --linked`, 2026-11-26). `20261126140000` (G22) was applied 2026-11-26 with owner approval. |
| Pending, on PR #91 branch | `20261126160000` (G19), awaits D16 |

The only production database change in this pass is the owner-approved G22 migration (`26` §G22-8).

## 7. Backups

- The CMS backup format is now **v3**: content pages, reel links and the theme pointer are added.
- v2 backups still validate and restore (`tests/unit/merchant-snapshots.test.ts`). The older legacy catalog format stays refused, as before LH-036.
- Restore keeps live: the COD switch, notification settings and legal-page text.
- Production has 1 backup (taken before v3). **Take a new backup** after this deploy.
- Database-level backups still depend on D2: Supabase Free has none included. A local `pg_dump` rehearsal was proven earlier.

## 8. Commerce (read-only, 2026-11-26)

| Item | Production state |
|---|---|
| Storewide discount | 5%, active, no code, no end date |
| COD ordering | `cod_checkout` enabled |
| Orders | 1 (the 18 Nov QA order) |
| Variants | 235; 226 active products |
| Store testimonials | 37 |
| Notification settings | none saved, so the env fallback is used |

None of these were changed. No production payment, collection, refund, email blast or customer notification was made.

## 9. SEO and Search Console

- Homepage: canonical `https://www.laptopshub.pk`, `index, follow`.
- `robots.txt` disallows `/admin/`, `/api/` and `/order/`; the sitemap lists 279 URLs.
- Guides now carry `articleSection` and `keywords`. Filtered guide lists are `noindex`, canonical `/guides`.
- Search Console is owned by the business account. Indexing is Google's decision (`seo-search/17`).
- PR #80's SEO work was not rebuilt.

## 10. Security and accessibility

- **New this pass:**
  - G47: one middleware check refuses cross-site writes on all 42 admin write APIs.
  - The Preview → Production write guard covers every admin data write.
  - Notification "on for customers" is owner-only.
  - Test sends go to saved staff recipients only.
- **Git history review (`28`):**
  - No keys, passwords or tokens were found in history.
  - Personal data of the engineering test order was redacted from current files. It remains in history.
  - The repository is public (D9/D19).
  - `.gitignore` was hardened.
  - Production auth: 2 accounts, 0 test-like.
- **Still open:**
  - LH-016 leaked-password protection (D14);
  - production keys on the engineering workstation (D13);
  - G27/G28 role-visibility mismatches (they cause 403s, not leaks).

## 11. Owner decisions

All are in `23`:

| Group | Decisions |
|---|---|
| Accounts and plans | D1 Vercel plan, D2 Supabase backups, D9 transfer and repository visibility, D10 DNS/CRM |
| Commerce | D3/D17 Shopify-hosted images (G13-M1), D4 one real order, D6 WhatsApp, D7 email account, D8 monitoring |
| Workstation security | D13 local production keys, D14 leaked-password protection |
| Migrations | D15 G22 migration (**closed 2026-11-26**), D16 G19 migration then PR #91 |
| Design | D18 G14 compare-at design |
| Custody | D19 Git history and LH-025 evidence custody |

D19 includes a P12 task only the owner can do: copy `Documents\LaptopsHub-private\lh025-*-2026-11-26\` to client-controlled encrypted storage.

## 12. Handover readiness

| Area | Readiness |
|---|---|
| Engineering for merchant self-service | Ready, except D16 and D18 |
| Operating on client-owned accounts | **Not ready** (D1, D2, D9) |
| Live-commerce certification | **Not done** (D4) |

The runbook and dependency list are in `30_OPERATIONS_RUNBOOK_AND_DEPENDENCIES.md`.
