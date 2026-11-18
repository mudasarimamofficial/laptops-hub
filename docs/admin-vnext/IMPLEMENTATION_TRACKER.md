# Admin VNext — implementation tracker

**Production main (at last tracker sync):** `6e683fa` (Reviews/Reels #32)  
**Prior TipTap:** `4a6b44e` (#31) · **Prior E:** `857a8b8` (#30) · **Prior D2:** `19998d8` (#29)  
**Prod deploy READY:** `dpl_GbnaeHReBLurhw4MtFSckJRDxhqw` (`6e683fa`)  
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
| E Settings/ops | [#30](https://github.com/mudasarimamofficial/laptops-hub/pull/30) | `857a8b8` | verify after promote | Settings hub IA, staff, SEO honesty, activity labels, backups copy |
| A2 TipTap RTE | [#31](https://github.com/mudasarimamofficial/laptops-hub/pull/31) | `4a6b44e` | verify after promote | TipTap editor; safe img/table/hr sanitizer |
| D3 Reviews/Reels | [#32](https://github.com/mudasarimamofficial/laptops-hub/pull/32) | `6e683fa` | verify after promote | Reviews Admin VNext desk; reel poster media picker |
| F Acceptance baseline | *docs branch* | — | — | Honest route/acceptance matrices; no false 10/10 |

## Module gate matrix

| Module | Implemented | Deployed | Browser QA | Responsive | A11y | Accepted |
|---|---|---|---|---|---|---|
| Blog list/editor | YES | YES | PENDING | PENDING | PARTIAL | NO |
| Blog RTE (TipTap) | YES (#31) | PENDING promote | PENDING | PENDING | PARTIAL | NO |
| Blog media upload | YES (cover + inline TipTap upload) | PENDING promote | PENDING | — | — | NO |
| Blog schedule/revisions | YES | YES | PENDING | — | — | NO |
| Products create/edit layout | YES | YES | PENDING | PENDING | PARTIAL | NO |
| Products full catalog flow | PARTIAL | YES | PENDING | PENDING | PENDING | NO |
| Orders/inquiries desks | YES | YES | PENDING | PENDING | PARTIAL | NO |
| CMS pages desk | YES | YES | PENDING | PENDING | PARTIAL | NO |
| Navigation | YES (#29) | YES | PENDING | PENDING | PARTIAL | NO |
| Merchandising | PARTIAL (IA links) | YES | PENDING | PENDING | PARTIAL | NO |
| Online store customize | PARTIAL (tokens/links) | YES | PENDING | PENDING | PARTIAL | NO |
| Media library + upload | YES (#29) | YES | PENDING | PENDING | PARTIAL | NO |
| Reviews / Reels | YES (#32) | PENDING promote | PENDING | PENDING | PARTIAL | NO |
| Settings / staff / analytics / SEO / activity / backups | YES (#30) | PENDING promote | PENDING | PENDING | PARTIAL | NO |
| System-wide F matrix | PARTIAL (docs baseline) | — | NOT TESTED | NOT TESTED | — | NO |

## Active work

1. ~~Merge #29–#32.~~
2. Isolated Blog/Product/Order Playwright (blocked without isolated Supabase).
3. Capture viewport screenshots + fix overflow; close remaining `--lh-*` bleed.
4. **Do not claim system-wide completion** until `ACCEPTANCE_MATRIX.md` gates flip with evidence.
