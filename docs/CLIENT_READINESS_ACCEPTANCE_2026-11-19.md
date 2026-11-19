# Client readiness acceptance — 2026-11-19 (final blockers pass)

Started from `75f0d32c7b708236ab1fce43f31c81320f0d8208` (PR #46 already shipped: checkout H1, recovery bridge, Resend/SMTP).  
This pass closes remaining functional blockers only — no redo of Resend, bridge, checkout heading, or prior reels one-product coverage.

## Acceptance matrix

| Area | Label | Evidence |
|---|---|---|
| Storefront functionality | **PASS** (isolated) | Interactive UX QA `docs/INTERACTIVE_UX_QA_2026-11-19.json` — 459 PASS checks, 0 FAIL across discovered public routes @ 390/768/1280; screenshots in `test-results/interactive-ux-qa/` |
| Merchant functionality | **PASS** (isolated) | `merchant-admin-workflows.spec.ts` 11/11; `p0-merchant-inventory-collections.spec.ts` (collections, inventory desk, analytics) |
| Admin authentication | **PARTIAL** | Isolated owner/staff login **PASS**. Production owner UUID `cc603db4-…`, role `owner`, `is_active=true`, email `infolaptopshub@gmail.com` **PASS**. Fresh post-reset password login: **OWNER VERIFICATION REQUIRED** |
| Reels shopping | **PASS** (isolated fixtures only) | P1 single-product modal **PASS**; multi-product link / reorder / reload / prices / add-to-cart / mobile **PASS** (`p1-reels-reviews-blog.spec.ts`). Production’s six reels left unlinked for merchant curation — **NOT TESTED** as business matches |
| Blog publishing | **PASS** (isolated) | Create → save → `/guides/:slug` 200 → guides index → sitemap → unpublish → 404. Root cause of prior fail: stale `.next-local` + duplicate probe titles (not RLS). Guard: `assertIsolatedAppAligned` |
| Checkout | **PASS** (prior + smoke) | Empty-cart H1 shipped in #46; checkout route interactive smoke **PASS**. Full COD place-order on production remains gated by COD flags — **NOT TESTED** as live COD |
| Responsive usability | **PARTIAL** | Real viewport screenshots + overflow + menu/modal interactions **PASS** on isolated. Full touch/gesture certification **NOT TESTED** |
| Accessibility | **PARTIAL** | Skip links, landmarks, keyboard Tab focus, dialog roles **PASS** in interactive QA. Full screen-reader audit **NOT TESTED** |
| Operational integrations | **PASS** / **PARTIAL** | Resend correct workspace + SMTP v2 (**PASS**, prior). Recovery bridge 4/4 (**PASS**, prior). Owner password completion (**OWNER VERIFICATION REQUIRED**) |

### Overall

**PARTIAL — engineering acceptance largely green on isolated; not complete client ready until owner confirms private password setup + fresh login.**

Blocking for “complete client ready”:

1. Owner privately completes new password + confirms fresh email/password admin login (**OWNER VERIFICATION REQUIRED** — do not resend recovery).
2. Merge/deploy this pass’s test/docs/guard fixes to production.

Non-blocking / honest gaps: full SR audit **NOT TESTED**; production reel–product curation left to merchant; live COD order **NOT TESTED** while COD remains gated.

## What changed this pass

- Blog E2E: slug-scoped guides assertions; `scripts/test-fixtures/check-isolated-app.mjs`; `docs/ISOLATED_TESTS.md` rebuild warning.
- Shoppable reels: multi-product picker, reorder, reload, modal prices, add-to-cart, mobile screenshot coverage.
- Merchant E2E: settings heading aligned to real UI (`Settings` + categories nav); full 11/11 green on isolated.
- Interactive UX QA script + JSON evidence (not the old 80-viewport structural smoke).

## Owner password (item 5)

| Check | Label |
|---|---|
| UUID unchanged | **PASS** — `cc603db4-d291-4dc1-a401-b04ffbeff86c` |
| Active owner | **PASS** |
| Correct email | **PASS** — `infolaptopshub@gmail.com` |
| Password form / fresh login after reset | **OWNER VERIFICATION REQUIRED** |
| Recovery sessions invalidated | **OWNER VERIFICATION REQUIRED** (confirm after owner login) |
| Admin settings accessible post-login | **OWNER VERIFICATION REQUIRED** |

`last_sign_in_at` may update from recovery-link exchange; that alone is not acceptance of a privately chosen password.
