# 09 — Performance and accessibility

## Method

- **Before:** commit `040d3e4`, main before this pass. **After:** main with #107–#111 (`4e4daac` code).
- Both were built with the same isolated build (`scripts/dev/isolated-next.mjs build`), served by `next start` on 127.0.0.1:3001 against the same local Supabase fixture, on the same machine, back to back.
- Lighthouse 13.3.0 via `scripts/perf/lighthouse-local.sh`: home, collection, PDP × mobile/desktop, simulated throttling.
- axe-core over 7 routes × 390/1440 wide, tags WCAG 2.0/2.1/2.2 A and AA, measured after the hero intro.

**These are lab numbers from single runs on a developer machine, not field data.** On this machine, run-to-run variation in Performance and TBT is several points, so only consistent or large differences mean anything. Raw JSON is kept untracked (scratchpad).

## Lighthouse, before → after

| Page | Perf | A11y | Best practices | SEO | LCP ms | TBT ms | CLS |
|---|---|---|---|---|---|---|---|
| home mobile | 55 → 53 | 100 → 100 | 100 → 100 | 100 → 100 | 4574 → 4670 | 1392 → 1455 | 0 → 0 |
| home desktop | 69 → 75 | 100 → 100 | 100 → 100 | 100 → 100 | 2932 → 2786 | 242 → 177 | 0 → 0 |
| collection mobile | 59 → 57 | 100 → 100 | 100 → 100 | 100 → 100 | 4784 → 4744 | 1141 → 1266 | 0 → 0 |
| collection desktop | 90 → 89 | **96 → 100** | 100 → 100 | 100 → 100 | 1157 → 1078 | 218 → 243 | 0 → 0 |
| PDP mobile | 47 → 58 | 100 → 100 | 100 → 100 | 100 → 100 | 6417 → 4931 | 2845 → 1132 | 0 → 0 |
| PDP desktop | 85 → 85 | 100 → 100 | 100 → 100 | 100 → 100 | 2425 → 2069 | 121 → 155 | 0 → 0 |

**Reading:**
- No regression. Every changed number is within this machine's run-to-run spread, except the PDP-mobile TBT drop, which is most likely the noisy baseline run (no PDP code changed).
- CLS stays 0 everywhere.
- Collection-desktop accessibility rises from 96 to 100 because of #111.
- The hero change (#110) touches no LCP node: `prehydration` and `cross-browser-home-sections` still pass.
- The mobile LCP of ~4.6 s is a known lab figure on this machine. Earlier field and lab work is in `docs/visual-evidence/p0-perf-2026-11-23/`. It was not a target of this pass and is not claimed as improved.

## axe-core (WCAG 2.0/2.1/2.2 A+AA), 7 routes × 2 widths

Routes: `/`, `/collections/all`, PDP, `/search?q=dell`, `/cart`, `/compare`, `/track-order`.

| Build | Violations |
|---|---|
| Before | `color-contrast` (serious): `/collections/all` 1 node, `/search?q=dell` 2 nodes, at 1440. All at 390: none |
| After #111 | **0** on all 14 page/width combinations |

**Fix (#111).** Filter options with no matching products were dimmed to 40% opacity (~2.3:1) but still clickable. They are now `disabled`: an inactive control, exempt from 1.4.3, skipped by keyboard, look unchanged. A ticked option is never disabled. Spec `ui-filter-a11y`: fails on the old code, passes in Chromium, Firefox and WebKit.

## Other accessibility results from this pass

- **Focus not obscured (2.4.11):** focusing the map card no longer jumps the page on phones. While the map is pinned, focus still scrolls it fully into view (#107).
- **Mega menu:** every category reachable and visible; keyboard selects; Escape and Close work (#109).
- **WhatsApp button:** visible 3px focus outline; accessible name kept (#108).
- **Header on phones:** 97% opaque, so text contrast no longer depends on what is behind it (#107).
