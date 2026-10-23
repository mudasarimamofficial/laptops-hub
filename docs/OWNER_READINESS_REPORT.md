# Laptops HUB — owner readiness report

Date: 2026-10-23 · Branch `fix/v5-correctness-parity` (draft PR #2, stacked on draft PR #1) · **Not production-ready:
release gates D, E and F are not passed.**

Legend: **Verified** = tested this pass with evidence · **Done (owner-approved)** = executed with your approval ·
**Proposed** = prepared, awaiting your decision · **Blocked** = needs information or a decision from you.

## 1. Completed engineering work (verified)

| Area | Status | Evidence |
|---|---|---|
| V5 storefront (header, hero/story, 10 home sections, cards, collections, PDP, cart, compare, search, 404) | Verified | visual parity run 2026-10-23 (section 8), e2e 39 passed |
| V5 content templates (13 pages, guides index, 4 articles, FAQ, contact form) on the CMS model | Verified | content parity run, e2e, role HTTP suite |
| Catalog from live Supabase (226 public of 232, drafts hidden, 964 media) | Verified | data parity 0 mismatches in every field; 226/226 PDPs 200, 6/6 drafts 404, 39/39 collection routes |
| Contact form → real `contact_inquiries` insert, origin check, rate limit, honeypot | Verified | unit tests; real insert through the route on local Supabase; e2e mocks the API (no production inbox writes) |
| Staff auth and role enforcement on every admin page/API | Verified | auth matrix 24/24 (production, read-only), role HTTP 97/97 (local) |
| CMS publication gates (status, legal approval, template approval, sitemap/noindex) | Verified | unit + role HTTP suites |
| COD checkout (server-priced, idempotent, gated off) | Verified locally | checkout isolated 25/25 incl. forged prices, races, conflicts |
| COD cash collection (atomic, exactly-once, conflict-safe) | Verified locally | collection matrix 16/16 ×8 |
| Security: staff RPC exposure | **Done (owner-approved)** — Option A on production | `docs/MIGRATION_PRODUCTION_APPROVAL.md` |
| Accessibility | Verified (automated) | axe: 0 WCAG A/AA violations on 10 routes |
| SEO host fix + pre-launch (noindex) switch | Verified locally | unit test; local build with `SITE_PRELAUNCH=1` |

## 2. Remaining database and application changes

| Item | Status | Where |
|---|---|---|
| Option B: 6 migrations (explicit grants, idempotency fixes, least-privilege defaults, server-only guard, shipping-quote fix) | **Proposed** — audited, push path + injected failure + rollback tested | `docs/MIGRATION_PRODUCTION_APPROVAL.md` |
| Shipping quote broken once a zone exists (production function bug) | Fixed in `20261023170000` (pending, part of Option B) | `docs/SECURITY_RPC_REVIEW.md` #6 |
| Contact form rejected same-site posts when the server sees another host name | Fixed on branch (origin check accepts the request Host); production impact not observable without a real submit | `src/lib/validation/contact.ts` |
| Sitemap/robots point at the SSO-protected deployment host on production | Fixed on branch; live after next production deployment | `docs/PUBLIC_SITE_PLAN.md` |
| Pre-launch mode (noindex while gates are open) | **Proposed** (env var, default off) | `docs/PUBLIC_SITE_PLAN.md` Plan A1 |
| Inquiry-only listings (products without a purchasable variant) | **Proposed**, not applied | `docs/proposals/AVAILABILITY_INQUIRY_ONLY.md` |
| Internal wording in stored descriptions (raw API) | **Proposed**, not applied | `docs/proposals/DESCRIPTION_CLEANUP.md` |
| Staff invite / deactivate UI | Not built (planned in role matrix) | `docs/ADMIN_ROLE_MATRIX.md` |
| Tighten anon write grants on non-public tables (RLS already blocks) | Future hardening | `docs/SECURITY_RPC_REVIEW.md` |

## 3. Current production state (read-only, 2026-10-23)

- **Website** `laptops-hub.vercel.app`: your redeploy of `34f9839` (this branch). Pages 200, content gated, COD 403,
  admin → login, no runtime errors. Public and **indexable**; shows catalog photos (rights not yet confirmed).
- **SEO defect**: sitemap/robots advertise the protected deployment host (fixed on branch, needs a deployment).
- **Database**: ledger 7 (Option A applied). 232 products (226 active, 6 draft), 964 media, 16 collection rows,
  13 content pages (0 published), 0 articles, 0 FAQ rows, 0 shipping zones, 0 orders, 0 inquiries,
  `cod_checkout.enabled = false`.
- **Staff**: 1 auth user with an active **manager** membership; **no owner** membership.
- Future objects created by migrations are still auto-exposed until Option B (`20261023140000`).
- The shipping quote RPC fails as soon as a zone is added (fixed in pending `20261023170000`): **apply Option B before
  configuring shipping zones.**

## 4. Migration approval checklist (Option B)
- [ ] Read `docs/MIGRATION_PRODUCTION_APPROVAL.md` (Option B section and audit)
- [ ] Schema backup taken (`supabase db dump --linked`)
- [ ] Dry run lists exactly the 5 files
- [ ] Quiet period chosen
- [ ] Post-checks listed in `docs/RELEASE_PLAN.md` Stage 1 pass
- [ ] Decision recorded: approve / do not approve

## 5. PR review and merge sequence
1. Review **PR #1** (`feat/v5-storefront-admin → main`) → merge commit.
2. PR #2 retargets to `main` → CI → review → merge.
3. Merging to `main` builds Production (production branch). Decide pre-launch mode first (section 3, Plan A1).
Never open `fix/... → main` while #1 is open; never squash the stack.

## 6. Business information needed (Blocked — do not let anyone invent these)
- **Contact**: legal business name, phone, WhatsApp, email, opening hours, address/showroom (if public), who reads
  `contact_inquiries` and the response time.
- **Shipping**: served provinces/cities, couriers, delivery times, flat fee and COD fee per zone, free-shipping
  thresholds (if any), damage/claim handling, tracking. Configured in admin → Settings → Shipping zones (0 today;
  checkout cannot work without at least one zone).
- **Returns/refunds**: window, eligible reasons, condition, who pays return shipping, refund method and timing,
  exchanges.
- **Warranty**: length, covered parts, exclusions, claim steps, remedy.
- **Condition guide**: grade names and inspection steps actually performed.
- **Privacy**: data controller, data collected, processors (hosting: Vercel, database: Supabase, couriers), retention,
  rights, cookies. Shopify is **not** a current processor (it was only the catalog export source).
- **Terms**: seller identity, pricing/currency, order acceptance, COD rules, cancellation, liability, governing law.
- **About / Why Laptops HUB**: approved story and the service commitments you actually make.
Per-page checklists: `docs/OWNER_CONTENT_NEEDS.md`. Publishing: pages with "being finalised" sections need written
copy; policy pages also need legal approval (owner/admin/manager).

## 7. Media rights (Blocked)
- [ ] Rights to the 964 catalog images (currently public on the live site)
- [ ] Rights to the V5 hero/story cutouts (not deployed; `V5_CUTOUT_BASE` unset) — see `docs/MEDIA_RIGHTS_CUTOUTS.md`
- [ ] Note: earlier cutout files remain in public Git history; removing them needs a history rewrite you approve

## 8. Visual parity (V5)
See section "Visual parity run 2026-10-23" in `docs/V5_PIXEL_DIFF_REPORT.md`.

## 9. Staff accounts and admin onboarding (Blocked)
- [ ] Decide who is **owner** (none today). Bootstrap (one-time, SQL editor, by you):
  `insert into admin_memberships (user_id, role, is_active) values ('<auth user id>', 'owner', true) on conflict (user_id) do update set role='owner', is_active=true;`
  after the person has signed up / been invited in Supabase Auth.
- [ ] Names and roles for admin / manager / editor / fulfillment staff (role matrix: `docs/ADMIN_ROLE_MATRIX.md`)
- [ ] Review the existing manager account (1 user) is intended
- [ ] Staff training: orders, status transitions, COD collection (one key per collection; conflicts mean "already
  recorded"), CMS publish vs legal approval

## 10. COD activation prerequisites (all required, in order)
1. Option B applied and verified (includes the shipping-quote fix).
2. Policies published (shipping, returns, warranty, terms, privacy) with legal approval.
3. Contact details published; inquiry inbox owner named.
4. At least one active shipping zone with real fees.
5. Owner account + fulfillment staff onboarded.
6. Media rights confirmed (or offending images replaced).
7. Separate explicit approval: `COD_CHECKOUT_ENABLED=true` and `NEXT_PUBLIC_COD_CHECKOUT_ENABLED=true` (Production),
   `store_settings.cod_checkout.enabled=true`, redeploy, one owner test order end-to-end, then cancel it.

## 11. Rollback and incident response
`docs/RELEASE_PLAN.md` (stages 1–3 rollback, incident playbook). Fastest kill switches: COD — set
`store_settings.cod_checkout.enabled=false` (no deploy); web — Vercel Instant Rollback; DB privileges — targeted
revoke.

## 12. Final production acceptance checklist
- [ ] Gate A Source integrity — PR #1 and #2 reviewed and merged in order
- [ ] Gate B Visual parity — accepted by owner (differences documented)
- [ ] Gate C Functional — e2e, admin flows with real staff accounts, contact inbox
- [ ] Gate D Data/security — Option B applied and post-checks pass
- [ ] Gate E Business — sections 6, 7, 9 complete
- [ ] Gate F Release — production deployed from `main`, smoke tests pass, pre-launch mode removed, COD decision
