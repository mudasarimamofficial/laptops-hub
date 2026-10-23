# Production database change — owner approval request

**Status: Option A, Option B and the Outbox lease (`20261024100000`) APPLIED 2026-10-23 (all owner-approved; see
Outcomes). Nothing pending.** Prepared 2026-10-23.

| | |
|---|---|
| Target | Supabase project `xvmmjkrkgznnakcobmww` ("Laptops Hub", ap-southeast-1) |
| Applied ledger (read 2026-10-23) | `20261021120000` … `20261021160000` (6 migrations) |
| Pending in repo (`fix/v5-correctness-parity`) | `20261023110000`, `20261023120000`, `20261023130000`, `20261023140000`, `20261023150000`, `20261023160000` |

## Outcome — Outbox lease APPLIED (2026-10-23, owner-approved)

Approved by the owner in session: "apply only 20261024100000_notification_outbox_lease.sql (commit 0bfc552, blob
e2be257) to production with the documented procedure — preflight dry run must list exactly that file, schema backup,
supabase db push --linked, read-only post-checks. No deploy, merge, env or COD change."

| Step | Result |
|---|---|
| Preflight | clean tree; file blob `e2be257` and SHA-256 `17fa8fee…a46c` on disk; `supabase/` unchanged since `0bfc552`; linked ref `xvmmjkrkgznnakcobmww`; ledger 13; dry run listed exactly this file; table 0 rows, 10 columns, 2 constraints; function absent |
| Backup | `supabase db dump --linked` → `backups/2026-10-23-outbox-apply/schema-before-outbox-lease.sql` (70 KB) + table grants (22 rows); gitignored |
| Apply | `supabase db push --linked`: applied. Post-push CLI warning "failed to cache migrations catalog" (missing local pg-delta certificate) concerns a local cache only, as in Option B |
| Ledger | 14 versions; dry run → "Remote database is up to date" |
| Table | 0 rows · 20 columns · constraints pkey, order FK, 3 status checks · `notification_outbox_due_idx` · table grants identical to before |
| Function | `claim_notifications`: SECURITY INVOKER (`prosecdef=false`), `search_path=""`, owner postgres, fail-closed guard present, no `coalesce(auth.role()` · EXECUTE anon false, authenticated false, service_role true · public functions 11 → 12 |
| Live probes (no writes) | anon RPC → 42501 · service-role RPC scoped to a non-existent order → `[]` · rows still 0 |
| Suites (production, read-only) | P0 9/9 · auth matrix 24/24 |
| Public site | `/`, collection, PDP 200 · `/admin` 307 · COD POST 403 · no runtime errors |

Not done (outside this approval): no web deploy, merge, environment or COD change. Production still runs `34f9839`.

Rollback (owner instruction only): `supabase/rollback/outbox_lease_rollback.sql`, then
`supabase migration repair --status reverted 20261024100000 --linked`.

## Outbox lease — `20261024100000_notification_outbox_lease.sql` — approval request (applied, see Outcome)

Revision 2 (2026-10-23, owner-requested hardening). File SHA-256 and commit: § Identity at the end of this section.

**Change.** Fixes a notification defect: stale recovery used the row's `created_at`, so an old notification could be
taken over while a worker was still sending it, and an expired worker could overwrite a newer result; recipients
were not tracked separately. Adds a claim lease, per-recipient state and bounded retries (`docs/NOTIFICATIONS.md`).

**Exact SQL (one file, one transaction):**
- `alter table public.notification_outbox add column` × 10: `claim_token`, `claimed_at`, `first_attempt_at`,
  `next_attempt_at` (default now()), `business_status`/`customer_status` (default 'pending'),
  `business_message_id`, `business_accepted_at`, `customer_message_id`, `customer_accepted_at`.
- `update … set status='accepted' where status='sent'` (0 rows on production).
- 3 check constraints (row, business, customer status values); index `notification_outbox_due_idx`.
- New function `public.claim_notifications(int,int,uuid,int,int,boolean)`:
  - **SECURITY INVOKER** — runs with the caller's rights and grants nothing (service_role already holds the table
    privileges and bypasses RLS);
  - `set search_path = ''`; every reference schema-qualified (`public.`, `auth.`, `pg_catalog.`);
  - **fail-closed guard** `if auth.role() is distinct from 'service_role' then raise 'forbidden' (42501)` — a missing
    role claim is rejected (revision 1 used `coalesce(auth.role(), 'service_role')`, which let a NULL claim through);
  - owner `postgres`; `revoke all … from public, anon, authenticated`; `grant execute … to service_role`.
- Nothing else: no change to `create_cod_order`, RLS policies, other tables, or grants on existing objects.

**Blast radius.** One table with **0 rows**; no constraints besides PK/FK; one new function. Brief lock on
`notification_outbox` only. Orders, checkout, catalog and admin unaffected.

**Compatibility with the Production app.** Production runs `34f9839`, which contains **no notification code** — it
never reads or writes `notification_outbox`. The only writer today is `create_cod_order` (database side; COD is off),
whose insert uses the column defaults and satisfies the new constraints (checkout suite 31/31 on the migrated
schema). The new application code requires this migration: apply it **before** deploying `fix/v5-correctness-parity`.

**Preflight (read-only, production, 2026-10-23, after revision 2):**

| Check | Result |
|---|---|
| Ledger | 13 applied; `20261024100000` local only |
| `supabase db push --linked --dry-run` | exactly `20261024100000_notification_outbox_lease.sql` |
| `notification_outbox` | 0 rows · 10 columns · 2 constraints (pkey, order FK) |
| `claim_notifications` | does not exist |
| `auth.role()` | exists; service_role can execute it |
| service_role on the table | SELECT/UPDATE granted |
| Schema backup procedure | `supabase db dump --linked` → `backups/2026-10-23-outbox-preflight/schema-before-outbox-lease.sql` (70 KB, contains `notification_outbox`; gitignored) |

**Verified locally (all 14 migrations, fresh database):**
- `tests/isolated/claim-notifications-guard.sql` **6/6**: service-role DB role with no role claim → refused ·
  authenticated → refused · anon with EXECUTE deliberately re-granted → refused by the guard · anon DB role with a
  forged service_role claim → passes the guard but claims **nothing** (invoker rights + RLS) · proper service-role
  request → claims · attributes: invoker, `search_path=""`, owner postgres, EXECUTE service_role only.
- `tests/isolated/outbox-reliability.test.ts` **13/13** (service-role API path throughout): concurrent workers, lease
  vs row age, expired worker, crash after acceptance, partial delivery, timeout, customer skipped, bounded retries,
  24 h window, not configured, **temporary 409** `concurrent_idempotent_requests` → backoff, later exactly one
  delivery, **permanent 409** `invalid_idempotent_request` → automatic retries stopped at once and a staff retry
  recovers, anon and a signed-in staff session refused via the API.
- Launch journeys 10/10 · checkout 31/31 · role HTTP 113/113 · unit suites 13/13 (incl. 409 classification) · cron
  401 without secret.
- Rollback `supabase/rollback/outbox_lease_rollback.sql`: table back to 10 columns, function and new constraints
  gone, `accepted`→`sent`; re-applying the migration afterwards gives the same result and the guard passes 6/6 again.

**Procedure.**
1. Preflight again (table above); `supabase db dump --linked -f backups/<date>-outbox/schema-before.sql`.
2. `supabase db push --linked` (applies only this file).
3. Post-checks (read-only): ledger 14; dry run "up to date"; 20 columns; 5 constraints; function
   `prosecdef = false`, `proconfig = {search_path=""}`, owner postgres; `has_function_privilege` anon/authenticated
   false, service_role true; anon RPC call refused; storefront smoke; P0 9/9; auth matrix 24/24.
4. Rollback (owner instruction only): run the rollback file, then
   `supabase migration repair --status reverted 20261024100000 --linked`. Safe with `34f9839` (it does not use the
   table); if the new code is already deployed, roll the web deployment back first.

**Risk of waiting.** None while email is off; the new code must not be deployed before this is applied.

**Identity.** Commit `0bfc55204187b224e247e0f9d9759fe656dca1da` (branch `fix/v5-correctness-parity`) · git blob
`e2be257aed50783ae92ae763f7dbe837c6993695` · SHA-256 (LF, as committed and on disk at push time)
`17fa8fee44560c18785bb55095fccaa607314e96be58e7549827f59bdabaa46c`. Before pushing, confirm
`git rev-parse HEAD:supabase/migrations/20261024100000_notification_outbox_lease.sql` equals the blob id.

**Decision:** [x] Approved and applied 2026-10-23

## Outcome — Option B APPLIED (2026-10-23, owner-approved)

Approved by the owner in session: "run the section 4 procedure (dry run must list exactly the 6 files
20261023120000-20261023170000, schema backup, supabase db push --linked, read-only post-checks). No web deployment,
alias, env or COD change."

| Step | Result |
|---|---|
| Preflight | clean tree; migration files identical to the pushed branch; linked ref `xvmmjkrkgznnakcobmww`; ledger 7; dry run listed exactly the 6 files |
| Backup | `supabase db dump --linked` → `backups/2026-10-23-option-b/schema-before-option-b.sql` (gitignored; 11 functions, 161 grant statements, 12 default-privilege statements) plus privilege/schema/function fingerprints |
| Pre-state | production privileges (206 rows), schema and 11 function bodies **identical** to the state the push path and rollback were tested against |
| Apply | `supabase db push --linked`: all 6 files applied. A post-push CLI warning ("failed to cache migrations catalog", missing local pg-delta certificate) concerns a local cache only |
| Ledger | 13 versions; `db push --dry-run` → "Remote database is up to date" |
| Fingerprint after | privileges (206 rows), schema, default ACLs and all 11 function bodies **identical to the verified local build** of all 13 migrations |
| ACL | `create_cod_order`, `record_cod_collection`, `transition_order_status`, `consume_rate_limit`: service_role only · `quote_cod_shipping`, `get_order_confirmation_by_token`: anon/authenticated/service_role · `content_pages.legal_approved_by` not selectable by anon · no TRUNCATE for anon · `postgres` defaults in `public` → only `postgres`, `service_role`; global PUBLIC function default removed |
| Functions | service-role guard present in both staff RPCs; quote loop variable is `shipping_zones%ROWTYPE` |
| Live probes (no writes) | staff RPCs, `create_cod_order`, `consume_rate_limit` → 42501 for anon · anon quote → `unserviceable` (0 zones; no cast error) · anon `legal_approved_by` → 42501 · anon catalog listing reads · service role reaches `record_cod_collection` (→ `validation_failed`) |
| Suites (production, read-only) | P0 9/9 · auth matrix 24/24 · routes 226/226 PDPs, 6/6 drafts 404, 39/39 collections, 9/9 pages |
| Public site | home, PDP, collection, contact, guides, sitemap 200 · admin 307 · COD 403 · no runtime errors/warnings |

Observation (unchanged, out of scope): `postgres` default privileges in the `storage` schema still grant API roles
(Supabase platform default; Storage is not used by this project).

Rollback (owner instruction only): `supabase/rollback/option_b_rollback.sql`, then
`supabase migration repair --status reverted 20261023120000 20261023130000 20261023140000 20261023150000 20261023160000 20261023170000 --linked`.

## Outcome — Option A APPLIED (2026-10-23, owner-approved)

Approved by the owner in session: "apply only 20261023110000_emergency_revoke_staff_rpc_execute.sql, record it with
migration repair, and run the read-only post-checks. Nothing else."

| Step | Result |
|---|---|
| Preflight | ledger = the 6 versions above; ACL matched section 1 (anon/authenticated EXECUTE on the three functions) |
| Apply | `supabase db query --linked -f supabase/migrations/20261023110000_emergency_revoke_staff_rpc_execute.sql` (committed file, unchanged) — no error |
| Record | `supabase migration repair --status applied 20261023110000 --linked` → ledger now 7 versions |
| ACL after | exactly 6 privilege rows changed: anon/authenticated EXECUTE = false on `record_cod_collection`, `transition_order_status`, `consume_rate_limit`; `service_role` = true; every other function unchanged |
| Anon probes | all three → `42501 permission denied` (before: callable); `create_cod_order` 42501 as before; `quote_cod_shipping` still public |
| Server path | service role reaches `consume_rate_limit` (limit 0 → false, no write) and `record_cod_collection` (→ `validation_failed`, no write) |
| Suites (production, read-only) | P0 9/9 · auth matrix 24/24 · routes 226/226 PDPs, 6/6 drafts 404, 39/39 collections, 9/9 pages |
| Production alias smoke | `/`, PDP, `/collections/laptops` 200 · COD 403. `/pages/*` → 500: **pre-existing**, the old `ea652f2` build's jsdom `ERR_REQUIRE_ESM` crash (fixed on this branch in `568ce08`), not related to this change |

Still pending in repo (not applied): `20261023120000` … `20261023170000` — six files (Option B, section 3).
`supabase db push --linked --dry-run` lists exactly these six.

## 1. Confirmed vulnerability (state before Option A) (severity: high, exploitable precondition not yet met)

Read-only `pg_proc` ACL inspection on production shows `anon` and `authenticated` hold EXECUTE on:

| Function | Kind | What a caller could do |
|---|---|---|
| `record_cod_collection(jsonb)` | SECURITY DEFINER | record cash collections on any order, as any active staff UUID it supplies |
| `transition_order_status(jsonb)` | SECURITY DEFINER | change any order's status, as any active staff UUID it supplies |
| `consume_rate_limit(text,int,int)` | SECURITY DEFINER | inflate rate-limit buckets (block the contact form) |

Both staff RPCs authorize only by checking `payload.actor_user_id` against `admin_memberships`. No staff UUID is
readable by `anon` today (orders are empty, `admin_memberships`/`audit_logs` are RLS-protected), but
`content_pages.legal_approved_by` becomes anon-readable as soon as a legal page is approved and published.
Exploitation needs a staff UUID; the exposure itself is live now. Details: `docs/SECURITY_RPC_REVIEW.md`.

## 2. Option A — emergency fix only (recommended first, smallest blast radius)

Apply **only** `supabase/migrations/20261023110000_emergency_revoke_staff_rpc_execute.sql`:

```sql
revoke execute on function public.record_cod_collection(jsonb), public.transition_order_status(jsonb),
  public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.record_cod_collection(jsonb), public.transition_order_status(jsonb),
  public.consume_rate_limit(text, integer, integer) to service_role;
```

- **Blast radius (simulated locally on production's grants):** exactly 6 privilege rows change (anon/authenticated
  EXECUTE on these three). No table, column, data, RLS or other function changes.
- **App impact:** none. The app calls all three only with the server's service-role key.
- **How:** SQL editor (or `supabase db query --linked -f <file>`), then record it so a later push does not re-run it:
  `supabase migration repair --status applied 20261023110000 --linked`.
- **Rollback:** `grant execute on function <same three> to anon, authenticated;` (re-opens the exposure).
- **Do not** use `supabase db push` for Option A: it would apply every pending migration.

## 3. Option B — 6 files — APPLIED 2026-10-23 (see Outcome)

`supabase db push --linked --dry-run` (read-only, 2026-10-23) lists exactly these, applied in this order, **one
transaction per file**:

| File | Effect | Touches |
|---|---|---|
| `20261023120000_explicit_grants` | explicit Data API grants = current effective privileges, minus TRUNCATE/REFERENCES/TRIGGER for anon/authenticated, views SELECT-only, `content_pages.legal_approved_by` hidden from anon/authenticated | grants only |
| `20261023130000_cod_collection_idempotency_race` | same-key race replays (superseded by 150000 within the same push) | `record_cod_collection` body |
| `20261023140000_least_privilege_defaults` | objects later created by `postgres` are not auto-granted to anon/authenticated; global PUBLIC EXECUTE default revoked | default privileges |
| `20261023150000_cod_collection_idempotency_conflict` | key reuse with another order/amount → `idempotency_conflict`; staff RPCs refuse non-service-role JWTs | `record_cod_collection`, `transition_order_status` bodies |
| `20261023160000_cod_order_idempotency_conflict` | checkout key replayed with a different cart/zone → `idempotency_conflict` | `create_cod_order` body |
| `20261023170000_fix_quote_cod_shipping_zone_type` | **bug fix found 2026-10-23**: shipping quote failed for every address once any active zone exists (`cannot cast type record to shipping_zones`) | `quote_cod_shipping` body |

No table, column, index, policy or row changes. Function signatures, return shapes and owners (`postgres`) unchanged.

### Audit (2026-10-23)
| Check | Result |
|---|---|
| Schema drift: production vs repo-expected pre-B state (read-only fingerprint: 11 function bodies, 35 policies, 24 relations' columns, 37 indexes, 3 triggers, 2 views, default ACLs) | **identical** (function text differs only in CRLF line endings) — replacements revert nothing |
| Executor | CLI login role `cli_login_postgres` is a member of `postgres` → `alter default privileges for role postgres` allowed; new/replaced objects stay owned by `postgres` |
| `auth.role()` (used by the guard) | exists on production |
| Default privileges on production | per-schema only (`public`) for `postgres` and `supabase_admin`; 140000 revokes the `postgres` ones and the global PUBLIC EXECUTE |
| Push path (CLI `migration up`) on a local copy of production state | 6 files applied; privileges (206 rows), schema and function bodies **identical to a fresh build** |
| Mid-sequence failure (injected failing file after 120000) | the failing file rolled back completely; 120000 stayed applied; later files not run; `migration up` resumed cleanly |
| Intermediate states | all safe: staff RPCs stay closed (Option A) at every step; after 130000 only, a reused collection key with another order/amount would replay instead of conflict until 150000 is applied (staff-only path; 0 orders, COD off) |
| Application compatibility | production code (`34f9839`, and this branch) and the old `ea652f2` build only select granted columns (`content_pages`: `title, body_html, status, legal_approved`; catalog through views) |
| Customer paths under Option B (local) | shipping quote, order confirmation by token, contact insert as anon, checkout, admin actions: pass (`docs/ISOLATED_TESTS.md`) |
| Rollback `supabase/rollback/option_b_rollback.sql` | tested: returns privileges, schema and all function bodies to **exactly** the production state of today |

### Residual risks (accepted or owner decision)
- `supabase_admin`'s default privileges still auto-expose objects **it** creates in `public` (platform-managed; no project migration creates objects as `supabase_admin`). Review anything created from the dashboard.
- Anon/authenticated keep INSERT/UPDATE/DELETE grants on tables (RLS denies them except `contact_inquiries` insert); narrowing is future hardening.
- Future `create extension` run as `postgres` will need explicit EXECUTE grants for API roles (intended).
- Brief locks while grants/functions change; no data is rewritten. Use a quiet period.
- Rollback re-opens what Option B closes; prefer a forward fix.

## 4. Procedure (owner-approved execution only)
1. Read-only preflight: `supabase migration list --linked` (7 applied); `supabase db push --linked --dry-run` lists exactly the 6 files above.
2. Backup: `supabase db dump --linked -f <outside-git>/schema-before-option-b.sql`; save the ACL/default-ACL query output from `docs/SECURITY_RPC_REVIEW.md`.
3. Apply: `supabase db push --linked`.
4. On failure: do not edit applied files; fix forward and re-run `supabase db push --linked` (continues with the remaining files).
5. Post-checks (read-only): ledger 13; dry-run reports nothing; ACL — anon/authenticated EXECUTE false on `create_cod_order`, `record_cod_collection`, `transition_order_status`, `consume_rate_limit`; `has_column_privilege('anon','public.content_pages','legal_approved_by','SELECT')` false; `pg_default_acl` for `postgres` in `public` lists only `postgres`, `service_role`; anon probes 42501 on the staff RPCs; anon `quote_cod_shipping` with an address returns `ok` or `unserviceable` (not an error); `npm run test:security:p0` 9/9; `npm run test:security:auth-matrix` 24/24; storefront smoke and Vercel runtime errors.
6. Rollback only on owner instruction: run `supabase/rollback/option_b_rollback.sql`, then `supabase migration repair --status reverted 20261023120000 20261023130000 20261023140000 20261023150000 20261023160000 20261023170000 --linked`.

## 5. Risk of waiting
Option A closed the urgent exposure. Without Option B: the next function/table any migration creates is anon-exposed by default; the staff RPCs have no in-function guard if a grant regresses; reused COD keys can return a replay for a different order/amount; checkout keys can confirm an earlier order for a different cart; the shipping quote breaks as soon as a zone is configured; the approver id becomes public when a policy page is approved.

## 6. Decision
- [x] Option A — applied 2026-10-23 (owner-approved)
- [x] Option B — applied 2026-10-23 (owner-approved)
