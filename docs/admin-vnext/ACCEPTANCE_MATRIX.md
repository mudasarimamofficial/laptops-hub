# Admin VNext — system acceptance matrix

**Not a 10/10 certification.** This matrix records what is independently proven vs still pending.

**Main SHA:** `6e683fac0fdc0251fbf5e5648f271a4b945702a1`  
**Merged PRs this mandate wave:** #29 D2 · #30 E · #31 TipTap · #32 Reviews/Reels  
**Production deploy:** `dpl_GbnaeHReBLurhw4MtFSckJRDxhqw` — **READY** on `www.laptopshub.pk`  
**Rollback checkpoint:** previous main `58572f6` / `dpl_B6a75f81JJ7rD4Z6xX25NtQEmpDT`

Gate values: `PASS` · `PARTIAL` · `FAIL` · `NOT TESTED` · `BLOCKED`

## Cross-cutting

| Gate | Status | Evidence |
|---|---|---|
| CI `quality` on merge PRs | PASS | GitHub Actions green on #29–#32 |
| TypeScript / ESLint on touched desks | PASS | Local + CI |
| Sanitize unit (img/table allowlist) | PASS | `tests/unit/sanitize-html.test.ts` |
| Blog schedule visibility unit | PASS | `tests/unit/reels-reviews-blog.test.ts` |
| Isolated Supabase write E2E | BLOCKED | Requires owner-provided isolated env; production Supabase must not be mutated |
| Owner-session browser QA | BLOCKED | Live admin role-gated; needs authorized merchant session |
| Nontechnical human usability study | NOT TESTED | Marked pending per mandate when participants unavailable |
| System-wide responsive F matrix (all viewports) | NOT TESTED | Suite defined below; screenshots not yet captured this wave |
| System-wide 10/10 claim | FAIL | Explicitly withheld |

## Route gate matrix (summary)

| Area | Visual | Functional | Persist | Responsive | A11y | Usability | Prod smoke |
|---|---|---|---|---|---|---|---|
| Blog TipTap + media | PARTIAL | PARTIAL | NOT TESTED | NOT TESTED | PARTIAL | NOT TESTED | PENDING promote |
| Products desks | PARTIAL | PARTIAL | NOT TESTED | NOT TESTED | PARTIAL | NOT TESTED | PENDING |
| Orders / inquiries | PARTIAL | PARTIAL | NOT TESTED | NOT TESTED | PARTIAL | NOT TESTED | PENDING |
| Navigation / media / CMS | PARTIAL | PARTIAL | NOT TESTED | NOT TESTED | PARTIAL | NOT TESTED | PENDING |
| Reviews / reels | PARTIAL | PARTIAL | NOT TESTED | NOT TESTED | PARTIAL | NOT TESTED | PENDING |
| Settings / staff / SEO / analytics / activity / backups | PARTIAL | PARTIAL | NOT TESTED | NOT TESTED | PARTIAL | NOT TESTED | PENDING |

## Merchant task suite (16)

| # | Task | Automated | Browser (isolated) | Human |
|---|---|---|---|---|
| 1 | Blog post + uploaded cover | PARTIAL (API exists) | NOT TESTED | NOT TESTED |
| 2 | Publish visibility | PARTIAL (unit schedule) | NOT TESTED | NOT TESTED |
| 3 | Edit + restore revision | NOT TESTED | NOT TESTED | NOT TESTED |
| 4 | Find product title/SKU | NOT TESTED | NOT TESTED | NOT TESTED |
| 5 | Add laptop specs/variants | NOT TESTED | NOT TESTED | NOT TESTED |
| 6 | Change price | NOT TESTED | NOT TESTED | NOT TESTED |
| 7 | Assign collection | NOT TESTED | NOT TESTED | NOT TESTED |
| 8 | Manage product media | PARTIAL (upload API) | NOT TESTED | NOT TESTED |
| 9 | Find COD order | NOT TESTED | NOT TESTED | NOT TESTED |
| 10 | Valid status transition | NOT TESTED | NOT TESTED | NOT TESTED |
| 11 | Shipping setting change | NOT TESTED | NOT TESTED | NOT TESTED |
| 12 | Navigation reorder | NOT TESTED | NOT TESTED | NOT TESTED |
| 13 | Featured badge | NOT TESTED | NOT TESTED | NOT TESTED |
| 14 | Edit informational page | NOT TESTED | NOT TESTED | NOT TESTED |
| 15 | Invite/deactivate staff | NOT TESTED | NOT TESTED | NOT TESTED |
| 16 | Read COD readiness warnings | PARTIAL (UI shipped #30) | NOT TESTED | NOT TESTED |

## External-only blockers (not code)

1. Isolated Supabase credentials for write E2E.
2. Authorized owner/admin browser session for production read-only smoke of new desks.
3. Third-party reel video assets (content dependency).

## Next engineering slices

1. Isolated Playwright merchant workflows for Blog TipTap save/reload, product create, order status (no prod writes).
2. Capture responsive screenshots at 320–1920 for inventory routes; fix overflow defects found.
3. Close remaining `--lh-*` token bleed on catalog/export surfaces during F.
