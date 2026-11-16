# Production deployment manifest — release 2026-11-16

| Item | Value |
|---|---|
| Branch | `feat/merchant-operating-system` (fast-forward of the remote branch; no force-push) |
| Release commit | `dc0180b` (code `2bb58d4` + tests/docs); PR https://github.com/mudasarimamofficial/laptops-hub/pull/10 |
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
| Old code (cb638b7) on the fully migrated schema | 20/20 (`docs/evidence/migrations/old_code_compat.json`) |
| Preview build + region | `dpl_9gqgYg4ZPH33hyZhCaaGAuvaVn6i` READY, target preview (not production), regions `[sin1]`, `x-vercel-id …::sin1::`; home, PDP, collection, search, checkout page, admin login, sitemap, robots 200; map renders, reviews hidden |
| Production migrations applied | 15–29 applied 2026-11-16 (owner approval); 29/29; `docs/evidence/migrations/prod_apply_2026-11-16.txt` |
| Production deploy | PR #10 merged → `772276b` → `dpl_ErqN6evfpCNXoidJrp5xGVAqiDnC` (2026-11-16); PR #11 a11y fix → `7e406df` → `dpl_2XLaqxjUnsWb8FGrT6TgmTaUJ8KQ` (2026-11-17, current), sin1, apex + www |
| Live QA | `LIVE_QA_REPORT.md` — sitemap 267/267, 78/78 browser checks; authenticated admin not exercised |
