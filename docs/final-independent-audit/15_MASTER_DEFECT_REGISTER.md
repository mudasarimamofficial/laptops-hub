# 15 — Master defect / improvement register

**Audit date:** 2026-11-17  
**Baseline:** production `dpl_8YQ3HoEmaw5bqAv4rxBS1Z5eSz3N` @ `585c8e9`  
**Working branch:** `audit/final-independent-certification`

Severity: **P0** security/finance · **P1** broken critical workflow · **P2** UX/responsive/perf · **P3** polish.

Status: **OPEN** · **FIXED** · **VERIFIED** · **BLOCKED** (owner/external) · **WONTFIX** (by design).

| ID | Area | Severity | Status | Summary | Evidence | Next action |
|---|---|---|---|---|---|---|
| DEF-001 | GitHub | P2 | OPEN | `main` has **no branch protection** | `gh api …/protection` → 404 | Owner enable required reviews / no force-push |
| DEF-002 | Vercel env | P2 | BLOCKED | Transactional email env absent (`RESEND_API_KEY`, `STORE_*`, `CRON_SECRET`, `NOTIFY_CUSTOMER_EMAIL`) | Vercel env list (names only) | Owner Resend + DNS + set vars |
| DEF-003 | Theme | Info | WONTFIX (gate) | `THEME_PUBLISHED_ENABLED` unset — public home uses V5 default | Env audit | Separate owner publish decision |
| DEF-004 | COD | Info | WONTFIX (gate) | Public COD disabled (DB + API 403 + UI “opens soon”) | `store_settings.cod_checkout.enabled=false`; live POST 403; checkout heading | Owner policies/fees then enable |
| DEF-005 | Auth | P2 | BLOCKED | Supabase leaked-password protection disabled | Advisors WARN | Owner Auth dashboard toggle |
| DEF-006 | Security advisors | P3 | OPEN | Intentional public SECURITY DEFINER RPCs flagged (quote, confirmation token, homepage sections, staff predicates, availability) | Advisors; prior security matrices | Re-run isolated negative matrices; do **not** revoke without exploit |
| DEF-007 | Security | Info | OPEN | `rate_limit_buckets` RLS on, no policies (service-role only intended) | Advisors INFO | Confirm no anon grants; document |
| DEF-008 | Perf | P3 | OPEN | Auth RLS initplan on `admin_memberships`, `inventory_ledger` | Performance advisors | Optional `(select auth.uid())` rewrite |
| DEF-009 | Content | BLOCKED | BLOCKED | 0 published reels → Generation section hidden | SQL `reels=0`; homepage DOM | Owner videos + rights |
| DEF-010 | Content | BLOCKED | BLOCKED | 0 store testimonials → reviews section hidden | SQL; homepage DOM | Owner genuine reviews + consent |
| DEF-011 | Content | BLOCKED | BLOCKED | Policy/business copy + media rights | Prior handover | Owner inputs |
| DEF-012 | CRM | Info | PASS | `app.laptopshub.pk` → `45.130.228.253`, HTTP 200 | DNS + probe | Do not modify |
| DEF-013 | Browser | — | CLOSED | Shopify + LH admin sessions available | laptopshub-2 + /admin owner | Continue control-by-control matrix |
| DEF-014 | Hygiene | P3 | OPEN | Web Analytics / Speed Insights Plus not enabled | Vercel overview | Optional; no paid upgrade without approval |
| DEF-015 | Local vs prod | P2 | OPEN | Local `feat/merchant-operating-system` may hold unverified closeout commits not on `main` | Branch comparison in progress | Diff before any cherry-pick; never force-push |
| DEF-016 | Inventory | P1 | FIXED (pending deploy) | Desk header counted soft-deleted tracked QA variants (2) while list excluded them → empty “Nothing matches” | Prod SQL: both tracked SKUs on soft-deleted `qa-test-do-not-sell-20261117`; code used `.is(products.deleted_at,null)` only on list | Counts now use same live-product filter; checkout readiness purchasable/tracked counts aligned |
| DEF-017 | Admin UX | P2 | FIXED (pending deploy) | No keyboard shortcut help / G-key navigation vs Shopify | Shopify Settings + Home show Ctrl K + `?` map | Added `AdminShortcuts` (`?` sheet + role-filtered G-nav + modal guard) + isolated e2e |
| DEF-026 | Docs | P1 (process) | FIXED | Audit docs claimed migrations 15–28 pending / “ENGINEERING COMPLETE” | Linked ledger 29/29; PR #10–13 already merged | Corrected `19`/`21`/`18`/`17`; classification → PRODUCTION VERIFIED — MERCHANT INPUTS PENDING |

| DEF-018 | Security | P2 | OPEN | Missing `Content-Security-Policy` header | Live HEAD probe 2026-11-17 | Add via `next.config.js` headers or middleware |
| DEF-019 | Security | P3 | OPEN | Missing `X-Content-Type-Options: nosniff` | Live HEAD probe | Add to security headers config |
| DEF-020 | Security | P3 | OPEN | Missing `X-Frame-Options: DENY` | Live HEAD probe | Add to security headers config |
| DEF-021 | Security | P3 | OPEN | Missing `Referrer-Policy` header | Live HEAD probe | Add `strict-origin-when-cross-origin` |
| DEF-022 | Security | P3 | OPEN | Missing `Permissions-Policy` header | Live HEAD probe | Add restrictive policy |
| DEF-023 | Security | P3 | OPEN | `X-Powered-By: Next.js` exposes technology stack | Live HEAD probe | Set `poweredByHeader: false` in `next.config.js` |
| DEF-024 | Ops | P2 | OPEN | No staging/custom Vercel environment exists | MCP `list_project_custom_environments` → 0 | Owner creates staging Supabase + Vercel env |
| DEF-025 | Content | P1 | BLOCKED | 5 content pages return 404: about, contact, privacy, terms, warranty | Live HTTP probe 2026-11-17 | Owner content + legal review required |
| DEF-026 | Supabase MCP | — | BLOCKED | Supabase MCP permission denied — cannot audit remotely | MCP error `-32600` | Owner authorize via `/mcp` |

## Live smoke (this session, production)

| Check | Result |
|---|---|
| Homepage 200, V5 hero/story | PASS |
| Add to cart → cart badge 1 · Dell 5400 | PASS |
| Checkout shows order summary Rs 49,000 | PASS |
| Checkout gate “Online ordering opens soon”; Place COD disabled | PASS (correct) |
| Map section + Google Maps link | PASS (visible) |
| Reviews / Reels public sections | Absent (correct empty integrity) |

## Notes

- Do not treat empty reviews/reels as engineering defects.
- Do not enable COD or theme publish from this register without owner approval.
- Update this file as each defect is fixed and re-verified.
