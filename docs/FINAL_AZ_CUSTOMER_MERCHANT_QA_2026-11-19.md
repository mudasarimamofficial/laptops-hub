# A–Z customer + merchant QA — 2026-11-19 (admin mobile matrix wave)

## Production / source
| Item | Value |
|---|---|
| Baseline SHA | `ccc371c` |
| Repo | `mudasarimamofficial/laptops-hub` |
| Supabase | `xvmmjkrkgznnakcobmww` |
| Vercel | `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` |
| Rollback READY | `dpl_CHuvw5gQNfYew2fRNd84fBD9jktC` @ `b48bdb7` (pre this wave) |

## Admin mobile matrix (isolated)
| Metric | Count |
|---|---|
| Admin page routes discovered | 38 (`page.tsx` under `src/app/(admin)/admin`) |
| Staff routes in matrix | 29 |
| Guest routes in matrix | 3 |
| Viewports | 9 |
| Matrix interactions recorded | see `docs/FINAL_AZ_ADMIN_MOBILE_MATRIX_RESULTS.json` |
| FAIL | 0 |

Evidence: `npx playwright test admin-mobile-matrix --config=playwright.isolated.config.ts`

## UX shipped
- Mobile cards for Products / Orders / Customers / Collections (≤639px)
- Filter bars stack full-width on small phones
- Prior shell work preserved (PR #52–#53)

## Customer / COD regression
- Mega menu + wordmark: **PASS**
- Variant COD journey: **PASS** (9/9)
- Launch journey: core COD + fulfillment **PASS**; one notification retry assertion flaked when fake-resend outage mode raced (not a mobile-admin defect)

## Remaining non-engineering gates
| Gate | Status |
|---|---|
| Live COD | **BLOCKED** |
| NVDA/VoiceOver | **NOT TESTED** |
| Reel product curation | **BUSINESS PENDING** |
| Owner fresh login confirmation | retain only if not yet confirmed by owner |

Preserved order `LH-261118-77C0F6`. Al Hafiz untouched.
