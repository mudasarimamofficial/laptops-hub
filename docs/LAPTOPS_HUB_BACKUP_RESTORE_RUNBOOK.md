# Laptops HUB — Backup and Restore Runbook

**Updated:** 2026-11-16 · Applies to the Supabase database (`public` + `auth` schemas) and the Vercel deployment.
**Nothing here has been run against production.** Every production step needs the owner's explicit approval.

## What must be protected

| Asset | Where it lives | Backup method |
|---|---|---|
| Orders, order items, addresses, COD collections, inventory ledger, catalog, content, settings, staff memberships | Supabase Postgres `public` | Supabase daily backups + manual `pg_dump` before any migration |
| Staff logins (Auth users) | Supabase Postgres `auth` | Same dump (`-n auth`) |
| Product images | External CDN URLs referenced in `product_media.url` (not stored in Supabase Storage) | Not covered by a DB dump; keep the CDN account |
| Reel videos | Supabase Storage bucket `reels` (local tests only so far) | Download the bucket before deleting a project |
| Code | GitHub `mudasarimamofficial/laptops-hub` | Git history; the release commit is named in `LAPTOPS_HUB_FINAL_RELEASE_MANIFEST.md` |
| Environment variables | Vercel project settings (values never in the repo) | Owner keeps a private copy of names → values |

## 1. Before every production migration or risky change

1. Supabase Dashboard → Database → Backups: confirm a backup **newer than one hour** exists. If not, wait for one or take
   the manual dump below.
2. Manual dump (owner's machine, database password from the Supabase dashboard; never commit the file):
   ```bash
   pg_dump "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" -n public -n auth -Fc -f lh_$(date +%Y%m%d_%H%M).dump
   ```
3. Record row counts of `orders`, `order_items`, `products`, `product_variants` (the runbook's stop condition compares them):
   ```sql
   select (select count(*) from orders) orders, (select count(*) from order_items) items,
          (select count(*) from products) products, (select count(*) from product_variants) variants;
   ```
4. Store the dump off-repo (encrypted drive / password manager attachment). `.gitignore` already excludes `*.dump`,
   `*.sql.gz` and ZIP archives, but do not rely on that.

## 2. Restore (only after deciding with the owner)

**Prefer Supabase's point-in-time / daily restore** (Dashboard → Database → Backups → Restore) — it restores the whole
project, including Auth and Storage metadata, and is the supported path.

Manual restore of a dump into a **new scratch database first** (never straight over production):
```bash
createdb -h <host> -U postgres lh_restore_check
pg_restore -h <host> -U postgres -d lh_restore_check --exit-on-error lh_YYYYMMDD_HHMM.dump
```
Then compare row counts and spot-check a few orders before pointing anything at it.

Rolling back a single migration: see `LAPTOPS_HUB_MIGRATION_COMPATIBILITY_MATRIX.md` (Rollback column). Additive
migrations are left in place rather than dropped; function replacements are rolled back by re-applying the previous body
from the earlier migration file.

## 3. Rehearsal (local, repeatable)

```bash
bash scripts/rehearsal/migration-upgrade.sh     # all migrations on an empty DB vs. 14 + data + pending: schema/grants identical
bash scripts/rehearsal/backup-restore.sh        # dump public+auth → restore into scratch DB → per-table counts + md5 identical
```
Both refuse nothing outside the local Docker container (they use `docker exec` on `supabase_db_Laptops_Hub_Vercel_Development`)
and remove the dump and scratch databases afterwards. Latest results: `docs/evidence/migrations/` (see the run date in
`restore_run.txt` / `upgrade_run.txt`).

## 4. Vercel rollback

Vercel → Deployments → pick the previous Production deployment → **Promote to Production** (instant, no rebuild).
A code rollback does **not** roll back the database: if the new code needs a migration (matrix "Ship with" rows), roll
back the code only to a deployment that is compatible with the migrations already applied.

## 5. Who may do what

| Action | Who |
|---|---|
| Take a backup, read counts | Owner or an engineer with the owner's go-ahead |
| Apply a migration, restore, promote a deployment | Owner's explicit written approval for that specific action |
| Delete a Supabase project or backup | Owner only |
