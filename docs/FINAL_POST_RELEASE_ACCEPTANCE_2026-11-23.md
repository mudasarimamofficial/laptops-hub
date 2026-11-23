# Laptops HUB — Final post-release acceptance (2026-11-23)

Production under test: `https://www.laptopshub.pk`  
Commit: `5a2705b147c968c85861e0507bbcbffcd8504168` (PR #58 merge)  
Deployment: `dpl_D646LaAdwBMYV9mcyZFQFXrj2Nv1` — **READY** (Production)  
Evidence: `docs/visual-evidence/final-acceptance-2026-11-23/`

Follow-up P0 pass (`fix/p0-perf-lcp-keepalive-2026-11-23`) ships keepalive decoupling, hero LCP-stability / image priority / stage derivatives, and deferred below-fold rAF. Homepage lab `NO_LCP` was still reproducible locally after those changes — see `docs/P0_PERF_KEEPALIVE_CLOSURE_2026-11-23.md`.

---

## Verdict summary

| Area | Result |
|---|---|
| Product naming | **PASS** |
| Price / 5% campaign | **PASS** |
| Vercel Cron → `touch_keepalive` | **PASS** |
| GitHub Actions `schedule` keepalive | **PENDING** (workflow active; only `workflow_dispatch` runs so far) |
| Homepage Lighthouse performance score / LCP | **FAIL** (lab `NO_LCP`; score null) |
| PDP Lighthouse LCP (mobile DevTools) | **PASS** (measurable) |
| CLS | **PASS** (0 across measured routes) |
| Image transfer (home, post-#58) | **PASS** vs pre-#58 baseline (~1.06 MB → **354 KB**) |
| Console errors (Playwright routes) | **PASS** (0) |
| Live COD / real order | **NOT TESTED** (forbidden) |
| Field CrUX / guaranteed Free-plan uptime | **NOT CLAIMED** |

---

## 1. Performance (actual lab measurements)

**Do not claim 90+ Lighthouse.** Homepage performance category score is **null** because LCP cannot be computed.

### Homepage — Lighthouse 12.4.0

| Run | Method | Score | LCP | FCP | CLS | SI | Total bytes | Notes |
|---|---|---|---|---|---|---|---|---|
| `lh-home-mobile.json` | simulate | null | **NO_LCP** | 2.2 s | 0 | 6.4 s | 1,101 KiB | TTFB obs. ~1.2 s |
| `lh-home-mobile-devtools.json` | DevTools throttle | null | **NO_LCP** | 5.4 s | 0 | 6.6 s | 988 KiB | Main-thread work ~34 s under throttle; TTI also failed (`NO_TTI_CPU_IDLE_PERIOD`) |
| `lh-home-desktop.json` | desktop | null | **NO_LCP** | 0.7 s (lab) / obs. FCP ~6.5 s | 0 | 4.5 s | 953 KiB | Same `NO_LCP` |

TraceElements gatherer also errored (`frame_sequence`) on home and PDP; **PDP still produced an LCP value**, homepage did not (no `observedLargestContentfulPaint` in metrics).

### PDP — Lighthouse DevTools mobile

| Metric | Value |
|---|---|
| Score | **0.51** (51) |
| LCP | **4.1 s** |
| FCP | 4.0 s |
| CLS | 0 |
| TBT | 1,480 ms |
| TTI | 8.6 s |
| Total bytes | 522 KiB |
| Oversized image waste | ~20 KiB (one catalog JPG) |

### Playwright vitals (Pixel 7 / Slow-4G style cold + warm)

File: `playwright-vitals.json`

| Route | Cold FCP | CLS | Image bytes (approx) | Console errors | Featured heading |
|---|---|---|---|---|---|
| `/` | 8408 ms | 0 | ~654 KB | 0 | **Dell Latitude 3440** |
| `/collections/laptops` | 616 ms | 0 | ~147 KB | 0 | — |
| `/search?q=dell` | 1248 ms | 0 | ~178 KB | 0 | — |
| PDP Dell 5400 | 808 ms | 0 | ~88 KB | 0 | — |

Playwright `PerformanceObserver` LCP entries were **empty on all routes** (including PDP where Lighthouse measured 4.1 s). Treat Playwright LCP as **unreliable in this lab**; use Lighthouse for LCP. FCP/CLS/image bytes remain valid.

### Image probe (post-#58)

`image-perf-probe-post58.json`: homepage **imageBytes = 354 233** (~346 KB); one oversized asset remains (`/v5/stage.webp` natural 1800×520 into ~335×97 CSS). Collections/search/PDP image totals 90–150 KB range.

### Certification statement

- Homepage lab LCP: **not certifiable** (`NO_LCP` reproduced on simulate + DevTools + desktop).
- PDP lab LCP: **4.1 s** mobile DevTools — not “good” (&lt;2.5 s), but **measurable**.
- CLS: **0** on measured surfaces.
- Image payload on home improved vs pre-hero-srcset baseline; **not** equated to a 90+ score.

No code change shipped this pass for `NO_LCP` (root cause not isolated to a safe one-line fix without touching frozen V5 hero motion; redesign forbidden).

---

## 2. Product naming

| Check | Result |
|---|---|
| Featured Configuration title | **Dell Latitude 3440** (smoke + probes) |
| Duplicate brand (`Dell Dell`) home/collection/search/PDP | **false** (`prod-smoke.json`) |
| PDP `<title>` | `Dell 5400 · Core i5, 8th Gen, 8GB RAM, 256GB Storage · Laptops HUB` |
| Shared formatter + unit tests | Present (`src/lib/catalog/product-display-name.ts`, `tests/unit/product-display-name.test.ts`) |
| Import audit script | `scripts/audit-product-display-names.mts` |

**PASS** for public naming surfaces exercised in smoke/probes.

---

## 3. Price accuracy (5% storewide)

| Check | Evidence |
|---|---|
| Promo banner | Present (“FLAT 5% OFF STOREWIDE”) |
| Home / collection / search “5% off” signals | true in `prod-smoke.json` |
| PDP JSON-LD price | **46550.00 PKR** (= 4 900 000 paisa × 0.95) |
| Checkout quote empty body | HTTP **400** (no live order) |
| DB campaign | `Storewide 5% Off` — `kind=percent`, `value=5`, `scope=storewide`, `status=active` |

**PASS** on public price surfaces checked. Real customer COD/checkout placement: **NOT TESTED**.

---

## 4. Supabase monitoring

| Mechanism | Status | Evidence |
|---|---|---|
| Vercel Cron `/api/cron/notifications` (`0 6 * * *`) | **PASS** | Registered in project; `system_keepalive.last_source = vercel-notifications-cron`, `last_ping_at = 2026-11-23 11:18:52+00`, `ping_count = 4` |
| Dedicated `/api/cron/keepalive` + `touch_keepalive` RPC | **PASS** (wired; exercised via notifications cron source) | Code paths in `src/app/api/cron/*` |
| GitHub `supabase-keepalive.yml` schedule `17 1,7,13,19 * * *` | **PENDING** | Workflow **active**; runs to date are **`workflow_dispatch` only** (3× success). No `event: schedule` yet |
| `notification-retry` schedule | **PASS** (adjacent proof GH schedules work on repo) | Multiple `event: schedule` successes 2026-11-22/23 |

**Limitations (do not over-claim):** Supabase Free can still pause; keepalives reduce idle risk only. GitHub `schedule` is best-effort and can delay after workflow add. Failure alert path exists in keepalive/notifications code (Resend) — full alert delivery not re-proven in this pass.

---

## 5. Regression matrix

| Item | Status |
|---|---|
| Home 200 | PASS |
| Featured heading | PASS |
| Naming dupes | PASS |
| 5% promo surfaces + JSON-LD price | PASS |
| Quote guard (empty → 400) | PASS |
| CLS = 0 | PASS |
| Home image bytes post-srcset | PASS (354 KB) |
| PDP Lighthouse LCP numeric | PASS (4.1 s / score 0.51) |
| Home Lighthouse LCP / score | **FAIL** (`NO_LCP`) |
| GH keepalive `schedule` execution | **PENDING** |
| Cart UI full path | NOT TESTED (price signals only) |
| Live order | NOT TESTED |
| CrUX field CWV | NOT TESTED |
| Admin mobile discounts UI | NOT RETESTED this pass |

---

## Business-only / follow-up blockers

1. **Homepage lab `NO_LCP`** — blocks honest Lighthouse certification for `/`. Needs a targeted LCP-candidate investigation (hero paint / blend / intro), not a redesign, before claiming Core Web Vitals lab green.
2. **Confirm first GitHub `schedule` run** of `supabase-keepalive` after the next UTC slots (`:17` at 01/07/13/19).
3. **Owner content / commerce** — pending content pages, COD policy, and any catalog copy remain business decisions (unchanged).
4. **Do not promise** Supabase Free uptime or 90+ Lighthouse without new comparable evidence.

---

## Deployment freeze

Latest production remains **`dpl_D646LaAdwBMYV9mcyZFQFXrj2Nv1` @ `5a2705b`**. No additional deployment from this acceptance pass.
