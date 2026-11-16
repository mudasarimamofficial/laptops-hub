# Laptops HUB — Engineering Closeout (2026-11-16)

Branch `feat/merchant-operating-system` · local commits only (not pushed, not merged, not deployed) · production
Supabase `xvmmjkrkgznnakcobmww` and Vercel untouched. Companion docs: `LAPTOPS_HUB_REQUIREMENTS_TRACEABILITY.md`,
`LAPTOPS_HUB_STAGING_SECURITY_REPORT.md`, `LAPTOPS_HUB_MIGRATION_COMPATIBILITY_MATRIX.md`,
`LAPTOPS_HUB_BACKUP_RESTORE_RUNBOOK.md`, `LAPTOPS_HUB_CLIENT_ACCEPTANCE_CHECKLIST.md`,
`LAPTOPS_HUB_FINAL_RELEASE_MANIFEST.md`, `IDE_AI_HANDOFF_CURRENT.md`.

## Final classification

**2. ENGINEERING VERIFIED LOCALLY — STAGING BLOCKED.**

Every engineering acceptance check passes on the local isolated stack against the final source. Final run: all 25
suites exit 0. Staging cannot be certified because no staging environment exists, and creating one needs the owner's
approval. Production was not touched. Classes 3 and 4 are therefore not claimed.

## A. Forensic audit of the previous session's claims

| Claim / state found | Verified? | Finding |
|---|---|---|
| Uncommitted variant picker, migration 140000, staff rewrite, test edits | Recovered | Committed as `cf08f2f` (marked UNVERIFIED) after a full backup ref; nothing discarded |
| "Grants contradiction resolved" | **No** | The PDP 500 (42501 on `option_names`/`position`/`media_id`) had been "fixed" with a manual broad `GRANT SELECT` on the local DB that re-exposed internal columns and was not in any migration. Replaced by explicit migration 27 + 28; reproducible from a fresh reset |
| Staff invitation "second invite fails" | Root cause differs | The previous run's log stops at test 54 with 2–5 s failures — the app server died mid-run; the staff failure there is not attributable to staff code. The client-side rewrite was unnecessary (original code passes; rewrite reverted). Repeated cross-browser runs did expose a **real** defect: an address typed before hydration stayed visible while "Send invitation" stayed disabled — fixed and regression-tested. Also proven: reload persistence and duplicate / invalid / rate-limited failure states |
| Social proof "fixed" | **No** | Exact assertions had been weakened earlier, then the zero-orders test was skipped, then other suites' delivered orders were rewritten to `shipped` and back. Replaced by a deterministic baseline (seed clears local test orders, the 36-step suite deletes its orders, enforced precondition) |
| Cross-browser failures fixed | Partly | Timeouts had been raised and a `NS_BINDING_ABORTED` retry added. The retry is removed; root cause was navigating during an in-flight `router.refresh()`; the test now waits for refreshed server data. Cross-browser 105/105 |
| Catalog pagination PASS | **No** | One assertion was `… \|\| true` (always passes); seeding was skipped silently on errors; the reported PASS had rc=127 (libuv crash at exit) and the runner's comment excused non-zero exit codes. Rewritten (always-seeded 105-product dataset, storefront Load-more verified page by page); libuv crash fixed by closing fetch keep-alive sockets; runner verdict = exit code |
| Security suites | Were failing | P0 probe 7/9 and auth matrix 23/24 in the previous summary; now 9/9 and 24/24 |

## B. What changed in this session (commits `4ab0708`, `9da69bb`, and the final checkpoint)

1. **Security (High, pre-existing, also in production):** staff direct Data API write escalation closed (migration 28);
   media rights metadata hidden; raw DB errors removed from the COD route and admin order list; admin search terms can no
   longer alter PostgREST filters. Evidence: direct-access 193/193.
2. **Variants end to end:** per-variant availability (boolean RPC), accessible picker (options/list modes, sold-out and
   unavailable states, keyboard), "Choose options" + "From Rs …" on cards/compare/home, exact variant in cart → quote →
   order item → ledger → cancel restock; quote and order use the same stock rules.
3. **Mandatory admin features that were missing:** global search (Ctrl/⌘ K, "/"), keyboard navigation, **sign-out**.
4. **Test integrity:** deterministic social proof; staff failure states + pre-hydration regression; Firefox retry removed;
   pagination rewritten; suite runner exit-code verdict; theme preview no longer depends on example.com; 36-step notice
   check in a fresh shopper session (per-session cap made it timing-dependent). Two further order-dependent failures
   found by repeated full runs and fixed at the cause, with traces as evidence: (a) the merchant smoke script left a
   one-section "Hero" homepage draft (pointing at a deleted smoke product) that every later suite opened in the theme
   editor — it now restores the previous draft and verifies it; (b) the social-proof "broken video" test waited without
   limit for a play button that the unavailable state correctly removes — it now accepts either order, same assertion.
   Failure traces are kept (`playwright.isolated.config.ts`, copied by the runner before the next Playwright run).
5. **Performance:** card photos request the displayed size from the image CDN (srcset); same rendering.
6. **Docs:** this file, traceability, security review, compatibility matrix rows 27–28, backup/restore runbook,
   acceptance checklist, release manifest, handbook additions, handoff file.

## C. Final verification run

Label `final-2026-11-16-d`, finished 2026-11-16T07:55:12Z, verdict **PASS** (0 failed suites of 25).
Source: commit `35da4b7` plus the uncommitted fixes that are committed in the final checkpoint (`dirty: true` in
the summary). After this run, only the runner's JSON escaping of result lines, the report generator and documents changed;
no app code or test changed. Fresh `supabase db reset --local`, then seed, then `next build`, then start, immediately before the run.

| Suite | rc | Seconds | Result line (from the log) |
|---|---|---|---|
| static-lint | 0 | 42 | ✖ 12 problems (0 errors, 12 warnings)   0 errors and 1 warning potentially fixable with the `--fix` option. |
| static-tsc | 0 | 6 |  |
| static-audit | 0 | 5 |  |
| unit | 0 | 36 | social-proof tests passed preview-read-only: 23 checks passed |
| sql-shipping-cod | 0 | 1 | PASS/zone mismatch refused/zone_mismatch TOTAL/37 passed/0 failed |
| sql-merchandising | 0 | 1 | PASS/withdrawing consent while named is refused/new row for relation 'reels' violates check constraint 'reels_creator_requires_consent' TOTA |
| sql-reels-reviews | 0 | 1 | PASS/too-short review body is refused/new row for relation 'product_reviews' violates check constraint 'product_reviews_body_check' TOTAL/17 |
| sec-p0-probe | 0 | 8 | PASS  order_token_rpc_returns_empty_for_unknown — rows=0 Passed 9/9 |
| sec-auth-matrix | 0 | 1 | PASS  public_catalog_readable — n=2 24/24 passed · wrote docs/SECURITY_AUTH_MATRIX_RESULTS.json |
| sec-role-matrix | 0 | 10 | PASS  anon_cod_api_401 — status=401 15/15 passed · wrote docs/SECURITY_ROLE_MATRIX_RESULTS.json |
| sec-role-http | 0 | 54 | PASS  editor cannot record collections — status=403 126/126 passed · docs/SECURITY_ROLE_HTTP_RESULTS.json |
| sec-direct-access | 0 | 15 | PASS  anon can still submit a contact inquiry (insert only) 193/193 passed · wrote docs/SECURITY_DIRECT_ACCESS_RESULTS.json |
| theme-rls | 0 | 10 | ok: plain draft forbidden   ok: actor spoof blocked |
| theme-publish | 0 | 2 |  |
| cod-concurrency | 0 | 3 | PASS  distinct_keys_no_over_collection — ok=5 over=11 {'amount_collected_paisa':1000000,'payment_status':'collected'} 16/16 passed · docs/CO |
| cod-checkout | 0 | 3 | PASS  http_contact_insert_as_anon — status=200 rows=1 32/32 passed · docs/COD_CHECKOUT_ISOLATED_RESULTS.json |
| inventory-orders | 0 | 9 | PASS  anon_cannot_write_or_read_ledger — permission denied for table inventory_ledger / permission denied for table inventory_ledger 22/22 p |
| inventory-ledger | 0 | 8 |  |
| settings-nav | 0 | 3 | ok: true, ALL TESTS IN test-settings-navigation-persistence.mjs PASSED! |
| merchant-smoke | 0 | 9 | === Result: 25 passed · 0 failed === |
| csv-commit | 0 | 10 | failed: 0   failed: 0 |
| catalog-pages | 0 | 93 | PASS  draft_pdp_is_404 — status=404 9/9 passed |
| e2e-isolated | 0 | 807 | ok  24 tests/e2e-isolated/launch-journey.spec.ts:208:7 › launch journeys (isolated) › notifications: provider outage → failed, staff retry → |
| e2e-legacy | 0 | 105 | 27 passed (1.7m) |
| e2e-crossbrowser | 0 | 335 | ok 104 [firefox-desktop] › tests/e2e-isolated/launch-journey.spec.ts:208:7 › launch journeys (isolated) › notifications: provider outage → f |

Totals in this run: isolated E2E **101/101**, legacy E2E **27/27**, cross-browser **105/105** (Chromium, WebKit, Firefox),
direct Data API security 193/193, role HTTP 126/126, auth 24/24, P0 probe 9/9, role 15/15, COD checkout 32/32, COD
concurrency 16/16, inventory 22/22, merchant smoke 25/25, catalog pagination 9/9, SQL matrices 37/37 · 15/15 · 17/17;
lint 0 errors (12 pre-existing warnings), tsc clean, `npm audit --omit=dev` clean. Per-test isolated results:
`docs/LAPTOPS_HUB_E2E_TEST_REPORT.json`.

**Full-run history (nothing hidden):** every earlier full run had exactly one failure, each traced to a cause and fixed:

| Run | Result | Cause | Fix |
|---|---|---|---|
| 1 | isolated 1 failed; legacy 2 failed | purchase notice capped per session; legacy card count ignored "Choose options"; theme preview loaded example.com | fresh shopper context; count all three card actions; local route for the preview image |
| 2 (`-b`) | isolated 1 failed (36-step theme editor) | not found at the time (passed alone) | traces kept on failure from then on |
| isolated only, traced | 1 failed (social-proof broken video) | unbounded click on a play button the unavailable state removes | accept either order, same assertion |
| 3 (`-c`) | isolated 1 failed (36-step theme editor) | trace: editor opened a one-section "Hero" draft left by `test-merchant-catalog-smoke.mjs` | smoke script restores and verifies the previous draft |
| 4 (`-d`) | **all 25 suites rc=0** | | |

No timeout was raised and no assertion was weakened for any of these.

## D. Performance (lab, local)

Card photos (the one performance change): cards now request the displayed width from the Shopify image CDN through
`srcset`/`sizes`, instead of the full original. Measured on the same image: **680 KB original → 436 KB at 800w → 139 KB
at 400w** (phones pick 400w), and 435 KB → 297 KB → 96 KB for a second one. Rendering is unchanged: same element,
`object-fit` and box. The V5 check in cross-browser passed 105/105.

Lighthouse lab run after the change (`docs/evidence/lighthouse-2026-11-16/`, Lighthouse 12.6.1, local build):

| Page | Mobile perf | Desktop perf | Accessibility (m/d) | Mobile LCP | Mobile TBT | CLS |
|---|---|---|---|---|---|---|
| Home | 59 | 84 | 100/100 | 5.3 s | 663 ms | 0 |
| Collection | 62 | 86 | 100/96 | 4.0 s | 1133 ms | 0 |
| Product | 66 | 97 | 100/100 | 3.9 s | 975 ms | 0 |

Every run exited 1 *after* writing its report. Cause: Windows EPERM while deleting Chrome's temporary profile folder.
Each report was checked: no runtime error, correct URL. Mobile runs warn that the CPU is slower than Lighthouse
expects.

These scores are **not comparable** with the earlier run (`docs/evidence/lighthouse/`: Lighthouse 13.3.0, different data
and load; e.g. home 88 desktop / 59 mobile), and no score improvement is claimed from them. Lighthouse still reports about
740 KB of possible savings on the home page from the **hero** images, which are not yet sized; that is an open item.

## E. Not done / not verified

- **Production:** no migration, permission, setting, deployment or order was touched. The 14 pending migrations (15–28)
  need the owner's written approval and a fresh backup. Migration 28 should be applied even if nothing else ships.
- **Staging:** none exists; certification is on the local isolated stack only (`LAPTOPS_HUB_STAGING_CERTIFICATION_REPORT.md`).
- Light/dark admin theme not built; product-list checkbox bulk selection not built (bulk editor exists); blog scheduled
  publish not built (optional in the contract).
- Staff pre-hydration fix re-verified in Chromium; WebKit not re-run on the staff spec after the fix (the cross-browser
  suite does not include the staff spec).
- Other controlled admin editors were not individually probed for pre-hydration typing.
- Owner inputs listed in `LAPTOPS_HUB_CLIENT_ACCEPTANCE_CHECKLIST.md` §B (fees, policies, stock counts, media rights,
  staff, email sender, approvals).

## F. Recommended next steps (each needs the owner's go-ahead)

1. Review and push the branch; open a PR against `main` (no merge without review).
2. Create a staging Supabase project + protected Vercel Preview; run `run-final-suite.sh` against it.
3. Back up production, then apply migrations 15–28 in order (runbook §2), starting with 28's security fix if approved alone.
4. Owner provides §B inputs; then merge, deploy, and finally activate COD.
