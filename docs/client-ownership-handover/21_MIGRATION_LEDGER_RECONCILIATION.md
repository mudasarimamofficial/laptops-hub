# 21 — Migration ledger reconciliation (LH-025)

> ## REQUIRES OWNER APPROVAL — NOT EXECUTED
> Nothing in this document has been run against production. Every production query used to write it was a
> read-only `SELECT` (or `supabase migration list --linked`). The production ledger was re-listed at the end of the
> investigation and is byte-for-byte the same as at the start. The repair commands below change rows in
> `supabase_migrations.schema_migrations` only, but they are still a production change and need explicit owner approval.

- Date: 2026-11-24 · Project: production Supabase (linked CLI) · Supabase CLI 2.108.0
- **2026-11-26: the owner chose Option A (§6).** The fresh re-check, the verified ledger export, the restore procedure, the
  rehearsal on a copy of the real ledger and the exact production sequence are in `24_LH025_OPTION_A_EXECUTION_PLAN.md`.
  The new migration version is `20261126022136` (not the `20261124130000` sketched in §6). Still not executed.
- Defect: LH-025 in `02_DEFECT_REGISTER_AND_GAPS.md`
- **Re-checked 2026-11-25 (read-only `npx supabase migration list --linked`): unchanged.** The same four remote-only and
  four repo-only versions; no repair, push or migration has been run. Still awaiting the owner's approval of §7 and the
  pair-4 choice in §6.
- Working files (not committed): `C:\Users\mudas\AppData\Local\Temp\claude\b59e4081e08a287a\d065e837-daed-4cd2-a547-65e7f57c5037\scratchpad\lh025\`

## 1. Summary

| # | Remote (prod ledger) | Repo file | Recorded SQL vs repo | Live prod catalog vs repo | Verdict |
|---|---|---|---|---|---|
| 1 | `20261118095223` articles_public_respect_scheduled_for | `20261118143000_articles_public_respect_scheduled_for.sql` | Identical apart from comments | Identical | **EQUIVALENT** (comment lines only) |
| 2 | `20261118123619` cms_media_assets_and_storage | `20261118160000_cms_media_assets_and_storage.sql` | Identical apart from comments | Identical | **EQUIVALENT** (comment lines only) |
| 3 | `20261118134801` reels_external_media_and_presets | `20261118190000_reels_external_media_and_presets.sql` | Identical apart from comments | Identical | **EQUIVALENT** (comment lines only) |
| 4 | `20261123095218` discount_campaigns_and_pricing | `20261123120000_discount_campaigns_and_pricing.sql` | **DIFFERENT** — the recorded SQL leaves out the `create_cod_order` discount patch (plus its REVOKE/GRANT) and 2 `COMMENT ON COLUMN` statements | Behaviour identical: `create_cod_order` is live and matches the repo exactly. **2 column comments are missing** | **DIFFERENT (metadata only)**. Needs the corrective step in §6 before or with the repair |

"Comment lines" means SQL `--` comments in the file. After stripping them and collapsing whitespace, the SHA-256 of
the remote and repo SQL is identical for pairs 1–3 (§3).

## 2. Current state: `npx supabase migration list --linked` (before, unchanged at end)

```
   Local          | Remote         | Time (UTC)
  ----------------|----------------|---------------------
   20261021120000 | 20261021120000 | 2026-10-21 12:00:00
   20261021130000 | 20261021130000 | 2026-10-21 13:00:00
   20261021140000 | 20261021140000 | 2026-10-21 14:00:00
   20261021150000 | 20261021150000 | 2026-10-21 15:00:00
   20261021151000 | 20261021151000 | 2026-10-21 15:10:00
   20261021160000 | 20261021160000 | 2026-10-21 16:00:00
   20261023110000 | 20261023110000 | 2026-10-23 11:00:00
   20261023120000 | 20261023120000 | 2026-10-23 12:00:00
   20261023130000 | 20261023130000 | 2026-10-23 13:00:00
   20261023140000 | 20261023140000 | 2026-10-23 14:00:00
   20261023150000 | 20261023150000 | 2026-10-23 15:00:00
   20261023160000 | 20261023160000 | 2026-10-23 16:00:00
   20261023170000 | 20261023170000 | 2026-10-23 17:00:00
   20261024100000 | 20261024100000 | 2026-10-24 10:00:00
   20261025120000 | 20261025120000 | 2026-10-25 12:00:00
   20261025130000 | 20261025130000 | 2026-10-25 13:00:00
   20261025140000 | 20261025140000 | 2026-10-25 14:00:00
   20261025150000 | 20261025150000 | 2026-10-25 15:00:00
   20261025160000 | 20261025160000 | 2026-10-25 16:00:00
   20261114100000 | 20261114100000 | 2026-11-14 10:00:00
   20261115100000 | 20261115100000 | 2026-11-15 10:00:00
   20261116100000 | 20261116100000 | 2026-11-16 10:00:00
   20261117100000 | 20261117100000 | 2026-11-17 10:00:00
   20261117110000 | 20261117110000 | 2026-11-17 11:00:00
   20261117120000 | 20261117120000 | 2026-11-17 12:00:00
   20261117130000 | 20261117130000 | 2026-11-17 13:00:00
   20261117140000 | 20261117140000 | 2026-11-17 14:00:00
   20261117150000 | 20261117150000 | 2026-11-17 15:00:00
   20261118074859 | 20261118074859 | 2026-11-18 07:48:59
   20261118075155 | 20261118075155 | 2026-11-18 07:51:55
   20261118075220 | 20261118075220 | 2026-11-18 07:52:20
   20261118081618 | 20261118081618 | 2026-11-18 08:16:18
                  | 20261118095223 | 2026-11-18 09:52:23
   20261118100000 | 20261118100000 | 2026-11-18 10:00:00
   20261118120000 | 20261118120000 | 2026-11-18 12:00:00
                  | 20261118123619 | 2026-11-18 12:36:19
                  | 20261118134801 | 2026-11-18 13:48:01
   20261118140000 | 20261118140000 | 2026-11-18 14:00:00
   20261118143000 |                | 2026-11-18 14:30:00
   20261118160000 |                | 2026-11-18 16:00:00
   20261118162150 | 20261118162150 | 2026-11-18 16:21:50
   20261118190000 |                | 2026-11-18 19:00:00
   20261118220000 | 20261118220000 | 2026-11-18 22:00:00
                  | 20261123095218 | 2026-11-23 09:52:18
   20261123120000 |                | 2026-11-23 12:00:00
   20261124120000 | 20261124120000 | 2026-11-24 12:00:00
```

Production ledger: 42 rows. The 4 remote-only rows were written by MCP `apply_migration`. Each holds **1** statement
(the whole script), and `created_by` is set to the owner's account (redacted here). None of the 42 rows has a
`rollback` entry.

## 3. Recorded SQL vs repo file

Query (read-only):
`select version, name, statements from supabase_migrations.schema_migrations where version in ('20261118095223','20261118123619','20261118134801','20261123095218')`.
All four rows have non-empty `statements`. Each was saved to `remote_<version>_<name>.sql` and compared against the repo
file. Normalisation removed `--` comments, collapsed whitespace and dropped blank lines.

| Pair | raw sha256 (remote / repo) | normalised sha256 (remote / repo) | normalised diff |
|---|---|---|---|
| 1 | ce4a5846… / d0f09787… | 5db58c1e… / 5db58c1e… | 0 lines |
| 2 | b74bfff7… / a32778d0… | 86bbd6e0… / 86bbd6e0… | 0 lines |
| 3 | bb287ef9… / 56e23f3e… | 6d2a9ab8… / 6d2a9ab8… | 0 lines |
| 4 | 0416e867… / 1d90c6ab… | 042bc010… / c7acbcc7… | 223 lines |

Raw differences for pairs 1–3 are header comments (rollback notes) only. Pair 1 is identical apart from line endings
(the repo working copy uses CRLF).

Pair 4: the repo file has two parts that the recorded remote SQL lacks:
1. `COMMENT ON COLUMN public.order_items.unit_list_price_paisa …` and `COMMENT ON COLUMN public.order_items.line_discount_paisa …`
2. The whole `CREATE OR REPLACE FUNCTION public.create_cod_order(payload jsonb)` discount patch, plus
   `REVOKE ALL … FROM PUBLIC, anon, authenticated; GRANT EXECUTE … TO service_role`.

Every other statement matches after normalisation: table, indexes, RLS, policy, order_items columns, seed,
`active_automatic_discount`, `unit_selling_paisa`, `system_keepalive`, `touch_keepalive` and their grants.

## 4. Live production catalog vs repo

Method: one read-only fingerprint query (`parity.sql` in the working folder) ran against production
(`db query --linked`) and against the local stack (`db query --local`). The local stack has every repo migration
applied **except `20261118160000`**, because `[storage] enabled = false` in `supabase/config.toml` means there is no
`storage.buckets` locally. Pair 2 was therefore checked against the repo text directly. The fingerprint covers:
`pg_policies` (+ policy comments), `information_schema.columns` (type, nullability, default), column and table comments,
RLS flags, `pg_get_constraintdef`, `pg_indexes`, `role_table_grants`, `column_privileges`, `pg_proc`
(`md5(pg_get_functiondef)`, `prosecdef`, `provolatile`, `proconfig`, owner, `proacl`, `has_function_privilege` for
anon/authenticated/service_role), `pg_trigger` and the seed rows.

Local vs production fingerprint diff (98 vs 116 rows):
- Missing locally: the `cms_media_assets` rows (expected, storage is disabled locally).
- `order_items.unit_list_price_paisa` / `line_discount_paisa` comments: set locally, **`<null>` in production**.
- `md5(pg_get_functiondef)` differs for `active_automatic_discount`, `unit_selling_paisa` and `touch_keepalive`. After
  stripping `\r` the bodies are **identical**: the local copies were applied from CRLF Windows files and the production
  copies (MCP) use LF. That is not a behaviour difference.
- Everything else matches exactly, including the default privileges (`pg_default_acl` for `postgres` in `public` and
  `storage`), which decide the table grants on the new tables.

### Pair 1: articles policy
- `articles_public_select`: PERMISSIVE · SELECT · `{anon,authenticated}` ·
  `USING ((status = 'published') AND ((scheduled_for IS NULL) OR (scheduled_for <= now())))` — matches the repo.
- The policy comment matches the repo text. No later migration touches `articles` (`20261118140000` rls_initplan_perf only
  rewrites `admin_memberships_self_select` and `inventory_ledger_staff_read`).

### Pair 2: CMS media and storage
- `storage.buckets` row `cms-media`: public=true, file_size_limit=5242880,
  allowed_mime_types={image/jpeg,image/png,image/webp,image/gif} — matches the repo.
- Storage policy `cms_media_public_read`: PERMISSIVE · SELECT · `{anon,authenticated}` · `USING (bucket_id = 'cms-media')` — matches.
- `public.cms_media_assets`: 8 columns with types, nullability and defaults as in the repo. PK `(id)`, `UNIQUE (path)`,
  index `cms_media_assets_created_at_idx (created_at DESC)`. RLS enabled. Policy `cms_media_assets_public_select` (anon,
  authenticated, `USING true`). Table comment matches. No triggers.
- Grants: only `service_role` holds table privileges, because the repo file has no GRANT and the least-privilege default
  privileges apply. So anon/authenticated cannot actually read the table through the Data API, despite the policy. This
  is what the repo produces too (not a pair difference). Note it if public reads of `cms_media_assets` are ever expected.
- Data observation (not schema): 1 object in bucket `cms-media`, 0 rows in `cms_media_assets`.

### Pair 3: reels media and presets
- `reels_no_reference_assets`: absent, as the repo intends (dropped).
- New columns `hls_url`, `avatar_url`, `media_source` (NOT NULL default `'external_file'`), `preset_key`, `link_path`,
  `source_attribution` (NOT NULL default `''`) — match.
- The 7 CHECK constraints (`reels_hls_scheme`, `reels_avatar_scheme`, `reels_media_source_check`, `reels_hls_len`,
  `reels_avatar_len`, `reels_link_path_format`, `reels_source_attribution_len`) match the repo expressions.
- `reels_preset_key_uidx`: UNIQUE partial index `WHERE preset_key IS NOT NULL AND preset_key <> ''` — matches.
- Column SELECT grants to anon and authenticated on `hls_url, avatar_url, media_source, link_path, source_attribution`
  (not `preset_key`) — match.
- Later migrations `20261118162150` / `20261118220000` (reel_products) reference `reels` but change none of these objects.

### Pair 4: discount campaigns and pricing
- `discount_campaigns`: 18 columns, CHECKs (`kind`, `value > 0`, `scope`, `status`, `discount_campaigns_percent_range`,
  `discount_campaigns_window`), indexes `discount_campaigns_status_idx` and `discount_campaigns_live_idx`. RLS enabled;
  policy `discount_campaigns_staff_all` (authenticated, `is_staff()` / `is_staff()`). Grants: service_role only. Matches.
- `order_items`: `unit_list_price_paisa bigint` (CHECK ≥ 0 or NULL), `line_discount_paisa bigint NOT NULL DEFAULT 0`
  (CHECK ≥ 0), `discount_campaign_id uuid` FK → `discount_campaigns(id) ON DELETE SET NULL`. Matches.
  **Comments on `unit_list_price_paisa` and `line_discount_paisa` are NULL in production** (the only real difference).
- Functions (production):
  - `create_cod_order(jsonb)`: SECURITY DEFINER, `search_path=public`, EXECUTE service_role only. Its
    `pg_get_functiondef` **md5 equals the local repo-applied copy (f6f4a1bf…)**, byte-for-byte including CRLF line endings.
    It calls `active_automatic_discount(now())` and `unit_selling_paisa`, and writes `unit_list_price_paisa`,
    `line_discount_paisa` and `discount_campaign_id`.
  - `active_automatic_discount(timestamptz)`: SECURITY DEFINER, STABLE, EXECUTE authenticated + service_role (not anon) —
    body matches the repo.
  - `unit_selling_paisa(bigint, discount_campaigns)`: IMMUTABLE, not SECURITY DEFINER, EXECUTE service_role only — matches.
  - `touch_keepalive(text)`: SECURITY DEFINER, EXECUTE service_role only — matches.
- `system_keepalive`: columns, CHECK `id = 1`, PK, RLS, policy `system_keepalive_staff_select`, row `id=1` present — match.
- Seed rows: production has exactly 1 campaign, with these values:
  name `Storewide 5% Off`, description `Automatic 5% discount on all eligible products and variants. No code needed.`, `percent`,
  `5`, `storewide`, `active`, starts/ends NULL, announcement `FLAT 5% OFF STOREWIDE — Automatically Applied. No Code Needed.`,
  show_announcement true, code_required false, product_ids `{}`, collection_ids `{}`. These match the repo seed exactly.
- **How the discount `create_cod_order` reached production:** a search of all 42 ledger rows for statements that define
  `create_cod_order` finds only these versions: 20261021120000, 20261021140000, 20261023160000, 20261117100000,
  20261117120000, 20261118075155. None of them is discount-aware. The live body has CRLF line endings, while MCP-applied
  bodies have LF. So the patch was applied **out-of-band** from the Windows repo file, without a ledger entry. The result
  is correct, but the ledger does not record it. `docs/DISCOUNT_ENGINE_ACCEPTANCE_2026-11-23.md` says the repo
  migration was applied. That is true for the function, but not for the two comments.

## 5. Idempotency of each repo file, if accidentally re-run

| File | Re-run behaviour | Caveats |
|---|---|---|
| 20261118143000 | Safe: `DROP POLICY IF EXISTS` + `CREATE POLICY` + `COMMENT` | None |
| 20261118160000 | Safe: bucket `ON CONFLICT (id) DO UPDATE`, `CREATE TABLE/INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS` + `CREATE POLICY` | The bucket upsert would **reset** `public`, `file_size_limit` and `allowed_mime_types` to the repo values, overwriting any later dashboard change (currently equal). Dropping/creating a policy on `storage.objects` from the CLI login role may fail with an ownership error on hosted Supabase. Not tested; a failure would roll back that migration. |
| 20261118190000 | Safe: `DROP CONSTRAINT IF EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DO … EXCEPTION WHEN duplicate_object`, `CREATE UNIQUE INDEX IF NOT EXISTS`, `GRANT` | None |
| 20261123120000 | Mostly safe: `IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `CREATE OR REPLACE FUNCTION`, keepalive `ON CONFLICT DO NOTHING`. `ADD COLUMN IF NOT EXISTS` skips the inline CHECK/FK when the column exists. | **Seed is idempotent only by name.** If the owner renames or deletes "Storewide 5% Off", a re-run **inserts a new active storewide 5% discount**, which affects live prices. `CREATE OR REPLACE create_cod_order` would also overwrite any newer `create_cod_order` body with this older one. |

This is why the ledger must be repaired before anyone runs `supabase db push`. Today `db push` refuses to run because
the 4 remote versions are missing locally. Someone who "fixes" that with `--include-all` would re-execute all 4 repo files.

## 6. Pair 4 corrective step (needed before pair 4 counts as equivalent)

The behaviour already matches. The schema metadata differs only in two `pg_description` rows. Two ways to close it:

- **Option A (recommended):** add a new forward-only, idempotent, metadata-only migration after the latest remote
  version, e.g. `supabase/migrations/20261124130000_order_items_discount_column_comments.sql`:
  ```sql
  -- Restores column comments from 20261123120000 that the MCP-applied 20261123095218 omitted. Metadata only.
  COMMENT ON COLUMN public.order_items.unit_list_price_paisa IS 'Catalog list price at order time (paisa). unit_price_paisa is the charged selling price.';
  COMMENT ON COLUMN public.order_items.line_discount_paisa IS 'Per-line savings: (list - selling) * quantity.';
  ```
  Apply it with `npx supabase db push --linked` **after** the ledger repair, in the same approved window. This file has
  **not** been created; it is a proposal only.
- **Option B:** the owner accepts the comment-only drift in writing and records it here. No DDL.

Without A or B, do not mark `20261123120000` as applied.

## 7. Proposed repair (owner approval required; run in this order)

All commands run from the repo root on a clean checkout of `main` that contains these four files unchanged.

```bash
# 0. Backups (read-only) — see §8
# 1. Remove the 4 MCP-timestamp rows (deletes ledger rows only)
npx supabase migration repair --linked --status reverted 20261118095223 20261118123619 20261118134801 20261123095218
# 2. Record the 4 repo versions as applied (inserts ledger rows with the parsed repo statements; executes nothing)
npx supabase migration repair --linked --status applied 20261118143000 20261118160000 20261118190000 20261123120000
# 3. Verify
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# 4. Pair 4 corrective (only with Option A, §6, after adding the file and getting approval)
npx supabase db push --linked
```

If the owner wants to approve pairs 1–3 separately from pair 4, run steps 1 and 2 with only the first three versions.
In that case `db push` stays blocked by the remaining remote-only `20261123095218` until pair 4 is resolved.

### Expected result
- `migration list --linked`: 42 rows, with every row showing the same version in Local and Remote.
  `20261118095223`, `20261118123619`, `20261118134801` and `20261123095218` are gone.
  `20261118143000`, `20261118160000`, `20261118190000` and `20261123120000` show on both sides.
- `db push --linked --dry-run`: `Remote database is up to date.` With Option A, it would list only
  `20261124130000_order_items_discount_column_comments.sql`.
- Before the repair, `db push` aborts because the remote migration versions are not in the local migrations directory.
  The CLI suggests `migration repair --status reverted …`. (`db push` was not run in this investigation, not even with
  `--dry-run`. This is the CLI's documented behaviour.)

### Repair only edits the ledger
- `--status reverted` deletes the matching rows from `supabase_migrations.schema_migrations`.
- `--status applied` reads `supabase/migrations/<version>_*.sql`, splits it into statements and upserts
  `(version, name, statements)` into the same table. **The SQL is not executed.**
- Rehearsal proof (§9): marking `20261118160000` applied on the local stack **succeeded** even though the local database
  has no `storage.buckets` table, so executing the file would have failed. `public.cms_media_assets` stayed absent, and
  the full catalog fingerprint was unchanged before and after.

## 8. Backups (before step 1)

Supabase Free has **no PITR**, and the daily backup is not a convenient way to restore single rows. Take these read-only exports first, keep
them outside git (the ledger contains the owner's account e-mail in `created_by`), and attach their checksums to the
approval record:

```bash
npx supabase db query --linked "select version, name, statements, created_by, idempotency_key, rollback from supabase_migrations.schema_migrations order by version" > lh025_schema_migrations_backup_$(date +%Y%m%d%H%M).json
npx supabase migration list --linked > lh025_migration_list_before.txt
sha256sum lh025_*.json lh025_*.txt
```

Optional, also read-only: `npx supabase db dump --linked --schema supabase_migrations -f lh025_ledger_schema.sql`.

## 9. Local rehearsal (done on the local stack only; production untouched)

Target: local container `supabase_db_Laptops_Hub_Vercel_Development`, using `--local` (never `--linked`).

1. Backed up the local ledger (`COPY … TO STDOUT`, 41 rows) and the local catalog fingerprint.
2. `npx supabase migration repair --local --status reverted 20261118095223 20261118123619 20261118134801 20261123095218`.
   This was a no-op because those rows do not exist locally. Output: `Repaired migration history: [...] => reverted`.
3. `npx supabase migration repair --local --status applied 20261118143000 20261118160000 20261118190000 20261123120000`.
   Output: `=> applied`.
   - The `20261118160000` row was inserted (9 parsed statements) **without executing it**: no `storage.buckets`, no
     `cms_media_assets` exist locally.
   - For the existing rows `20261118190000` and `20261123120000`, `statements` changed from empty to the parsed file
     (16 and 27 statements). This confirms that `applied` upserts the statements text.
   - The catalog fingerprint was identical before and after.
   - `migration list --local` was fully aligned. `db push --local --dry-run` printed `Local database is up to date.`
4. Restored with `npx supabase migration repair --local --status reverted 20261118160000`. `migration list --local` is
   identical to the pre-rehearsal output. Remaining local difference: the `statements` text now stored for 190000 and
   123120000 (ledger metadata only, more accurate than before).
5. Rollback probe: `npx supabase migration repair --local --status applied 20261118095223` fails with
   `glob supabase\migrations\20261118095223_*.sql: file does not exist`, and nothing was written. See §10.

To rehearse the production state exactly, use a throwaway local database (not done here; it needs
`CREATE DATABASE`):
`createdb lh025` → load the backup rows into `supabase_migrations.schema_migrations` there → run steps 1–3 with
`--db-url postgresql://postgres:postgres@127.0.0.1:54322/lh025` → check `migration list --db-url …` → drop the database.

## 10. Rollback (inverse repair)

```bash
npx supabase migration repair --linked --status reverted 20261118143000 20261118160000 20261118190000 20261123120000
npx supabase migration repair --linked --status applied  20261118095223 20261118123619 20261118134801 20261123095218
```

The second command only works if local files `supabase/migrations/<version>_<name>.sql` exist for those four versions
(see the probe in §9). Recreate them temporarily from the §8 backup (one file per version, containing its recorded
statement), run the command, then delete the temporary files. Do not commit them.

Limits: rows restored this way have `created_by = NULL`, and the statements are re-split into many entries instead of
the original single entry. An exact restore of the original rows needs an `INSERT … SELECT` from the backup. That is
DML on the ledger and needs its own approval. If Option A was applied, roll it back by setting both comments back to
`NULL` (`COMMENT ON COLUMN … IS NULL`) and reverting `20261124130000`. Neither rollback touches application tables,
functions or data.

## 11. Risks and notes
- **Out-of-band production change:** the discount `create_cod_order` patch is live but appears in no ledger row. After the
  repair, the ledger row for `20261123120000` will contain it, so the ledger will describe production correctly.
  Process fix: apply migrations only through the CLI or MCP `apply_migration` using the repo filename's version. Never
  paste SQL from a file on the side.
- **Seed hazard (§5):** if `20261123120000` were re-run after the campaign is renamed or deleted, it would create a
  second active 5% campaign. The repair removes that risk because the version will be recorded as applied.
- **The local stack cannot verify pair 2** (`[storage] enabled = false`). Pair 2 was checked against the repo text and
  the production catalog only.
- `cms_media_assets` has an RLS policy for anon/authenticated but no table grant. It cannot be read publicly through the
  Data API. This matches the repo and is not caused by the ledger.
- Never use `db push --include-all`, `db reset --linked` or `migration up --linked` to "fix" the ledger.
