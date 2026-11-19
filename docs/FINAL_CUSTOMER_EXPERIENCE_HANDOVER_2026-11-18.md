# Laptops HUB — Final Customer Experience Handover (updated 2026-11-19)

## A. Release identification

| Item | Value |
|---|---|
| Base main SHA (start of acceptance) | `0865955a4c17c53827e3873c13e495d8fe07d95e` |
| Prior independently checked production | `dpl_Dpbt42PxGyPNDjZQLTctBjkV1WXV` (READY) |
| Feature PRs already merged | [#41](https://github.com/mudasarimamofficial/laptops-hub/pull/41) premium reels UX; [#42](https://github.com/mudasarimamofficial/laptops-hub/pull/42) handover IDs |
| Acceptance branch | `fix/operational-acceptance-reels-qa` |
| Rollback production SHA | `d84ceffa9f21f487400ce32fbc80955b5dfb9532` |
| Rollback production deployment | `dpl_35MZ4tJ3Nuevtb8oX16E7ftpRYzD` |
| Vercel project | `prj_yNteTkvgFWqroKMU8NGC8y4p3pT2` |
| Production domain | https://www.laptopshub.pk |
| Supabase project | `xvmmjkrkgznnakcobmww` |

> Final production SHA / deployment ID after this acceptance PR merges will be recorded in section **H** once CI + promote complete.

## B. Implemented UX (do not rebuild)

Premium multi-autoplay reels, centered shoppable modal, `reel_products` M2M, carousel scroll progress, compare **Clear all**, reviews dialog centering — shipped in #41. This acceptance pass updates tests, ledger, QA evidence, and auth verification only.

## C. Tests updated (isolated)

| Spec | Contract covered | Status |
|---|---|---|
| `tests/e2e-isolated/p1-social-proof.spec.ts` | Multi muted autoplay; no play/hashtag overlay; full loop; background/tab pause; reduced-motion Watch fallback; centered modal + focus restore | **PASS** |
| `tests/e2e-isolated/p1-premium-reels-shoppable.spec.ts` | Admin multi-product (1/2/many), order, draft reject, save/reload; modal prices + cart; carousel progress vs scroll; Clear all; reviews dialog centered | **PASS** |
| `tests/e2e-isolated/p1-reels-reviews-blog.spec.ts` | Rights gate, placeholder vs section, reviews, blog | **PASS** (reels + reviews + fulfillment). Blog publish case **PARTIAL** — updated for Visibility radios / Create post / Web address; remaining create-navigation flake under investigation (not a reels regression) |

Obsolete one-reel / permanent play / hashtag assertions were **replaced**, not deleted to greenwash CI.

## D. Reel–product acceptance

| Check | Status | Notes |
|---|---|---|
| Isolated multi-product assign / reorder / save / reload | **PASS** | Uses fixture catalog + temporary `qa-premium-extra-*` only |
| Draft products rejected on save | **PASS** | API 400 with draft messaging |
| Price authority in modal | **PASS** | Catalog-formatted PKR on shop cards |
| Add to cart from modal | **PASS** | `lh-cart-v1` line count increases |
| Production six videos linked randomly | **NOT DONE (by design)** | Merchant assigns via Admin → Reels; production `reel_products` remains empty until then |
| External HTTPS media (no domain blacklist) | **PASS** | URL rules allow public HTTPS; http://127.0.0.1 only for local tests |

## E. Migration ledger reconciliation

See `docs/MIGRATION_REEL_PRODUCTS_LEDGER_2026-11-19.md`.

| Side | Version |
|---|---|
| Hosted Supabase | `20261118162150` (apply-time id) |
| Repo original filename | `20261118220000_reel_products.sql` |

**Safe path taken:** matching local file for `162150`, no-op assert for `220000`, `migration repair --status applied` for `220000`. No drop/recreate. Future DDL must use a newer timestamp after `220000`.

Linked list confirms both versions present on remote.

## F. Native SMTP / password change

| Check | Status | Evidence |
|---|---|---|
| SMTP UI configured (host/user/sender/port) | **PASS** | `smtp.resend.com:465`, user `resend`, sender `auth@send.laptopshub.pk`, toggle on; password not exposed |
| Dedicated Resend key exists | **PASS** | `laptops-hub-supabase-auth-smtp` (credential never printed) |
| One controlled `resetPasswordForEmail` | **FAIL (provider)** | Auth returned 500; GoTrue error: Resend `550 The send.laptopshub.pk domain is not verified` |
| Resend Domains | **FAIL** | Resend dashboard shows **No domains yet** — SMTP password may be valid but sender domain is unverified |
| Inbox delivery / owner private password change | **BLOCKED** | Blocked by domain verification; do **not** resend recovery until domain is verified |
| App recovery (`generateLink` + Resend REST) | **PASS (prior #40)** | Remains operational path |
| Fresh email/password login + owner role | **PASS (prior session)** | Owner `infolaptopshub@gmail.com` logged in successfully earlier; not re-tested after failed recovery |

**Owner action required:** Add and verify `send.laptopshub.pk` (or change Auth sender to an already-verified Resend domain), then run **one** private recovery + password change. Do not share the new password with AI/tools.

## G. Full-site QA (routes + viewports)

### Route inventory

Generated: `docs/ROUTE_INVENTORY_ACCEPTANCE_2026-11-19.json` (storefront + admin App Router paths).

### HTTP smoke (production, read-only)

| Path | Status |
|---|---|
| `/`, `/collections/all`, `/search?q=dell`, `/compare`, `/cart`, `/checkout`, `/guides`, `/track-order`, `/admin/login`, `/admin/forgot-password` | **PASS** (200) |
| `/coming-soon` | **PASS (expected 404)** when site not in `restricted` prelaunch mode |

### Viewport matrix

`docs/VIEWPORT_QA_ACCEPTANCE_2026-11-19.json` — Playwright chromium across **320, 360, 390, 428, 768, 1024, 1440, 1920** × key customer routes (+ admin login).

| Metric | Result |
|---|---|
| Combinations run | 80 |
| Failures (status / overflowX ≥ 24px) | **0** |
| Skip link present | Yes on storefront routes tested |

### Production browser interaction (www)

| Area | Status | Notes |
|---|---|---|
| Homepage reels heading | **PASS** | “Laptops in Action” |
| Multi muted autoplay (visible cards) | **PASS** | At 390px: 2 playing muted+loop; offscreen paused |
| No permanent play/sound overlay | **PASS** | |
| Carousel progress present | **PASS** | |
| Shoppable modal centered; pauses background | **PASS** | centerΔ≈6px; `playingBg: 0`; “Shop this video”; **0 products** until merchant links |
| Catalog / search / PDP / cart / checkout / guides / track | **PASS** smoke |
| Admin products/orders/staff/settings deep flows | **PARTIAL** | Login reachable; deep mutation flows not re-run on production (use isolated) |
| Accessibility (full WCAG audit) | **PARTIAL** | Modal focus + progressbar roles; skip links; contrast Clear all implemented — full axe sweep still recommended |
| Performance (Lighthouse) | **NOT TESTED** this pass | Route TTFB smoke only |
| QA order `LH-261118-77C0F6` | **Untouched** | |

## H. Final readiness matrix

| Bucket | Verdict |
|---|---|
| Premium reels UX on production | **PASS** |
| Isolated E2E contract update | **PASS** (blog flake PARTIAL) |
| Product-link admin/API | **PASS** isolated; production linking **NOT TESTED** (merchant decision) |
| Migration ledger | **PASS** |
| Native SMTP recovery E2E | **FAIL / BLOCKED** (Resend domain unverified) |
| Multi-viewport route smoke | **PASS** |
| 100% client readiness | **NOT DECLARED** — blocked on SMTP domain + merchant product links + optional Lighthouse/axe |

## Rollback

1. Redeploy `dpl_35MZ4tJ3Nuevtb8oX16E7ftpRYzD` / SHA `d84ceff` if UX regresses.
2. Keep `reel_products` (additive).
3. SMTP: leave custom SMTP on after domain verify, or disable; app Resend REST recovery remains.
