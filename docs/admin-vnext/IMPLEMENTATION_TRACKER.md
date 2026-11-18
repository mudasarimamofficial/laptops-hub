# Admin VNext — implementation tracker

**Production main (at last tracker sync):** `19998d8` (Release D2 via #29)  
**Prior production baseline cited in mandate:** `58572f6` / `dpl_B6a75f81JJ7rD4Z6xX25NtQEmpDT`  
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
| D2 Nav/Merch/Media | [#29](https://github.com/mudasarimamofficial/laptops-hub/pull/29) | `19998d8` | verify after promote | CMS upload bucket, nav status fix, online-store links |
| E Settings/ops | *this branch* | — | — | Settings hub IA, staff, analytics, SEO honesty, activity labels, backups copy |

## Module gate matrix

| Module | Implemented | Deployed | Browser QA | Responsive | A11y | Accepted |
|---|---|---|---|---|---|---|
| Blog list/editor | YES | YES | PENDING | PENDING | PARTIAL | NO |
| Blog RTE (`execCommand`) | YES (fragile) | YES | PENDING | — | PARTIAL | NO — engine gap |
| Blog media upload | YES (API+picker; browser QA pending) | YES (#29) | PENDING | — | — | NO |
| Blog schedule/revisions | YES | YES | PENDING | — | — | NO |
| Products create/edit layout | YES | YES | PENDING | PENDING | PARTIAL | NO |
| Products full catalog flow | PARTIAL | YES | PENDING | PENDING | PENDING | NO |
| Orders/inquiries desks | YES | YES | PENDING | PENDING | PARTIAL | NO |
| CMS pages desk | YES | YES | PENDING | PENDING | PARTIAL | NO |
| Navigation | YES (#29 status+save bar) | YES (#29) | PENDING | PENDING | PARTIAL | NO |
| Merchandising | PARTIAL (IA links) | YES | PENDING | PENDING | PARTIAL | NO |
| Online store customize | PARTIAL (tokens/links) | YES | PENDING | PENDING | PARTIAL | NO |
| Media library + upload | YES (#29 cms-media) | YES (#29) | PENDING | PENDING | PARTIAL | NO |
| Reviews/reels | PARTIAL tokens | YES | PENDING | PENDING | PENDING | NO |
| Settings hub IA | YES (E branch) | PENDING | PENDING | PENDING | PARTIAL | NO |
| Staff invite/roles | YES (E tokens + role cards) | PENDING | PENDING | PENDING | PARTIAL | NO |
| Analytics honesty | YES (E chips) | PENDING | PENDING | PENDING | PARTIAL | NO |
| SEO checklist honesty | YES (E) | PENDING | PENDING | PENDING | PARTIAL | NO |
| Activity human labels | YES (E) | PENDING | PENDING | PENDING | PARTIAL | NO |
| Backups CMS-only honesty | YES (E) | PENDING | PENDING | PENDING | PARTIAL | NO |
| System-wide F matrix | PENDING | — | — | — | — | NO |

## Active work

Branch: `feat/admin-vnext-release-e`

1. ~~Finish Release D2 (merged #29 / `19998d8`).~~
2. Release E: settings hub, staff, analytics, SEO, activity, backups honesty → PR.
3. Then Release A TipTap/Lexical + Blog E2E → B/C flow QA → F matrix.
