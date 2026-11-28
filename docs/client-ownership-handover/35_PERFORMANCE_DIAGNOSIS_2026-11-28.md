# 35 — Mobile performance diagnosis and PERF-001 (2026-11-28)

**Summary:**
- **One fix shipped:** PERF-001. The first product photo on collection and search pages now loads early, at high
  priority.
- **It removes a real 0.3–1.3 s discovery delay**, but the lab LCP figure did **not** go down.
- **What limits mobile LCP now** is main-thread work before the photo can be painted (render delay), not the network.
- These are lab numbers on one developer machine, **not field data**. No Core Web Vitals field data is available:
  Vercel Speed Insights is not enabled, and the site is too new for public CrUX data.

## 1. Method

- **Build:** the isolated production build (`scripts/dev/isolated-next.mjs build`, then `next start` on
  127.0.0.1:3001 against the local Supabase fixture). This is the same code as production `b986807`.
- **Tool:** Lighthouse 13 mobile, simulated throttling, **3 runs per page per build**, nothing else running.
- **Caveat:** Lighthouse warns the machine's CPU is slower than its calibration, so absolute numbers are pessimistic.
  Read differences, not absolutes.
- **Production server timing:** read-only `curl`, 3 runs per page from this workstation.
- **Raw summary:** `docs/visual-evidence/perf-2026-11-28/lighthouse-summary.json`.

## 2. Baseline (main `b986807`), mobile, 3 runs

| Page | Performance (min–max, median) | LCP median | FCP median | TBT median | CLS | LCP element |
|---|---|---|---|---|---|---|
| Home | 48–70, **64** | **4.49 s** | 1.49 s | 699 ms | 0 | the decorative "HUB" outline text behind the hero laptop (`.v5-hero-ghost`) |
| Collection `/collections/all` | 61–70, **66** | **4.35 s** | 1.59 s | 669 ms | 0 | first product card photo |
| Product page | 61–70, **61** | **4.63 s** | 1.17 s | 1,015 ms | 0 | main product photo |

The 2026-11-27 single runs (home 53 / 4.67 s, collection 4.74 s, PDP 4.93 s) fall inside this spread. **One run is not a
baseline on this machine:** the home performance score alone moved 22 points between identical runs.

## 3. Where the time goes (LCP subparts, Lighthouse "LCP breakdown")

| Page | Time to first byte | Resource load delay | Resource load time | Element render delay | Reading |
|---|---|---|---|---|---|
| Home | 18–32 ms | — (text) | — | **1.8–2.8 s** | Text that paints at first paint. The delay is CSS, fonts and main-thread work before the first frame. |
| Collection (before) | 60–95 ms | **286–1,267 ms** | 815–1,697 ms | 27–1,138 ms | The photo was **lazy** with no priority hint, so the browser found it only after layout. |
| Product page | 48–75 ms | 20–27 ms | 759–1,132 ms | 76–1,126 ms | Already eager and high priority. The cost is downloading from Shopify's CDN, then main-thread work. |

**Investigated, by area:**
- **Product image loading:** the PDP was already correct. The collection was not, and is fixed (PERF-001 below).
  Home side images and below-the-fold cards stay lazy or low priority, which is correct.
- **Shopify CDN latency:** in unthrottled loads a 45–98 KB photo takes 0.6–1.7 s from `cdn.shopify.com`. That is
  a real share of product and collection LCP.
  - Moving media (package D in `34`) would change it, but the target host must serve sized copies, or phones get
    bigger files.
  - Measure before and after each batch.
- **Hero rendering:** the LCP element is decorative text (`aria-hidden`), painted at first paint (observed LCP =
  observed FCP in all 3 runs). Draft PR #62 found the same element.
  - Hiding or shrinking it to change which element counts would game the metric without making the page faster for
    anyone, so it was not done.
- **Critical CSS:** 4 render-blocking stylesheets on home (19 KB total). They are small. Inlining would save one
  round trip at most.
- **Fonts:** 3 self-hosted variable fonts (Sora, Hanken Grotesk, JetBrains Mono, 107 KB), all preloaded with
  `font-display: swap`.
  - The mono font (40 KB) is not needed for any LCP element. Not preloading it could free bandwidth, but it is a
    small, unmeasured gain and would add a visible font swap on small labels. **Proposed, not done:** measure first.
- **Hydration and JavaScript:**
  - About 290 KB of JavaScript (transfer). About 113 KB is unused on first load (Lighthouse estimate).
  - On home, one chunk runs about 1.8 s of script on the throttled CPU.
  - TBT is 0.5–1.6 s. This is the main remaining cost, and the reason the collection photo now waits about 1 s to be
    painted after it arrives.
  - Reducing it means splitting the large client components (collection view, product view, home sections). That
    is real work and needs its own pass. It is **not** a quick fix.
- **Carousels and reels:** below the fold. Their animation loops start only near the viewport (since #59). Not on
  the LCP path.
- **Third-party scripts:** none on these pages. No analytics or tag manager; the Google Map is not loaded at first
  paint.
- **Server response** (production, read-only, 3 runs each, from this workstation):

  | Page | Vercel cache | TTFB |
  |---|---|---|
  | Home | `HIT` | 0.47–0.56 s |
  | Collection | `MISS`, `no-store` | 0.59–0.62 s |
  | Product page | `MISS`, `no-store` | 0.54–0.59 s |

  About 0.1 s of server time on dynamic pages; the rest is network distance. Making these pages cacheable is a
  separate change: they read cookies and search parameters, so it needs care around discounts and drafts.

## 4. PERF-001: the first collection photo is lazy (fixed)

**Defect:** on a phone the collection grid is one column, so the first card's photo is the LCP element. Every card
photo had `loading="lazy"` and no `fetchpriority`. Lighthouse's LCP discovery checks all failed:
- "fetchpriority=high should be applied";
- "request is discoverable in initial document";
- "LCP resources should not use loading=lazy".

**Fix** (`src/components/commerce/product-card.tsx`, `src/components/storefront/collection-view.tsx`):
- `V5ProductCard` takes an optional `priority` prop.
- The collection view sets it on the **first card only**, which gets `loading="eager"` and `fetchpriority="high"`.
- Every other card is unchanged and still lazy.
- Home, product-page and content-page cards are unchanged.
- No visual change.

**Evidence:**

| | Before (3 runs) | After (3 runs) |
|---|---|---|
| LCP discovery checks passed | 0/3, 1/3, 0/3 | **3/3 in every run** |
| Resource load delay | 286–1,267 ms | **22–34 ms** |
| Photo request priority (Chrome) | Low | **High** (spec asserts it) |
| Simulated LCP (median) | 4.35 s | 4.52 s, within this machine's spread |
| Performance (median) | 66 | 74, noisy |
| Element render delay | 27–1,138 ms | 995–3,161 ms |

**Reading:** the photo is now requested at once instead of after layout. In unthrottled loads it is about 1.2 s
earlier. The lab LCP did not improve, because the time saved moved into render delay: the photo arrives, then waits
for the main thread (hydration).
- This is shipped as a correct loading order that removes one of the two bottlenecks. **It is not claimed as a
  customer-speed win.**
- The next gain needs the JavaScript work in §3.

**Regression proof:**
- New spec `perf-collection-lcp-priority`: 3 tests, `--repeat-each=3` gives 9/9. It fails on the old build on all
  three assertions.
- Related specs, 52/52:
  - `p1-image-fallback`, `cross-browser-storefront`, `cross-browser-home-sections`;
  - `ui-filter-a11y`, `seo-search-appearance`, `prehydration`;
  - `ui-responsive-cross-route`, `p1-collection-modes-g12`, `p0-collection-management`;
  - `ui-store-hydration` (checkout hydration, HYD-001).
- `tsc`, `eslint --quiet` and `npm run test:unit` pass. CLS stays 0.

**Rollback:** revert the PR. No data or schema change.

## 5. Draft PR #62

Reviewed again, still **not merged**:
- It adds gated `/diag/lcp-lab*` experiment routes under `src/` and temporary scripts. Its own test plan says not
  to merge until a proven fix exists.
- Its finding (the decorative "HUB" text is the home LCP element) is confirmed here.
- Recommendation: close it, keeping the branch for reference. The diagnosis is preserved in this document. Closing
  is the owner's or engineering lead's call; it was left open.

## 6. Next performance work (proposed, ordered by expected gain)

1. **Cut hydration work** on collection and product pages:
   - render static parts as server components;
   - load the quick-view, inquiry and compare logic on demand.
   - Expected to reduce TBT and render delay. It needs its own PR with this baseline method (3+ runs per build).
2. **Enable Vercel Speed Insights** to get real-user LCP/INP/CLS. It may cost money on Pro; owner decision with
   package A.
3. **Media host with sized copies** (package D). Measure CDN time before and after.
4. **Mono font preload:** measure on vs off, 3+ runs each.
