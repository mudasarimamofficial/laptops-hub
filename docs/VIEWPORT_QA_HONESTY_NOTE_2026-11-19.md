# Viewport QA honesty note — 2026-11-19

## What `docs/VIEWPORT_QA_ACCEPTANCE_2026-11-19.json` actually is

**Label: PARTIAL (smoke only) — not full acceptance.**

The JSON records **80 baseline smoke checks** (8 widths × 10 routes):

| Check | Covered |
|---|---|
| HTTP status | Yes |
| Page title | Yes |
| H1 presence | Yes (boolean only) |
| Skip link | Yes |
| Page-level horizontal overflow (`overflowX`) | Yes |

## What it is NOT

This set is **not**:

- Pixel-perfect visual certification
- Full responsive interaction QA
- A complete 80-case functional matrix

**NOT TESTED** by that JSON (among others): screenshots, interactive navigation, dropdowns, modals, cart mutations, checkout inputs, compare, reels, product variant selection, mobile touch, floating components, accessibility audits beyond skip+h1, admin owner auth, merchant save/reload, console errors.

## Checkout `hasH1: false`

Observed for `/checkout` at every width in the smoke run.

Checkout form source (`src/app/(storefront)/checkout/checkout-form.tsx`) renders an `<h1>` in the normal cart path, but empty-cart / pending-block paths use `PendingBlock` without an `<h1>`.

**Verdict:** PARTIAL — empty-cart checkout lacks a page-level `h1` (semantic heading gap for that state). Not necessarily a broken checkout when the cart has items. Needs a dedicated a11y pass; do not treat smoke `hasH1: false` alone as “checkout is broken.”

## Required reporting language

When citing this file, say **“80-route viewport smoke”** or **PARTIAL**. Do not claim complete client readiness from this artifact alone.
