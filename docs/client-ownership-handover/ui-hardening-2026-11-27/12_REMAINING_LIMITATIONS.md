# 12 — Remaining limitations and owner decisions

## Engineering limitations (honest scope of this pass)

| # | Item | Why it remains | Risk |
|---|---|---|---|
| L1 | Mobile LCP is ~4.6 s in lab Lighthouse (home/collection) | Not a target of this visual pass; no LCP code changed. Earlier perf work: `docs/visual-evidence/p0-perf-2026-11-23/` | Medium (SEO/UX); needs its own investigation with field data (Search Console CWV) |
| L2 | Lighthouse numbers are single lab runs on a developer machine | Time-boxed; run-to-run spread is several points | Read the before/after as "no regression", not as a gain |
| L3 | Browsers: Chromium, Firefox and WebKit via Playwright on Windows, with mobile emulation | No physical iPhone/Android in this environment. WebKit on Windows is close to Safari but not identical (e.g. iOS toolbar resizing, real touch scrolling) | Low–medium; a 5-minute check on the owner's own phone is recommended (`00` §Owner checks) |
| L4 | Production was checked read-only | By rule: no orders, no cart actions, no sign-in on production | Checkout/admin flows are proven on the isolated stack only (`07`, `08`, `10`) |
| L5 | WhatsApp computed corner radius reads `999px`, not `50%` | The existing inline pill radius wins over the class. On a 56×56 button any radius ≥ 28px draws the same circle | None visually; noted for accuracy |
| L6 | The mega-menu panel is up to 18px taller (458 vs 440 at 1366×768) | Needed so all nine groups fit | None; still capped by the window height |
| L7 | The Google Map iframe content is Google's | Only its frame, size and placement are controlled | None |
| L8 | The new filter rule (#111) has nothing to disable on production today | Every live filter option currently has products | None; covered by the isolated spec |
| L9 | The pinned map reveal still exists on large windows (≥ 761×700) | Intentional V5 effect, kept per the frozen design; made safe (lifted promo bar, opaque page/footer, symmetric lazy-load) | Low; covered by `ui-map-header-compositing` in three engines |
| L10 | Draft PR #62 (homepage LCP diagnosis, 2026-11-23) is still open and was **not merged** | It adds gated `/diag/lcp-lab*` experiment routes under `src/` and its own test plan says "do not merge until a proven fix". Lab Lighthouse on the isolated build now reports a homepage LCP (≈4.6 s mobile, see `09`), so the earlier `NO_LCP` symptom is not reproduced locally; production field data still needs checking in Search Console | Low; close or keep as reference by owner/engineer choice |
| L11 | Text typed into checkout **before** the page's JavaScript has loaded may still need retyping | HYD-001 fixed the case where hydration *failed* and wiped the form. Input typed before hydration starts is a general browser/React limit; the form already blocks submission until ready (`prehydration` spec) | Low |
| L12 | The full isolated suite runs on one machine with one worker (~1 h) | A test that navigates within 5 s can time out if the machine is busy; any such failure is re-run alone and reported, never counted as a pass | Low (test infrastructure) |
| L13 | Restoring a CMS backup does not delete a store setting that was created **after** the backup | By design, restore only upserts the settings the backup holds (conservative: it never deletes). Changing it would need a database migration and owner approval | Low; documented so nobody expects a restore to remove newer settings |

## Owner / business decisions (unchanged by this pass)

These are not engineering defects and were not acted on:
- **G14 compare-at prices:** proposal only. No compare-at prices were invented.
- **COD policy/configuration:** unchanged.
- **D19 repository visibility:** the repo is still public (`32` §7).
- **Owner walkthrough of 14 operations** (`32` §5) and **G19 UI check** (`26` §G19-10 step 8).
- **Theme controls for colour/typography:** conflict with the frozen V5 design (`32` §6).
- Any new production migration, DNS change, paid plan, ownership transfer, secret rotation or customer notification needs the owner's explicit approval.

**2026-11-28 update:**
- **L1:** re-measured with 3 runs per page (`35`). The collection discovery delay is fixed (PERF-001, #114), but LCP did not move: hydration and main-thread work is the remaining cause.
- **L10:** recommendation added in `35` §5.
- **L12:** a fresh full run is recorded in `33` §2.
