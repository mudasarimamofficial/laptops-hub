# Homepage LCP root-cause isolation (2026-11-23)

**Production unchanged.** Diagnostic work on branch `diag/lcp-isolation-2026-11-23` only.  
No speculative production PR.

## 1. Diagnostic timeline correction

| Artifact | Timestamp (UTC) | Validity |
|---|---|---|
| `lcp-diag.json` | 2026-11-23 **16:40** | **Historical / pre-fix** — before PR #59 (~17:04) and #60 (~17:13) |
| `lcp-diag-post-pr60.json` | after #60/#61 deploy | **Current production baseline** |
| Production commit under test | `6fe4f3d` | docs merge; perf code from `379e71a` (PR #60) |
| Production deployment | `dpl_jhGSuJihQU3S19Vj7q9hWaosXd44` | READY on `www.laptopshub.pk` |
| Browser | Chrome `157.0.8103.80` via Playwright `channel: "chrome"` | Pixel 7, cold context, 5–5.5s observe |

### Current production baseline (matched harness, ×3)

| Route | FCP median | LCP | Notes |
|---|---:|---|---|
| `/` | ~3.4s (spread 3.2–5.6s) | **null / 0 candidates** | `stage-960.webp` selected |
| PDP | ~2.3s | **IMG ~2.3s** | control |
| Collection | ~2.1s | **IMG ~2.1s** | control |

Homepage `NO_LCP` **reproduced on current code**, not only on the outdated 16:40 file.

## 2. Experiment matrix (local `next start`, same Chrome/Pixel 7)

Lab routes (noindex): `/diag/lcp-lab*`, `/diag/lcp-lab-real-hero`, `/diag/lcp-lab-hero-in-chrome`, `/diag/lcp-lab-home?only=…`  
Evidence: `docs/visual-evidence/p0-perf-2026-11-23/lcp-matrix.json`, `lcp-section-bisect.json`, `lcp-chrome-interaction.json`, `lcp-dom-compare.json`.

| Mode | Condition | LCP result (×3) | First break? |
|---|---|---|---|
| A–F shells | Progressive hero flags in minimal layout | *(early runs invalid: private `_` folder / 500)* | — |
| **chrome-A** | Storefront chrome + static H1/img | **3/3 H1** | Pass |
| **real-hero-no-chrome** | Production `CinematicHero` alone, no header/footer | **3/3 IMG** (Dell cutout) | Pass |
| **hero-in-chrome** | Same `CinematicHero` under storefront chrome | **3/3** but candidate is **`.v5-hero-ghost` DIV** | Partial / wrong candidate |
| **hero-only via HomePageView** | Chrome + `HomePageView` with only `v5_cinematic_hero` | **0/3** | **Breaks here** |
| hero + each section | Pairwise with HomePageView | mostly **0/3** (rare DIV) | Still broken |
| **G full `/`** | Production homepage composition | **0/3** | Fail |

### Controlled CSS hide of `.v5-hero-ghost`

On **hero-in-chrome**, hiding the ghost before paint changed LCP from ghost DIV → **IMG** (proven once in focused A/B).  
On **full `/` and HomePageView hero-only**, hiding the ghost **did not** restore LCP (still 0/3).

So: ghost is a **real LCP thief** under chrome+hero, but **not a sufficient explanation** for production homepage `NO_LCP`.

## 3. Exact root cause (what is proven vs open)

### Proven

1. Homepage lab `NO_LCP` is **not** explained by missing FCP, hidden document, or headless-only quirks (page `visibilityState=visible`; collection/PDP LCP OK).
2. **CinematicHero effect flags alone do not cause `NO_LCP`** — hero outside storefront chrome reports stable IMG LCP.
3. **Storefront chrome alone does not cause `NO_LCP`** — static Mode A under chrome reports H1 LCP.
4. The decorative **`.v5-hero-ghost` “HUB” stroked text** (`color:transparent` + large font + parallax transform) is selected as LCP under chrome+hero (element identified via PerformanceObserver).
5. **`HomePageView` composition path** (even with only the hero section enabled) yields **empty LCP**, unlike rendering the same `CinematicHero` directly under chrome.

### Not yet isolated (remaining hypothesis)

The additional factor that clears **all** candidates on the HomePageView / full homepage path. Leading hypotheses (ordered):

1. Heavier RSC data waterfall + late streaming of hero relative to chrome hydration (HomePageView always loads catalog/testimonials/reels/social/campaign even when sections are filtered off in the lab).
2. Continued invalidation from parallax/`--hp` updates and other client islands after a wrong or transient candidate.
3. Interaction of multiple above-fold paint sources (header, promo, hero layers) unique to the homepage flight.

**Not claimed:** a single CSS property “smoking gun” that fully explains production `NO_LCP`.  
**Not shipped:** ghost removal / redesign as a production “fix,” because it does not restore measurable homepage LCP by itself.

### Minimal reproduction

1. Chrome stable, Pixel 7 emulation, cold context.  
2. `CinematicHero` only at `/diag/lcp-lab-real-hero` → LCP IMG.  
3. Same hero under storefront at `/diag/lcp-lab-hero-in-chrome` → LCP `.v5-hero-ghost`.  
4. `/` or `/diag/lcp-lab-home?only=v5_cinematic_hero` → LCP empty.  
5. `/collections/laptops` → LCP IMG (control).

## 4. PDP profiling (matched note)

Production LH mobile (DevTools throttle, Lighthouse 13.3) from prior post-#60 pass: score **0.44**, LCP **4.8s**, TBT **1,630ms**, CLS **0.001**, TTFB **~560ms**.

Unthrottled Playwright resource profile (`pdp-profile.json`): largest JS responses ~259KB / 230KB / 160KB / 108KB chunks; TTFB ~250ms. Long-task API empty in that harness (instrumentation limit) — LH TBT remains the throttled CPU signal.

**No PDP code change shipped** without a measured module-level win under the same throttle. Highest-cost shared layout islands (cart drawer, compare tray, discount/badge providers) are candidates for a **future** deferred-hydration experiment, not this PR.

## 5. Keepalive schedule

| Check | Result |
|---|---|
| Workflow | `supabase-keepalive.yml` **active** on `main` since ~2026-11-23 09:57–11:06Z |
| Cron | `17 1,7,13,19 * * *` |
| Runs observed | **Only `workflow_dispatch`** (3 successes) |
| Expected `schedule` today | **13:17 UTC should have fired** after workflow was on `main` — **did not appear** |
| Next slot at report time | 19:17 UTC |
| Vercel cron | Independent daily `/api/cron/notifications` (keepalive-first) remains the primary layer |
| Free plan | **No indefinite uptime claim** |

Treat GitHub `schedule` reliability as **FAIL / unverified** until an Actions run with `"event":"schedule"` exists.

## 6. Release decision

| Criterion | Status |
|---|---|
| Reproducible root cause (full homepage empty LCP) | **Partial** — boundary proven; final mechanism open |
| Tested correction restoring homepage LCP | **No** |
| Production PR | **Not created** |
| Production deploy | **Unchanged** (`6fe4f3d` / `dpl_jhGSu…`) |

Diagnostic lab code stays on the isolation branch for continued binary search. It must not merge with `FORCE_OPEN` lab gating.

## 7. Pass/fail matrix

| Item | Result |
|---|---|
| Timeline correction (16:40 file historical) | **PASS** |
| Current-prod homepage `NO_LCP` reproduced | **PASS** (fail metric confirmed) |
| Hero-only effects as sole cause | **FAIL** (disproven) |
| Ghost as LCP thief under chrome+hero | **PASS** (identified) |
| Ghost hide restores full homepage LCP | **FAIL** |
| Full homepage root cause closed | **FAIL / unresolved** |
| PDP TBT/LCP fixed | **FAIL** (profiled only) |
| GitHub `schedule` keepalive observed | **FAIL** (pending/missed) |
| Speculative production patch | **Not done** (correct) |

## Remaining blockers

1. Finish isolation of HomePageView-only `NO_LCP` (data waterfall / streaming / hydration).  
2. Only then implement the smallest V5-safe fix and re-run ×3 matched tests.  
3. Observe first GitHub Actions `event=schedule` keepalive (or fix workflow/permissions if slots keep skipping).  
4. Separate PDP main-thread reduction under identical LH throttle.
