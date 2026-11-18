# Admin VNext — implementation tracker

**Production main:** `58572f6e1be1536f29532b66ecb92ed756e7a193`  
**Verified production deploy:** `dpl_B6a75f81JJ7rD4Z6xX25NtQEmpDT`  
**Shopify benchmark:** `laptopshub-2`  
**Updated:** 2026-11-18

Status keys (independent gates):  
`IMPLEMENTED` · `DEPLOYED` · `BROWSER_QA` · `RESPONSIVE` · `A11Y` · `ACCEPTED`

## Release ledger

| Release | PR | Merge SHA | Prod deploy | Scope |
|---|---|---|---|---|
| A Blog foundations | [#25](https://github.com/mudasarimamofficial/laptops-hub/pull/25) | `678eac9` | `dpl_8ExYzdCyTiTEZ1nYqp8NFN1wxZsZ` | Editor layout, schedule RLS, media picker (URL/library) |
| B Products batch 1 | [#26](https://github.com/mudasarimamofficial/laptops-hub/pull/26) | `f479153` | `dpl_Asu3m96LQcShMsC8FqRPCBkznA4F` | Create/edit desks + catalog tokens |
| C Orders/inquiries | [#27](https://github.com/mudasarimamofficial/laptops-hub/pull/27) | `c789b51` | (via main) | Order detail off lh-container |
| D CMS partial | [#28](https://github.com/mudasarimamofficial/laptops-hub/pull/28) | `58572f6` | `dpl_B6a75f81JJ7rD4Z6xX25NtQEmpDT` | Content desk tokens |
| D2 Nav/Merch/Media | *this branch* | — | — | CMS upload bucket, nav fix, online-store links |

## Module gate matrix

| Module | Implemented | Deployed | Browser QA | Responsive | A11y | Accepted |
|---|---|---|---|---|---|---|
| Blog list/editor | YES | YES | PENDING | PENDING | PARTIAL | NO |
| Blog RTE (`execCommand`) | YES (fragile) | YES | PENDING | — | PARTIAL | NO — engine gap |
| Blog media upload | YES (API+picker; browser QA pending) | PENDING | PENDING | — | — | NO |
| Blog schedule/revisions | YES | YES | PENDING | — | — | NO |
| Products create/edit layout | YES | YES | PENDING | PENDING | PARTIAL | NO |
| Products full catalog flow | PARTIAL | YES | PENDING | PENDING | PENDING | NO |
| Orders/inquiries desks | YES | YES | PENDING | PENDING | PARTIAL | NO |
| CMS pages desk | YES | YES | PENDING | PENDING | PARTIAL | NO |
| Navigation | YES (is_published→status fix, save bar) | PENDING | PENDING | PENDING | PARTIAL | NO |
| Merchandising | PARTIAL (IA links) | YES | PENDING | PENDING | PARTIAL | NO |
| Online store customize | PARTIAL (tokens/links) | YES | PENDING | PENDING | PARTIAL | NO |
| Media library + upload | YES (cms-media bucket+upload) | PENDING | PENDING | PENDING | PARTIAL | NO |
| Reviews/reels | PARTIAL tokens | YES | PENDING | PENDING | PENDING | NO |
| Settings/staff/analytics | PENDING (E) | — | — | — | — | NO |
| System-wide F matrix | PENDING | — | — | — | — | NO |

## Active work

Branch: `feat/admin-vnext-release-d2-finish`

1. Reconcile tracker (this file).
2. Finish Release D: navigation UX, merchandising clarity, online-store tokens, **cms-media upload**.
3. Then Release E → A engine/upload E2E → B/C flow QA → F matrix.
