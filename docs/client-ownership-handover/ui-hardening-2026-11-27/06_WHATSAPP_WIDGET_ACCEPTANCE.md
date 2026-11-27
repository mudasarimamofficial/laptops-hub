# 06 — WhatsApp widget acceptance (#108)

| Requirement | Result |
|---|---|
| Phones: 56px, width = height | ✔ 56×56 at 320, 360, 375, 390, 414, 430, 759 wide (isolated); 56×56 at 390 live |
| Round | ✔ radius ≥ 28px (`50%` in CSS; the computed value reads `999px` from the existing inline pill radius, which renders identically on a 56px square) |
| Icon centred | ✔ within 1px horizontally and vertically |
| No label, no pill padding on phones | ✔ |
| Clear of the screen edges | ✔ ≥ 15px right and bottom |
| Desktop pill unchanged | ✔ labelled pill, 52px tall (live 201.75×52 at 1366); back to the pill when a phone-width window is widened to 1024 without reload |
| Same merchant link and accessible name on every size | ✔ (`https://api.whatsapp.com/message/…`, "… — opens in a new tab"); no phone number substituted |
| Visible keyboard focus | ✔ 3px outline, `var(--lh-action)`, offset 3px |
| Does not cover the map card at the end of the home page on phones | ✔ section bottom space (#107) |

## Files

- `src/components/storefront/whatsapp-float.tsx`: classes `lh-wa-float`, `data-labelled`, `lh-wa-icon`; inline sizing removed.
- `src/styles/v5.css`: `.lh-wa-float` rules.

## Tests

`tests/e2e-isolated/ui-whatsapp-mobile-circle.spec.ts` (2 tests). Chromium, Firefox and WebKit: **2/2 each**. Run together with `contact-social-whatsapp` and `contact-social-whatsapp-order` after the rebase on #107: **21/21** (Chromium, with the map spec).
