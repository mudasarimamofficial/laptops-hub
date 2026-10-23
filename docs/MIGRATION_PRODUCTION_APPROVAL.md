# Production database change — owner approval request

**Status: Option A APPLIED 2026-10-23 (owner-approved; see Outcome). Option B NOT applied.** Prepared 2026-10-23.

| | |
|---|---|
| Target | Supabase project `xvmmjkrkgznnakcobmww` ("Laptops Hub", ap-southeast-1) |
| Applied ledger (read 2026-10-23) | `20261021120000` … `20261021160000` (6 migrations) |
| Pending in repo (`fix/v5-correctness-parity`) | `20261023110000`, `20261023120000`, `20261023130000`, `20261023140000`, `20261023150000`, `20261023160000` |

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

Still pending in repo (not applied): `20261023120000`, `20261023130000`, `20261023140000`, `20261023150000`,
`20261023160000` (Option B). `supabase db push` would now apply exactly these five.

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

## 3. Option B — full pending set (after Option A, or instead of it)

`supabase db push --linked` applies, in order, all six pending migrations:

| File | Effect |
|---|---|
| `20261023110000_emergency_revoke_staff_rpc_execute` | Option A (no-op if already applied) |
| `20261023120000_explicit_grants` | explicit Data API grants; drops TRUNCATE/REFERENCES/TRIGGER for anon/authenticated; views read-only; hides `content_pages.legal_approved_by` from anon |
| `20261023130000_cod_collection_idempotency_race` | same-key race replays instead of erroring (superseded by 150000) |
| `20261023140000_least_privilege_defaults` | future tables/sequences/functions created by `postgres` are no longer auto-granted to anon/authenticated |
| `20261023150000_cod_collection_idempotency_conflict` | key reuse with another order/amount → `idempotency_conflict`; both staff RPCs refuse non-service-role JWTs |
| `20261023160000_cod_order_idempotency_conflict` | checkout key replayed with a different cart/zone → `idempotency_conflict` instead of the earlier order (checkout is off; no live effect) |

- **Simulated locally** (legacy auto-expose grants = production, then all six): privileges are identical to a fresh
  build; future objects are not exposed; isolated suites pass (`docs/ISOLATED_TESTS.md`).
- **Compatibility:** this branch's code handles `idempotency_conflict` (409) in `/api/admin/cod-collections` and
  `/api/checkout/cod`. If the database is migrated **before** this code is deployed, the old route maps the new error to
  a generic 500 "Could not record collection" (still no false success). No other behaviour change for current code.
- **Rollback:** grants — re-grant from the "before" list in `docs/SECURITY_RPC_REVIEW.md`; functions — re-run the
  function bodies from `20261021160000` / `20261023130000` / `20261021140000`; default privileges — the inverse `alter default
  privileges … grant`. A schema-only backup (`supabase db dump --linked -f before.sql`) before applying is advised.

## 4. Preflight (read-only) and post-change checks

Before: `supabase migration list --linked` shows exactly the 6 applied versions above; run the ACL query in
`docs/SECURITY_RPC_REVIEW.md` and save the output.

After (non-mutating):
1. Same ACL query: anon/authenticated EXECUTE = false on the three functions; unchanged elsewhere (Option A).
2. Anon probe that cannot write: `POST /rest/v1/rpc/record_cod_collection` with `{"payload":{}}` and the anon key
   → `42501 permission denied` (today: `P0001 validation_failed`, i.e. callable).
3. `npm run test:security:p0` (9/9) and `npm run test:security:auth-matrix` (24/24) against production.
4. Storefront smoke: home, a PDP, `/collections/laptops`, contact form page; Supabase logs for permission errors.

## 5. Risk of waiting

Each day the staff RPCs stay anon-executable, approving and publishing a legal page (or any other leak of a staff
UUID) turns the exposure into a working way to fake cash collections and order status changes.

## 6. Decision

- [ ] **Approve Option A** on `xvmmjkrkgznnakcobmww` (emergency revoke only)
- [ ] **Approve Option B** (all six pending migrations) — recommended together with deploying this branch
- [ ] Do not approve (exposure remains live)
