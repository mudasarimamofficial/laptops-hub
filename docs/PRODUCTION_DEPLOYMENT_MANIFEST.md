# Production deployment manifest — release 2026-11-16

| Item | Value |
|---|---|
| Branch | `feat/merchant-operating-system` (fast-forward of the remote branch; no force-push) |
| Release commit | see `git log -1` on the PR head (first release commit `2bb58d4`) |
| Currently in production | `cb638b7` (deployed 2026-11-14 from this branch; ancestor of the release) |
| Production branch on Vercel | `main` (last `main` deploy `2b43236`, 2026-10-24) |
| Vercel project | `laptops` · Hobby · Fluid compute · Node 24 |
| Function region | iad1 → **sin1** (`vercel.json` `regions`) |
| Database | Supabase `xvmmjkrkgznnakcobmww` (ap-southeast-1): 14 → **29** migrations (15 pending, `MIGRATION_VERIFICATION.md`) |
| Backup before migration | `D:\LaptopsHub-Backups\2026-11-16-pre-m15-29\` (schema/data/roles + SHA256SUMS), off-repo; take a fresh one on the day |
| Env changes required | **None** for this release. (`THEME_PUBLISHED_ENABLED` stays unset in production → theme defaults; email/cron variables are owner items) |
| Feature flags | COD unchanged (business approvals pending) |
| DNS | No changes. `app.laptopshub.pk` (CRM, `45.130.228.253`) untouched |

## What ships

- Homepage "What our customers say" (hidden until the owner publishes genuine reviews) and "Visit our store" map
  (shown by default on the homepage after the footer).
- Admin: Store testimonials, theme-editor fields for both sections, product bulk selection, faster navigation.
- Database: migrations 15–29 (catalog extensions, theme tables, hardening, reels/reviews, badges, inventory integrity,
  anon-write revoke, zone rules, adjustments, column grants, staff least-privilege, testimonials).

## Verification record

| Check | Result |
|---|---|
| Full isolated suite on release HEAD | `docs/evidence/final-run/summary.json` |
| Migration gates | PASS (`MIGRATION_VERIFICATION.md`) |
| Old code (cb638b7) on the fully migrated schema | see `FINAL_E2E_REPORT.md` |
| Preview build + region | see PR |
| Production migrations applied | pending owner approval |
| Production deploy | pending owner approval |
| Live QA | pending deploy |
