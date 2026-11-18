---
name: laptops-hub-admin-excellence
description: >
  Build and improve the Laptops HUB merchant admin (Shopify-quality ops UX) without redesigning the V5 storefront.
  Use for AdminShell, products, variants, inventory, orders, shipping, COD readiness, content, testimonials, reels,
  blog, merchandising, staff, forms, tables, bulk actions, a11y, and admin tokens. Prefer existing desks and APIs;
  never invent catalog facts, consent, fees, or media rights.
---

# Laptops HUB Admin Excellence

## When to use

Any change under `src/app/(admin)`, `src/components/admin`, admin APIs, or merchant workflows (products, orders, content, COD readiness).

## Non-negotiables

- V5 **storefront** design is frozen; admin may be improved independently.
- No storefront chrome (`SiteHeader` / footer / cart / compare) on `/admin`.
- Use `--adm-*` tokens and `AdminPageHeader` — not `lh-container` / V5 pills on signed-in desks.
- Server-side role checks on every mutation (`createAuthorizedStaffWriter`); UI hiding is not security.
- Paisa integers for money; never trust browser totals.
- Do not fabricate reviews, sales, badges, inventory quantities, warranties, or media rights.
- Preview may share production Supabase — no destructive Preview writes; use isolated stack for write QA.

## Architecture

- Route group: `src/app/(admin)` + `admin.css` (isolated from storefront).
- Shell: `AdminShell` (nav, search, shortcuts). Prefer extending it over new shells.
- Page pattern: `AdminPageHeader` + surface cards with `--adm-border` / `--adm-surface` / `--adm-radius-lg`.
- Empty states: dashed border, explain what the storefront shows until content exists.
- Destructive actions: confirm; prefer hide/unpublish over hard delete when reversible.

## Product / laptop retail workflows

Optimize: search, filters, bulk status, variants (RAM/storage/condition), media, pricing, draft/publish, collections, badges.
Preserve availability-confirmation-first when stock is untracked — never invent quantities.

## Forms & validation

- Label every control; show field-level errors from API `fieldErrors`.
- Disable publish options until prerequisites pass (rights, consent, Maps URL, policy body).
- Persist via existing APIs; reload to prove save (not toast-only).

## Tables & bulk

- Responsive tables; sticky actions on mobile.
- Bulk actions with clear selection count and confirmation.
- Loading / empty / error states required.

## Accessibility & responsive

Target WCAG 2.2 AA: focus traps, Escape closes dialogs, 44px targets, keyboard paths for primary actions.
Test 360 / 390 / 768 / 1280 / 1440; no horizontal overflow in admin.

## Performance

Avoid waterfalls on list pages; paginate; do not load full catalog into the client when search APIs exist.

## Tests & release evidence

- Touching admin TS: `tsc`, eslint on changed files, relevant unit + isolated E2E.
- COD/shipping: isolated DB matrices + readiness gates — never bypass gates.
- Report PASS/FAIL with commands; distinguish engineering ready vs content published vs live transaction verified.

## Related skills

- `.agents/skills/frontend-design` — visual craft (admin chrome only).
- `.agents/skills/web-design-guidelines` — UI guideline review.
- `.agents/skills/vercel-react-best-practices` — React/Next performance.
- `.agents/skills/webapp-testing` — Playwright.
- `.claude/skills/laptops-hub-release-guardian` — release evidence (owner mandate of 2026-11-18 authorizes merge/deploy/COD when gates are truly satisfied).
