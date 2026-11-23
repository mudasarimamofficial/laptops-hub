# Mega-menu responsive repair & site audit — 2026-11-24

Shipped on `main`:
- PR #63 → `611efb91c935a3d982f4923c1b5b35eb00fb9310` (`dpl_8u6nPs4HhbC5RX4HyHznP3HNjj3g`)
- PR #64 hover-click race → `2e33341f2a138075291dc3c3d4843d04beb501a0` (`dpl_FixJZyXiwNVFq1adMEKdu5yJtPtW`, **READY**)

Base before work: `6fe4f3dd86c91149563e0c1d150e5555c9c20409`  
PR #62 (LCP lab): **untouched** (still open draft)

## Mega-menu root causes

| # | Observation | Root cause |
|---|---|---|
| 1 | Sparse SCREEN links looked edge-to-edge | `.v5-mega-links-grid` used `repeat(..., 1fr)` / unconstrained tracks so few items stretched across the middle column |
| 2 | Oversized empty panel feel | Full-bleed absolute panel + stretched link tracks + fixed ~420px height without a sticky footer / scroll body |
| 3 | Close / footer unreachable on short desktops (~1918×542) | Outer `overflow: hidden` + fixed max-height hid the footer below the fold; no internal scroll + sticky footer |
| 4 | Search placeholder cut off | `width: min(320px,26vw)` + `overflow:hidden` on the control with a long unbroken label |
| 5 | Homepage horizontal page scroll | Decorative `.v5-hero-ghost` / `.v5-story-ghost` painted past the viewport without `overflow-x` containment |

## Fixes (preserve V5)

- Content-aware mega panel: flex column, scrollable `.v5-mega-body`, sticky `.v5-mega-footer`, `--lh-header-offset` from measured sticky header bottom, short-height caps.
- Link row: flex wrap with fixed ~190px items (no `1fr` stretch); featured card remains at ≥1180px.
- Search: responsive full / short / icon-only labels; `clamp` width; ellipsis; accessible `aria-label`.
- Interaction: fine-pointer hover only; click toggle; Escape / outside / route / search / cart close mega; `aria-expanded`.
- Storefront `html, body { overflow-x: clip }` so decorative ghosts cannot create page-level horizontal scroll.

## Verification

| Check | Result |
|---|---|
| Before 1918×542 | `searchOverflow: true`, `closeVisible: false` |
| After 1754×864 / 1918×542 | `searchOverflow: false`, `closeVisible: true`, `maxLinkW: 190`, `clippedFooter: false`, `docOverflowX: false` |
| Playwright `mega-menu-responsive.spec.ts` | **5/5 passed** (local `:3020`) |
| Site audit (7 routes × 6 viewports + mega Close/search) | **0 findings** |
| Production smoke 1754×864 / 1918×542 | `searchOverflow:false`, `closeVisible:true`, `maxLinkW:190`, `docOverflowX:false` |
| `npm run build` | pass |
| `npm run lint` | 0 errors |
| `npm run test:unit` | pass |
| PR #62 | not merged / not modified |

Evidence: `docs/visual-evidence/mega-menu-responsive-2026-11-24/` (`before-*`, `after-*`, `prod-verify-*`, `*-metrics.json`, `site-audit.json`).

## Menu groups exercised

CATEGORY, BRAND, PROCESSOR, MEMORY, STORAGE, SCREEN, BUDGET, SHOP BY USE, HELP (all `mega-group-*` buttons in the Playwright group loop).

## Remaining (non-blocking)

| Severity | Item | Notes |
|---|---|---|
| P3 | Middle column still has whitespace beside a sparse group | Intentional: links stay compact; featured card stays right; not a stretch bug |
| P3 | Panel height still ~440px when all categories are listed | Driven by 9 category rows; body scrolls on short viewports; footer stays reachable |

## Explicit confirmations

- Active 5% discount, cart math, COD, inventory, SEO, keepalive, Hostinger CRM: **not modified**.
- Draft PR #62: **remained untouched**.
