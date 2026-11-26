# 24 — LH-025 Option A: repair plan and execution record (2026-11-26)

> ## EXECUTED ON PRODUCTION 2026-11-26, WITH THE OWNER'S EXPLICIT APPROVAL OF §7 — see §10
> §1–§9 are the plan as approved. While the plan was being prepared, every production command was read-only: `migration list`, `SELECT` queries and
> `db dump` (schema-only, or data-only for the ledger table). No production ledger row, schema object or data row
> was written. The repair, the new migration and the restore were run only on an isolated local rehearsal database.
>
> Note: each `--linked` CLI command prints "Initialising login role...". The CLI refreshes its own temporary login
> credential through the Supabase Management API. That is connection plumbing, not a ledger, schema or data change.

Owner choice: **Option A** from `21_MIGRATION_LEDGER_RECONCILIATION.md` §6. Repair the ledger, then restore the two
missing `order_items` column comments through a new forward-only migration.

## 1. Reconfirmation (fresh, 2026-11-26)

| Check | Result |
|---|---|
| Project | `supabase/.temp/project-ref` = `xvmmjkrkgznnakcobmww`; `supabase projects list`: "Laptops Hub", ACTIVE_HEALTHY, ap-southeast-1 |
| GitHub main | local `main` = `origin/main` = `8a6e5a49b61751f4f09c5f809caa3523c898be07` |
| CLI | Supabase CLI 2.108.0. No GitHub workflow runs `db push`, `migration` or `reset` |
| Migration list | 38 matched; remote-only `20261118095223`, `20261118123619`, `20261118134801`, `20261123095218`; repo-only `20261118143000`, `20261118160000`, `20261118190000`, `20261123120000`. Same as 24 and 25 Nov |
| Ledger | 42 rows, versions `20261021120000`…`20261124120000`, row-text md5 `35d15d16484d93d67210e3a345b6fe19` |
| Recorded SQL vs repo | Pairs 1–3: identical after removing `--` comments and whitespace. Pair 4: the repo file additionally has the `create_cod_order` discount patch with its REVOKE/GRANT, plus the 2 `COMMENT ON COLUMN` statements |
| Live schema parity (116-key targeted fingerprint; functions compared with CR stripped) | Production equals the repo-built local database except: (a) the 2 `order_items` column comments are NULL on production; (b) `cms_media_assets` is absent locally because the local stack runs without Storage. `cms_media_assets` was checked against the repo file instead: same columns, index, policy, comment and RLS. `create_cod_order`, `active_automatic_discount`, `unit_selling_paisa` and `touch_keepalive` are identical, including security-definer, `search_path`, owner and grants |
| Drift since 24 Nov | None. The raw `create_cod_order` md5 is unchanged (`f6f4a1bf…`); the CR-stripped md5 (`f55a68ce…`) equals the repo's |

## 2. Ledger export (outside the repository)

Location: `C:\Users\mudas\Documents\LaptopsHub-private\lh025-2026-11-26\`. This is local-only: the Windows Documents
folder that OneDrive syncs is a different path. It is **not** in git, because rows contain the owner's account email in
`created_by`. Copy the folder to client-owned encrypted storage before execution.

| File | What | SHA-256 |
|---|---|---|
| `ledger_data.sql` | `supabase db dump --linked --data-only --use-copy --schema supabase_migrations` (exact COPY of all 6 columns, 42 rows) | `5cefcfec3c1970bd52b28583cfe847c64be7d9da612a4469038f534dd863fac9` |
| `ledger_rows.json` | `SELECT version, name, statements, created_by, idempotency_key, rollback … ORDER BY version` | `67245c4e6b1281d80be5738f24a3eae56474a7560d1f1f8087c4421c62b453d0` |
| `ledger_schema.sql` | Exact DDL of `supabase_migrations.schema_migrations` (PK `version`, UNIQUE `idempotency_key`) | `ae56295c7e66a8b46ab50df6f00cf57f7866f2478a17fbe3910d9def39e836ab` |
| `ledger_fingerprint.json` | Server-side: 42 rows, md5 `35d15d16…` | `dd61b35be0471c6aebe444e954a381226a7f74a5f8fd5d0d7e50e0c758d8bec7` |
| `ledger_restore.sql` | Restore procedure (§3) | `d25b20cce8ee510ba68162bf1076d9f9a0a888c94194572531868c458e0e88f3` |
| `prod_schema.sql` | `supabase db dump --linked` schema-only snapshot of production before the change (no row data) | `81e0505f8ce7973966006633a9f2ed6962b44b7ac269c02a8cfe66a182f82147` |

`SHA256SUMS.txt` covers all 26 files in the folder, including the rehearsal evidence; `sha256sum -c SHA256SUMS.txt`
reports 26/26 OK.

**Export verified.** Both forms were loaded into a throwaway local database. Each reproduced exactly 42 rows with the
production row-text md5 `35d15d16484d93d67210e3a345b6fe19`, which covers every column of every row, including the
original `statements`, `created_by`, `idempotency_key` and `rollback` values.

## 3. Restoration procedure (recreates the original rows, not just version numbers)

`ledger_restore.sql` is **one** atomic `DO` statement. It:

1. locks the ledger table;
2. deletes every row;
3. re-inserts the 42 exported rows, all 6 columns, from the embedded JSON;
4. recomputes the count and row-text md5.

If the result is not exactly `42` / `35d15d16484d93d67210e3a345b6fe19`, it raises an exception and nothing changes.
It touches only `supabase_migrations.schema_migrations`.

```
npx supabase db query --linked -f "C:\Users\mudas\Documents\LaptopsHub-private\lh025-2026-11-26\ledger_restore.sql"   # WRITE (ledger only)
```

Fallback, if the CLI is unavailable: run the same file with `psql` using the owner's database connection string.

## 4. The Option A migration

Branch `chore/lh025-option-a-comment-migration-2026-11-26`, created with
`npx supabase migration new order_items_discount_column_comments`:
`supabase/migrations/20261126022136_order_items_discount_column_comments.sql`.

```sql
COMMENT ON COLUMN public.order_items.unit_list_price_paisa IS 'Catalog list price at order time (paisa). unit_price_paisa is the charged selling price.';
COMMENT ON COLUMN public.order_items.line_discount_paisa IS 'Per-line savings: (list - selling) * quantity.';
```

- The comment text is byte-identical to `20261123120000_discount_campaigns_and_pricing.sql` lines 47–48.
- The version `20261126022136` is later than every remote version, so `db push` accepts it without `--include-all`.
- `COMMENT ON` writes only `pg_description`. It cannot change rows, functions, campaigns, orders, customers or
  financial calculations, and it is safe to re-run.

## 5. Rehearsal on an isolated copy

Database `lh025_rehearsal` was built on the local Docker Postgres. It is not the incomplete local app stack.

- **Public schema:** production's real public schema from `prod_schema.sql` (29 functions, 36 tables). No customer rows.
- **Supporting schemas:** local skeletons of `auth`, `storage`, `extensions` and `vault`.
- **Ledger:** the exact production ledger from `ledger_data.sql`, including the 4 remote-only rows.

A whole-schema fingerprint (932 keys: every public function, column, constraint, index, policy, RLS flag, ACL,
trigger, comment, enum, plus ledger count and md5) was run on both the rehearsal database and live production. The
two were **identical**, apart from one `storage.objects` policy that comes from the Storage schema and is not part of
this repair.

All commands ran with `--db-url postgresql://postgres:postgres@127.0.0.1:54322/lh025_rehearsal`.

| Step | Command | Result |
|---|---|---|
| R0 | `migration list` | Same 4 pairs as production, plus `20261126022136` local-only |
| R0b | `db push --dry-run` (before repair) | Refused: "Remote migration versions not found in local migrations directory" |
| R1 | `migration repair --status reverted 20261118095223 20261118123619 20261118134801 20261123095218` | "Repaired … => reverted" |
| R2 | `migration repair --status applied 20261118143000 20261118160000 20261118190000 20261123120000` | "Repaired … => applied"; ledger still 42 rows |
| — | Fingerprint after repair | Only the ledger md5 changed; 932 schema keys unchanged (the repair executed no SQL) |
| R3 | `migration list` | 42 aligned pairs, plus `20261126022136` local-only |
| R4 | `db push --dry-run` | **"Would push these migrations: • 20261126022136_order_items_discount_column_comments.sql"** and nothing else |
| R5 | `db push` | "Applying migration 20261126022136…"; finished |
| — | Fingerprint after push | Exactly 4 keys changed: 2 `order_items` column comments added; ledger 42→43 rows (and its md5) |
| — | `pg_stat_user_tables` insert/update/delete counts (36 public tables) | 0 / 0 / 0 before and after |
| R6 | `migration list` | 43 aligned pairs |
| R7 | `db push --dry-run` | "Local database is up to date" |
| T1 | Restore with a deliberately wrong expected md5 | Raised "restore verification failed"; ledger unchanged (43 rows) |
| T2 | `db query -f ledger_restore.sql` | Ledger back to 42 rows, md5 `35d15d16…` (byte-identical to the export) |
| T3–T4 | `migration list` / `db push --dry-run` | The original 4 pairs again; push refuses as before |
| Run 2 | Full repeat from a pristine copy | Identical end state to run 1 (0 fingerprint differences) |

The restore puts back the ledger rows only. The two comments stay, which is harmless; §8 shows how to clear them if
wanted.

Expected ledger rows after the repair when executed from this checkout. The statements md5 depends on the files'
line endings in the checkout:

```
20261118143000 articles_public_respect_scheduled_for stmts=3
20261118160000 cms_media_assets_and_storage           stmts=9
20261118190000 reels_external_media_and_presets       stmts=16
20261123120000 discount_campaigns_and_pricing         stmts=27
20261126022136 order_items_discount_column_comments   stmts=2
```

Limits of the rehearsal:

- It connected directly (`--db-url`). Production uses `--linked`, the same CLI repair/push code through the Supabase
  pooler.
- It held no customer rows; the zero insert/update/delete counts and the comment-only file are the evidence that no
  data changes.
- The Management API path of `db query --linked` was not exercised for the restore. The restore is a single statement,
  which is what that path runs.

## 6. Backups on Supabase Free

- **What Supabase Free includes:** per Supabase's backups documentation and pricing page (read 2026-11-26), Free has
  **no automatic backups and no PITR**. Daily backups start on Pro, and PITR is a paid add-on. Supabase advises Free
  projects to export regularly with `supabase db dump` and keep off-site copies.
- **Storage files:** database backups never include Storage files.
- **What protects this repair:** the change touches only ledger rows and two `pg_description` entries. The verified
  ledger export (§2), the self-verifying restore (§3) and the pre-change schema-only snapshot (`prod_schema.sql`) fully
  cover it. That is why no full data dump is required for this repair.
- **What remains an owner decision (D2):** a full production backup means `supabase db dump --linked` (schema),
  `--data-only` and `--role-only`. It contains customer names, phones and addresses, so it must go to client-owned,
  encrypted storage. No such dump has been taken.
- **The merchant CMS backup is not a database backup.** Admin → Settings → Backups (`merchant_snapshots`) covers
  theme/content settings only. It does not contain orders, customers, products, the migration ledger or the schema.

## 7. Production execution sequence (run only after explicit approval)

Commands marked **WRITE** change production; everything else is read-only. Run them from the repository root on `main`
after the PR is merged. Stop at the first unexpected result.

| # | Command | R/W | Expected; stop if different |
|---|---|---|---|
| 0 | Merge PR for branch `chore/lh025-option-a-comment-migration-2026-11-26`; `git switch main && git pull` | GitHub write (deploys the app unchanged; no DB effect) | `ls supabase/migrations \| wc -l` = 43; newest `20261126022136_…` |
| 1 | `cat supabase/.temp/project-ref` | READ | `xvmmjkrkgznnakcobmww` |
| 2 | `npx supabase migration list --linked` | READ | 38 matched + the 4/4 pairs + `20261126022136` local-only |
| 3 | `npx supabase db query --linked "select count(*), md5(string_agg(t::text, E'\n' order by version)) from supabase_migrations.schema_migrations t"` | READ | `42`, `35d15d16484d93d67210e3a345b6fe19`. If different, STOP: the ledger changed and must be re-exported |
| 4 | Re-export as in §2 into a new dated private folder and record checksums | READ | Same 42 rows |
| 5 | `npx supabase db query --linked "select col_description('public.order_items'::regclass, attnum) from pg_attribute where attrelid='public.order_items'::regclass and attname in ('unit_list_price_paisa','line_discount_paisa')"` | READ | 2 × NULL |
| 6 | `npx supabase migration repair --linked --status reverted 20261118095223 20261118123619 20261118134801 20261123095218` | **WRITE** (deletes 4 ledger rows) | "Repaired … => reverted" |
| 7 | `npx supabase migration repair --linked --status applied 20261118143000 20261118160000 20261118190000 20261123120000` | **WRITE** (inserts 4 ledger rows; executes no SQL) | "Repaired … => applied" |
| 8 | `npx supabase migration list --linked` | READ | 42 aligned + `20261126022136` local-only |
| 9 | `npx supabase db push --linked --dry-run` | READ | Exactly one line: `20261126022136_order_items_discount_column_comments.sql`. Anything else: STOP, do not push, and restore (§8) |
| 10 | `npx supabase db push --linked` (answer `y` only after reading the one-item list; no `--include-all`) | **WRITE** (2 COMMENT statements + 1 ledger row) | "Applying migration 20261126022136…" |
| 11 | `npx supabase migration list --linked`; `npx supabase db push --linked --dry-run` | READ | 43 aligned; "Remote database is up to date" |
| 12 | Repeat query 5; run `fp_full.sql` and compare with the pre-change production fingerprint | READ | Both comments set; only the 2 comment keys and the ledger keys differ |
| 13 | Storefront and admin smoke checks (home, a product, `/checkout`, `/admin/login`) | READ | 200 / expected redirects |

There are three production writes (steps 6, 7 and 10). Between steps 6 and 7 the ledger briefly holds 38 rows; the
application never reads the ledger. No `--include-all`, `db reset`, `db pull` or historical replay is used.

## 8. Recovery

| Situation | Action |
|---|---|
| Step 6 or 7 fails, or step 8/9 is unexpected | Run the §3 restore (**WRITE**, ledger only). Then step 2 must show the original 4 pairs again and step 3 must show `42` / `35d15d16…` |
| Step 10 fails part-way | Re-run step 9. The migration is idempotent, so re-running step 10 is safe. If the ledger row was written without the comments, re-run the two COMMENT statements from the file |
| The owner wants the pre-repair state back after success | Run the §3 restore. The comments remain, which is harmless. To also clear them (this re-creates the original defect): `COMMENT ON COLUMN public.order_items.unit_list_price_paisa IS NULL; COMMENT ON COLUMN public.order_items.line_discount_paisa IS NULL;` (**WRITE**) |
| Anything touches data unexpectedly | Not expected: the only executed SQL is `COMMENT ON`. Data recovery on Free depends on D2 (no platform backups) |

## 9. Go / no-go

**Recommendation: GO, subject to the owner's explicit approval of §7 steps 0, 6, 7 and 10.**

Conditions:

- Step 3 must still read `42` / `35d15d16…`.
- Step 9 must list only `20261126022136`.
- The private export must first be copied to client-owned encrypted storage.

**Status:** READY FOR OWNER APPROVAL — NOT YET LIVE-COMMERCE CERTIFIED.

## 10. Execution record (2026-11-26)

The owner approved §7 as written in chat ("Approve §7 as written"). Every step ran in order and none hit a stop
condition. Evidence (step outputs, fresh export, fingerprints and checksums) is in the private folder
`C:\Users\mudas\Documents\LaptopsHub-private\lh025-exec-2026-11-26\` (not in git).

| # | Result |
|---|---|
| 0 | PR #86 passed `quality` and Vercel, was marked ready and merged: `main` = `2229004`, 43 migration files, newest `20261126022136` |
| 1 | project-ref `xvmmjkrkgznnakcobmww` |
| 2 | 38 matched + the 4/4 pairs + `20261126022136` local-only |
| 3 | `42` / `35d15d16484d93d67210e3a345b6fe19`, unchanged |
| 4 | Fresh export taken; its COPY data is identical to the approved §2 export |
| 5 | Both comments NULL. The full fingerprint had 0 differences from the morning's production fingerprint |
| 6 | 02:56:31 UTC, **WRITE**: "Repaired … => reverted" (exit 0) |
| 7 | 02:56:46 UTC, **WRITE**: "Repaired … => applied" (exit 0) |
| 8 | 42 aligned, plus `20261126022136` local-only. The fingerprint showed only the ledger md5 changed; no schema object changed |
| 9 | Dry-run: "Would push these migrations: • 20261126022136_order_items_discount_column_comments.sql" and nothing else |
| 10 | 02:57:26 UTC, **WRITE**: "Applying migration 20261126022136…", "Finished supabase db push" (exit 0) |
| 11 | 43 aligned, 0 unaligned; dry-run: "Remote database is up to date" |
| 12 | Both comments now set, with exactly the repo text. Ledger rows for the 5 repo versions hold 3/9/16/27/2 statements, as rehearsed. The full fingerprint shows exactly 4 changes: 2 comments, ledger count 42→43 and the ledger md5 (now `95772b8561f47f52e4e3c5b69058fb65`). No function, policy, grant, column, constraint, index, trigger or RLS change. The targeted parity check against the repo-built local database now differs only by `cms_media_assets`, which is absent locally because Storage is off there |
| 13 | `www.laptopshub.pk`: `/`, a product page (prices shown), `/checkout`, `/cart` and `/admin/login` return 200, and `/admin` redirects to login (307). `/collections` returns 404 because there is no index route; that is pre-existing and unrelated. `/collections/dell` returns 200 |

**CLI warning during step 10:** after applying the migration, CLI 2.108 printed "failed to cache migrations
catalog … pgdelta-target-ca.crt: ENOENT". This is the CLI's optional local catalog cache, which runs after the push.
It does not affect the database: steps 11–12 confirm the migration and its ledger row are in place.

**Restoring the old state is still possible.** `ledger_restore.sql` from §2 would return the ledger to the
pre-repair 42 rows, but there is no reason to use it: the ledger now matches the repo exactly.

**After this repair:**

- Future migrations go through the normal path: `migration new`, then rehearse locally, then the owner approves, then
  `db push --linked --dry-run` followed by `db push --linked`.
- G19, G22 and D12 still each need their own approved migration.
