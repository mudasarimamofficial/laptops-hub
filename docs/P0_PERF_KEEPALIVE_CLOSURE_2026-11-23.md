# P0 performance diagnostics + keepalive closure (2026-11-23)

Production after PR #60: commit `379e71a` / deployment `dpl_5TzXUuuy3anhd5RjJj2Rhzy8nu36` / `www.laptopshub.pk`  
Baseline (pre-P0): `5a2705b` / `dpl_D646LaAdwBMYV9mcyZFQFXrj2Nv1`  
Interim (PR #59): `e373ef1` / `dpl_EXe6WgabpxTN8PVMNvyWeCVyAHLL`

Browser: Chrome stable `157.0.8103.80` via Playwright `channel: "chrome"`. Lighthouse `13.3.0`, mobile + DevTools throttling.

## Root cause — homepage `NO_LCP`

### Evidence

| Page | FCP | `largestContentfulPaint::Candidate` | PerformanceObserver LCP |
|---|---|---|---|
| Homepage `/` (prod after #59 and #60) | yes (median ~2.7s cold Playwright) | **none** | **empty / null** |
| PDP | yes | **yes** (IMG) | yes (~2.0s cold) |
| Collection / search / cart | yes | yes | yes |

CDP / lab notes (`docs/visual-evidence/p0-perf-2026-11-23/`):

- Homepage emits FCP but **zero** `largestContentfulPaint::Candidate` events.
- Repeated `NavStartToLargestContentfulPaint::Invalidate` after FCP.
- Reproduced headed and headless — not dismissed as headless-only.
- Collection/PDP/search/cart emit normal IMG/DIV LCP candidates under the same harness.
- Lighthouse homepage: `LanternError: NO_LCP` → performance score `null`; displayed LCP `33.3s` is a lantern fallback, **not** a real metric.

### Contributing factors addressed (real speed + candidacy hygiene)

1. Hero intro listed `opacity` in transitions while opacity stayed at `1` (animated-flag risk).
2. Three hero images used `fetchPriority="high"` (priority contention).
3. Parallax `requestAnimationFrame` ran from mount during the LCP quiet window.
4. Decorative `/v5/stage.webp` (1800px / 126KB) competed above the fold; high-DPR still selected it after #59.
5. Product-story + Chromebook scroll rAF armed immediately on mount.
6. Main cutout used `filter: drop-shadow` on the LCP `<img>`; moved to wrapper `box-shadow`.
7. Mix-blend / calc `--hp` transforms on LCP ancestors deferred until intro completes.
8. **PR #60:** stage `srcSet` capped at `960w` so Pixel-class DPR no longer picks `stage.webp`.

### Unresolved diagnostic limitation

Chromium still does not emit an LCP candidate for the homepage despite visible H1 (`opacity:1`, `transform:none`) and a complete main hero `<img>` (`fetchPriority=high`, filter-free). FCP fires; post-FCP Invalidates continue. Field CrUX may still record LCP; **lab homepage LCP remains FAIL / unresolved**. No fake LCP nodes were injected. Do **not** treat Lighthouse homepage score as PASS.

## Fixes shipped

| Change | PR | File(s) |
|---|---|---|
| Remove opacity transitions; H1 + main laptop resting transform; single `fetchPriority=high`; sides `low` | #59 | `cinematic-hero.tsx` |
| Responsive stage derivatives 640/960; `loading=lazy` `fetchPriority=low` | #59 | `public/v5/stage-*.webp`, hero |
| Cap stage srcset at 960w (stop high-DPR selecting 1800px/126KB) | #60 | `cinematic-hero.tsx` |
| Defer hero parallax until intro done | #59 | `cinematic-hero.tsx` |
| Defer story + chromebook rAF until near viewport | #59 | `product-story.tsx`, `home-client.tsx` |
| Dynamic `InquiryDialog` on PDP | #59 | `product-detail.tsx` |
| Keepalive before/independent of outbox; 207 if outbox fails | #59 | `notifications/route.ts`, `notifications-run.ts` |
| Regression unit test for keepalive ordering | #59 | `tests/unit/cron-notifications-keepalive.test.ts` |
| Acceptance report on `main` | #59 | `docs/FINAL_POST_RELEASE_ACCEPTANCE_2026-11-23.md` |

## Post-deploy measurements (PR #60)

Evidence: `docs/visual-evidence/p0-perf-2026-11-23/prod-after-pr60.json`, `lh-home-after-pr60.json`, `lh-pdp-after-pr60.json`.

### Stage image selection (PASS)

Pixel 7 cold loads ×3: `currentSrc` = `/v5/stage-960.webp` (not `stage.webp`).  
Derivatives: `stage-640.webp` 13.4KB / 640×185; `stage-960.webp` 24.8KB / 960×277; original `stage.webp` 126KB / 1800×520.

### Homepage cold Playwright (×3)

| Run | FCP ms | LCP | Image bytes |
|---|---:|---|---:|
| home-1 | 3944 | **null** | 628 355 |
| home-2 | 2748 | **null** | 628 355 |
| home-3 | 2412 | **null** | 628 355 |
| **median** | **~2748** | **null** | **628 355** |

vs PR #59 probe (`prod-after-pr59.json`): image bytes **729 817 → 628 355** (−101 KB ≈ stage 126KB→25KB). LCP still null.

### Other routes (single cold Playwright, Pixel 7)

| Route | FCP ms | LCP ms | Image bytes |
|---|---:|---:|---:|
| PDP | 1976 | 1976 (IMG) | 31 606 |
| Collection | 1768 | 1784 (IMG) | 53 632 |
| Search | 2084 | 2116 (IMG) | 83 918 |
| Cart | 1872 | 1872 (DIV) | 3 096 |

### Lighthouse mobile (DevTools throttle) — honest lab

| Page | Perf score | LCP | FCP | TBT | CLS | TTFB | Total bytes |
|---|---|---|---|---|---|---|---|
| Home | **null** (`NO_LCP`) | lantern fallback 33.3s (invalid) | 10.8s | NO_TTI | 0.006 | 560 ms | 990 KiB |
| PDP | **0.44** | 4.8s | 4.8s | 1 630 ms | 0.001 | 560 ms | 524 KiB |

PDP Lighthouse after #59 was score 0.38 / LCP 5.6s / TBT 1740 ms — small movement only; **not** claimed as a customer-speed win. Unthrottled Playwright PDP LCP ~2.0s.

### CLS

No regression (home 0.006, PDP 0.001 in LH; prior CLS 0 in acceptance).

## Keepalive reliability

- Vercel Cron `/api/cron/notifications` `0 6 * * *` — keepalive runs **first**, independent of outbox; unit-tested; 207 if outbox fails.
- GitHub `supabase-keepalive` workflow **active**, cron `17 1,7,13,19 * * *`.
- As of 2026-11-23 ~17:20 UTC, Actions history still shows **`workflow_dispatch` only** — first `event:schedule` **not yet observed** (next expected slot 19:17 UTC). Manual dispatch previously succeeded.
- Free-plan uptime is **not** guaranteed.

## Pass / fail matrix

| Item | Result |
|---|---|
| Homepage lab numeric LCP | **FAIL** (`NO_LCP` / null) |
| Homepage image byte reduction (stage) | **PASS** (~101 KB after #60) |
| Stage high-DPR selects ≤960w | **PASS** |
| PDP / collection / search / cart numeric LCP (Playwright) | **PASS** |
| PDP Lighthouse ≤2.5s LCP | **FAIL** (4.8s throttled) |
| PDP TBT substantially improved (LH) | **FAIL** / marginal |
| CLS regression | **PASS** (none) |
| Keepalive decoupled from outbox | **PASS** |
| Vercel cron auth + touch path | **PASS** (prior + unit) |
| GitHub `schedule` keepalive observed | **PENDING** |
| Fake LCP / score gaming | **PASS** (not done) |
| V5 appearance preserved | **PASS** |
| Acceptance doc on `main` | **PASS** |

## Remaining blockers

1. Homepage Chromium LCP candidacy (lab) — unresolved; needs Candidate events before claiming LCP PASS.
2. PDP main-thread / TBT under LH throttle still high — further cuts need separate JS profiling without gutting V5.
3. First GitHub Actions `schedule` keepalive run — await UTC cron slot; Free Supabase pause risk remains.
4. External/business: live COD not exercised; Free-plan DB pause not eliminated by keepalive alone.
