# QA exception closure — 2026-11-19

Continuation from production `9b02526` / PR #47. Closes PARTIAL / NOT TESTED items from `INTERACTIVE_UX_QA_2026-11-19.json` without claiming 100% certification.

**Shipped:** PR #48 → `5c97ac81454963448e81c4b2d52aceaf56e2191d` / production `dpl_AcoSSADs8iWiecsh8eRubaU2ndsj` (READY).

## Independent results

| Item | Label | Evidence |
|---|---|---|
| Mobile Open menu | **PASS** | Root cause: pre-hydration clicks looked successful but never opened the drawer. Fix: `useHydrated` gate + `data-testid=mobile-nav-open` / `data-ready`. Regression: `mobile-nav-reels-a11y.spec.ts` open → navigate → close |
| Reels shopping modal (mobile/tablet/desktop) | **PASS** (isolated) | Same suite: open/close, Escape, focus on close, video, linked product, add-to-cart across 390/768/1280 |
| Reel add-to-cart vs cart drawer | **PASS** (bug fixed) | Modal z-index 80 covered cart z-index 71; add-to-cart now closes modal before opening cart |
| Guides empty `/guides` 404 | **PASS** (intended) | Empty isolated DB → 404 publication gate |
| Guides after publish | **PASS** | Article 200 → index 200 → sitemap → unpublish → article 404 → index 404 |
| Auth skip-link PARTIAL | **PASS** (N/A corrected) | Guest login/forgot have no nav chrome; skip link would be artificial. Added `<main id="admin-main">` + labelled form instead |
| Merchant create/edit/save/reload | **PASS** (isolated) | Prior `merchant-admin-workflows` 11/11 + P0 inventory/collections; not re-run destructively on production |
| Automated a11y (axe wcag2a/aa) | **PASS** | Homepage + login critical/serious = 0 after carousel `role="region"` fix (`test-results/exception-closure/axe-*.json`). Suite: `mobile-nav-reels-a11y.spec.ts` **5/5** |
| Full screen-reader session | **NOT TESTED** | Requires NVDA/VoiceOver with a human operator |
| Owner fresh password login | **OWNER VERIFICATION REQUIRED** | UUID `cc603db4-…`, role owner, email `infolaptopshub@gmail.com` unchanged. No recovery email resent |

### Overall

**PARTIAL** — remaining engineering exceptions closed on isolated; client handover still blocked on owner private password confirmation and full SR session.
