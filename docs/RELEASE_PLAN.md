# Staged release plan (prepared, NOT executed)

Prepared 2026-10-23. Every step marked **[owner]** needs explicit owner approval at the time it is executed. COD stays
disabled throughout (`COD_CHECKOUT_ENABLED` / `NEXT_PUBLIC_COD_CHECKOUT_ENABLED` false, `store_settings.cod_checkout`
false). Nothing here publishes content, approves policies or exposes unapproved media.

## Current baseline (verified 2026-10-23)
| | |
|---|---|
| Production web | `laptops-hub.vercel.app` → `dpl_DEGy9tXzDaDJoiFV3AbsT19SHcbH` = owner redeploy of `34f9839` (this branch) |
| Production DB | `xvmmjkrkgznnakcobmww`, ledger 13 — Option A and Option B applied 2026-10-23 |
| Code ↔ DB compatibility | this branch works with the DB **before and after** Option B (Preview on the same DB; Option B verified locally) |
| PRs | #1 `feat/v5-storefront-admin → main` (draft) · #2 `fix/v5-correctness-parity → feat/v5-storefront-admin` (draft) |

## Stage 0 — before anything (engineering, no approval needed)
1. PR #2 CI green; Preview of the head commit verified (`docs/DEPLOYMENT_REPORT.md`).
2. `supabase migration list --linked` and `supabase db push --linked --dry-run` list exactly the six Option B files (`20261023120000` … `20261023170000`).
3. Read-only drift check (`docs/MIGRATION_PRODUCTION_APPROVAL.md`, "Option B audit"): no differences except line endings.

## Stage 1 — database: Option B **[owner]** — ✅ DONE 2026-10-23 (owner-approved; outcome in `docs/MIGRATION_PRODUCTION_APPROVAL.md`)
Order matters only within Option B (the CLI applies files in version order, one transaction per file).
1. Schema-only backup: `supabase db dump --linked -f backups/schema-before-option-b.sql` (store outside git).
   Optional data safety: the change touches no rows; a Supabase dashboard backup point is sufficient.
2. Privilege snapshot: run the ACL and default-ACL queries from `docs/MIGRATION_PRODUCTION_APPROVAL.md` and save the
   output (before).
3. `supabase db push --linked` (applies `20261023120000` → `20261023170000`). Quiet period recommended (grants and
   function replacement take brief locks; no data is rewritten).
4. Post-checks (read-only) — all must pass:
   - ledger shows 13 versions; `db push --dry-run` reports nothing to push;
   - ACL: anon/authenticated EXECUTE false on the four server-only functions; column `content_pages.legal_approved_by`
     not selectable by anon; default ACL for `postgres` in `public` grants only `postgres`/`service_role`; global
     `postgres` function default has no PUBLIC EXECUTE;
   - anon probes: staff RPCs and `consume_rate_limit` → 42501; `quote_cod_shipping` with an address returns
     `ok`/`unserviceable` (no `cannot cast` error);
   - `npm run test:security:p0` 9/9, `npm run test:security:auth-matrix` 24/24 (against production);
   - storefront smoke: home, a PDP, `/collections/laptops`, `/pages/contact`, `/sitemap.xml`; Vercel runtime errors
     for the production deployment: none new.
5. Failure handling: a failing file is rolled back by itself; earlier files stay applied, later ones are not run.
   Every intermediate state was verified safe (staff RPCs stay closed by Option A). Fix the cause, then re-run
   `supabase db push --linked` (it continues with the remaining files). Do not edit an applied migration.
6. Rollback (only if the application breaks and a targeted grant does not fix it):
   `supabase/rollback/option_b_rollback.sql` (tested locally: returns exactly to the Option-A-only privilege state and
   function bodies), then `supabase migration repair --status reverted <the six versions> --linked`.
   Limitation: the rollback re-opens the weaknesses Option B closed (future-object exposure, no in-function guard,
   idempotency replays); prefer a forward fix.

## Stage 2 — code review and merge **[owner]**
1. Review PR #1 (`feat/v5-storefront-admin → main`). Merge (merge commit, no squash, to keep the stack intact).
2. GitHub retargets PR #2 to `main`; re-run CI; review PR #2; merge.
3. Merging to `main` triggers a **Production** build if `main` is the production branch (it has been: `18804fa`).
   If the owner does not want that build live yet, set Plan A1 (`SITE_PRELAUNCH=1`) beforehand or pause automatic
   production deployments in Vercel first.

## Stage 3 — production web deployment **[owner]**
1. Environment (Production), names only: `COD_CHECKOUT_ENABLED=false`, `NEXT_PUBLIC_COD_CHECKOUT_ENABLED=false`,
   `V5_CUTOUT_BASE` unset, `V5_CONTENT_PREVIEW` unset, optional `SITE_PRELAUNCH=1` (Plan A1), optional `SITE_URL` when a
   custom domain exists.
2. Deploy the merged `main` commit (Git integration) — the same tree as the verified Preview.
3. Smoke tests (no customer records created): routes, `/sitemap.xml` host = `laptops-hub.vercel.app` (or `SITE_URL`),
   robots, COD POST → 403, `/admin` → login, content gated, console sweep, `PLAYWRIGHT_BASE_URL=<prod> npx playwright
   test tests/e2e` (read-only; contact submit is mocked).
4. Rollback: Vercel Instant Rollback to `dpl_DEGy9tXzDaDJoiFV3AbsT19SHcbH` (works with the DB before and after
   Option B).

## Stage 4 — business go-live **[owner]** (blocked today)
Requires `docs/OWNER_READINESS_REPORT.md` items: content + legal approvals, media rights, shipping zones/fees,
staff accounts, contact inbox, COD procedure. Then, in this order: publish approved pages → configure shipping zones →
staff onboarding → unset `SITE_PRELAUNCH` → (separate approval) enable COD in Vercel env **and**
`store_settings.cod_checkout`, redeploy, place one owner test order end-to-end and cancel it.

## Incident response (any stage)
- Web regression: Instant Rollback to the previous production deployment; then investigate on a Preview.
- Security exposure: revoke first (targeted `revoke` statement, as in Option A), investigate after.
- Order/COD anomaly: set `store_settings.cod_checkout.enabled=false` (immediate, no deploy) and
  `COD_CHECKOUT_ENABLED=false`; review `orders`, `cod_collections`, `audit_logs`.
- Contact: owner (decision maker) and whoever holds Supabase/Vercel admin access — to be named by the owner.
