# Final UI/UX QA — release 2026-11-16

V5 design system unchanged (frozen). New sections use existing tokens (`--lh-*`, `--adm-*`), type scale and radii.

## Homepage reviews

| Check | Result |
|---|---|
| Full width without `100vw` overflow | PASS at 320, 390, 768, 1280, 1440 (no horizontal scroll) |
| Two rows, opposite directions, edge fade | PASS (desktop screenshot `test-results/p1-evidence/store-reviews-1440.png`) |
| Long text | clamped in card, full text in the dialog |
| Controls: Pause/Play (`aria-pressed`), Read all reviews (native dialog, Escape), Google profile link | PASS — Chromium, WebKit, Firefox; desktop and phone |
| Reduced motion | no animation; rows swipeable; repeats not rendered |
| Screen readers | visual repeats `aria-hidden` + `inert`; each review announced once (`aria-label="Review by …"`) |
| Empty state | section absent when nothing is published |

## Store map

| Check | Result |
|---|---|
| Reveal: footer scrolls up over the pinned map; no scroll listeners | PASS (computed sticky; mid-scroll screenshot) |
| Bottom of page: map interactive, "Open in Google Maps" not covered | PASS (elementFromPoint check, all 5 browser projects) |
| Phone ≤ 640 px: panel below the map | PASS |
| Reduced motion: plain section | PASS |
| Pin | LAPTOPS HUB, Bahawalpur (browser check) |
| Lazy: no iframe until near the bottom | PASS |

## Admin

| Check | Result |
|---|---|
| Testimonial form: labels on every field, inline field errors, live card preview, status chips, history | PASS (E2E) |
| Product list: checkbox column, header select-all with mixed state, sticky action bar, confirmation for draft/archive | PASS (E2E) |
| Theme editor: select / checkbox / textarea fields with help text; dead "Move up/down" buttons replaced by an explanation | PASS |

## Not covered here

- Live production visual pass — after deployment (live QA section of `FINAL_E2E_REPORT.md`).
- 1920 px: covered by the existing cross-browser storefront spec widths; the new sections are max-width constrained.
