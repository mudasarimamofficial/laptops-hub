# 05 — Mega menu: Help visibility and accessibility

## What changed (#109, CSS only)

- `.v5-mega-panel` defines its cap as a variable. The cap is 480px by default, 432px at ≤ 700px tall, and the window height below the header at ≤ 580px tall. The panel still sizes to its content and never extends past the window.
- `.v5-mega-groups` (sticky category column) has a definite `max-height: calc(var(--lh-mega-avail) - 92px)`, equal to the body's visible height. It can never be taller than the visible area, so its last row cannot be hidden under a pinned top. If the merchant adds more groups than fit, the column scrolls by itself.
- Unchanged: text size, row height (40px; 36px at ≤ 700px tall), the groups, the sticky footer with "View all" and Close, compact 190px links (#63), the hover/click race fix (#64), and the #99 behaviour.

## Accessibility

| Check | Result |
|---|---|
| Every group fully visible, and the element under its own centre (nothing painted over it) | ✔ at 8 viewports |
| Keyboard: focusing the last group selects it (`aria-pressed="true"`) and it is fully visible | ✔ |
| Escape closes the menu | ✔ (new spec + existing `mega-menu-responsive`) |
| Close button inside the window, works | ✔ |
| Footer inside the window at 1918×542 | ✔ |
| Text not shrunk, no group hidden | ✔ |
| More groups than fit (forced, 27 rows at 1366×500): the column scrolls and the last row can be brought fully into view, footer and Close still visible | ✔ |

## Tests

`tests/e2e-isolated/ui-mega-help-visibility.spec.ts` (10 tests): 1180×900, 1280×720, 1366×768, 1440×900, 1754×864, 1918×542, 1280×600, 1024×768, the keyboard test and the overflow stress test.

| Browser | Result |
|---|---|
| Chromium | **15/15**, including the existing `mega-menu-responsive` (5) |
| Firefox | **10/10** |
| WebKit | **10/10** |

## Live (read-only, 1366×768)

9 groups; panel 458px; Help bottom 491.5 vs visible body bottom 503.5. **Not clipped.**
