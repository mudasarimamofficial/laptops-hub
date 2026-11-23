# P0 performance diagnostics + keepalive closure (2026-11-23)

Branch: `fix/p0-perf-lcp-keepalive-2026-11-23`  
Baseline production: `5a2705b` / `dpl_D646LaAdwBMYV9mcyZFQFXrj2Nv1`

## Root cause — homepage `NO_LCP`

### Evidence (Chrome stable via Playwright `channel: "chrome"`, headed + headless)

| Page | FCP | `largestContentfulPaint::Candidate` | PerformanceObserver LCP |
|---|---|---|---|
| Homepage `/` (production + local after fixes) | yes (~1.4–2.9s lab) | **none** | **empty** |
| PDP | yes | **yes** (IMG) | yes |
| Collection | yes | yes | yes |

CDP traces (`docs/visual-evidence/p0-perf-2026-11-23/lcp-trace-compare.json`, `lcp-local-trace-after.json`):

- Homepage emits `firstContentfulPaint` / `GlobalFirstContentfulPaint` but **zero** `largestContentfulPaint::Candidate`.
- Homepage emits repeated `NavStartToLargestContentfulPaint::Invalidate` **after** FCP (candidates cleared / never recorded).
- Production homepage also showed ~274 compositor frame submits during measurement (heavy motion).
- PDP emits `largestContentfulPaint::Candidate` for the gallery `IMG` (`isAnimated: false`).
- After shipping LCP-stability changes, local retests still showed **empty LCP** on `/` while collection/PDP retained numeric LCP — so opacity/rAF contention alone does **not** fully explain the defect.

### Contributing factors addressed (real speed + candidacy hygiene)

1. Hero intro listed `opacity` in transition lists while opacity stayed at `1` (animated flag risk).
2. Three hero images used `fetchPriority="high"` (priority contention).
3. Parallax `requestAnimationFrame` ran from mount during the LCP quiet window.
4. Decorative `/v5/stage.webp` (1800px / 126KB) competed above the fold.
5. Product-story + Chromebook scroll rAF armed immediately on mount.
6. Main cutout used `filter: drop-shadow` on the LCP `<img>`; moved to wrapper `box-shadow`.
7. Mix-blend / calc `--hp` transforms on LCP ancestors deferred until intro completes.

### Unresolved diagnostic limitation

Chromium still does not emit an LCP candidate for the homepage despite visible H1 (`opacity:1`, `transform:none`) and a complete main hero `<img>` (`fetchPriority=high`, no filter). FCP fires; post-FCP `Invalidate` events continue. This is **not** dismissed as “headless only” (reproduced headed). Field CrUX may still record LCP; lab certification for homepage LCP remains **FAIL / unresolved** until a Candidate appears in trace. No fake LCP nodes were injected.

## Fixes shipped

| Change | File(s) |
|---|---|
| Remove opacity transitions; H1 + main laptop resting transform; single `fetchPriority=high`; sides `low` | `cinematic-hero.tsx` |
| Responsive stage derivatives 640/960 (+ keep 1800); `loading=lazy` `fetchPriority=low` | `public/v5/stage-*.webp`, hero |
| Defer hero parallax until intro done | `cinematic-hero.tsx` |
| Defer story + chromebook rAF until near viewport | `product-story.tsx`, `home-client.tsx` |
| Dynamic `InquiryDialog` on PDP (cut unused inquiry JS from critical path) | `product-detail.tsx` |
| Keepalive before/independent of outbox; 207 if outbox fails | `notifications/route.ts`, `notifications-run.ts` |
| Regression unit test for keepalive ordering | `tests/unit/cron-notifications-keepalive.test.ts` |

## Keepalive reliability

- Vercel Cron `/api/cron/notifications` `0 6 * * *` — previously verified `touch_keepalive` via `last_source=vercel-notifications-cron`.
- Outbox failures no longer skip keepalive.
- GitHub `supabase-keepalive` schedule: workflow **active**; as of this pass runs remain `workflow_dispatch` only until the next UTC `:17` slot fires (`PENDING` for first `event:schedule`).
- Free-plan uptime is **not** guaranteed.

## Measurement protocol (post-deploy)

Browser: Chrome stable. Lighthouse 12.4+. Cold loads ×3 median for `/`, collection, PDP, search. Record LCP/FCP/CLS/TBT/bytes. Do not claim 90+ without numeric scores.

Evidence folder: `docs/visual-evidence/p0-perf-2026-11-23/` + prior `final-acceptance-2026-11-23/`.
