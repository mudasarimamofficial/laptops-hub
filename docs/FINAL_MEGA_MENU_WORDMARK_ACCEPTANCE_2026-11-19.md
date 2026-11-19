# Mega menu + wordmark acceptance (in progress)

**Branch:** `feat/az-mega-menu-wordmark-mobile-admin-2026-11-19`  
**Baseline production:** `beda2c4` / `dpl_8FqSGLE3j3PqB4BVoc666mS7GBhk`

## Wordmark
- Visible text: **LAPTOPS** + red **HUB** badge (header, mobile drawer, footer via shared `Wordmark`)
- Admin shell: **LAPTOPS HUB** uppercase
- Favicon from PR #50: unchanged

## Desktop mega menu
- Grouped navigation: left category list, right links for **one** active group
- Height capped (`min(420px, calc(100vh - 88px))`) — no near-full-viewport dump of all groups
- Featured product retained at ≥1180px
- Close via Escape, header mouse leave, explicit Close control
- Data still driven by `chrome.menu` (merchant navigation editor)

## Tests
- `tests/e2e-isolated/mega-menu-wordmark.spec.ts` (isolated only)

## Status
- Implementation: **DONE** in branch (pending local/isolated verification + PR)
- Production: **NOT YET DEPLOYED**
