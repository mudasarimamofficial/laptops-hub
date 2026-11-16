# Production release runbook — release 2026-11-16 (`feat/merchant-operating-system`)

Facts this runbook relies on (checked 2026-11-16):

- Vercel project `laptops` (Hobby). Production branch **`main`**; domains `laptopshub.pk` → 308 → `www.laptopshub.pk`.
  The **current production deployment is `cb638b7` from `feat/merchant-operating-system`** (promoted 2026-11-14), not
  `main` (`2b43236`, 2026-10-24). This release's HEAD contains `cb638b7` (fast-forward).
- Functions run in iad1 today; this release sets `vercel.json` `regions: ["sin1"]` (DB is Singapore).
- Supabase production: 14/29 migrations applied. Production env has no `THEME_PUBLISHED_ENABLED` (theme defaults
  are used), no email provider or `CRON_SECRET` (notification email not configured), COD flags present.
- DNS on Vercel nameservers. `app.laptopshub.pk` → `45.130.228.253` (the CRM on Hostinger) — **do not change**.
  No MX / SPF / DMARC / Resend DKIM records exist.

## Order of operations

1. **Gates green** — full isolated suite (`scripts/release/run-final-suite.sh`) PASS on this HEAD; migration gates in
   `MIGRATION_VERIFICATION.md` PASS; old-code compatibility smoke (cb638b7 against the fully migrated schema) PASS.
2. **Push** the feature branch (fast-forward, never force). Vercel builds a protected Preview; check it builds, that
   `x-vercel-id` shows `sin1` (`vercel curl`), and that public pages render.
3. **Fresh backup** of production (same day, off-repo) — commands in `MIGRATION_VERIFICATION.md`.
4. **Apply migrations 15 → 29** (`supabase db push --linked --dry-run` must list exactly those 15, in order; then
   apply). The live cb638b7 code keeps working on the new schema (step 1 smoke).
5. **Post-migration checks** (read-only): `migration list` shows 29; anon cannot write to catalog tables (REST POST →
   401/403); storefront home, a product page, a collection, contact page render 200; COD still not offered.
6. **Deploy the code**: open the PR into `main`; production deploys from `main` on merge. If branch protection or a
   required review blocks the merge, alternatively promote the verified Preview (same commit) to production.
7. **Live QA** (`FINAL_E2E_REPORT`, live section): routes, headers (`sin1`), sitemap/robots, map, reviews section absent
   until published, admin sign-in page, COD disabled, no console errors.
8. **Rollback**:
   - Code: promote the previous production deployment (`cb638b7`) in Vercel → Deployments → ⋯ → Promote.
   - Database: migrations 15–29 add tables/columns/policies; the previous code runs on the new schema, so a code
     rollback does not require a DB rollback. A DB restore from the backup is only for data damage.

## Never

- `npm run db:push` / `db reset` / fixture scripts while linked to production without going through steps 3–4.
- Changing nameservers, pointing `app.laptopshub.pk` at Vercel, or guessing Hostinger records.
- Enabling COD (`COD_CHECKOUT_ENABLED`, `store_settings.cod_checkout`) — needs the business approvals listed in
  `FINAL_CLIENT_HANDOVER.md`.
- Force-pushing or rewriting `main`.
