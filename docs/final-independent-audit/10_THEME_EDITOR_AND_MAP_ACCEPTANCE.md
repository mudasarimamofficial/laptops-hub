# 10 — Theme editor and Google Maps acceptance

**Date:** 2026-11-17 · Production admin owner session

## Theme editor (`/admin/online-store`)

| Check | Result |
|---|---|
| Route loads for owner | **PASS** |
| Desktop / tablet / mobile preview toggles | **PASS** (controls present) |
| Save draft / Publish buttons | Present; disabled until dirty (expected) |
| Truthful kill-switch copy | **PASS** — UI states `THEME_PUBLISHED_ENABLED` unset; customers see built-in V5 |
| Draft ≠ public | Documented in UI; matches env |
| Section order note | Hero first / map last enforced in copy |

**Not done this pass:** mutate draft text, publish/rollback on isolated stack re-run (scheduled with Phase 8).

## Google Maps (storefront)

| Check | Result |
|---|---|
| After-footer “Visit our store” region | **PASS** on live homepage |
| Google Maps link | **PASS** — “Open in Google Maps” |
| Attribution | Laptops HUB · Bahawalpur (no invented street text) |
| PR #11 keyboard focus | Not re-probed with keyboard this pass — do not regress |

## Classification

**Theme editor: PASS (UI + kill-switch honesty)** · publish-to-public **BLOCKED** until owner sets flag  
**Map: PASS (visible + linked)** · deep a11y keyboard re-check pending
