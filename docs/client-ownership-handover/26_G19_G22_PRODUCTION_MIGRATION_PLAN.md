# 26 — G22 (and G19) production migration plan

**Status: PREPARED — NOT APPLIED TO PRODUCTION. Each migration needs the owner's explicit approval in chat.**
Merging the code is separate from running the database change (same pattern as LH-025, doc 24). The merged code is
built to work **before** the database change: verified locally by hiding the new table and function (§G22-4).

---

## G22 — COD collection financial safety

Migration: `supabase/migrations/20261126140000_cod_collection_adjustments.sql`

### G22-1. What it changes

| # | Change | Kind |
|---|---|---|
| 1 | New table `cod_collection_adjustments` (append-only ledger: reversal / correction, signed amount, reason 5–500 chars, staff, time, idempotency key, before/after collected) | additive |
| 2 | RLS on, no policies; `anon`/`authenticated` nothing; `service_role` SELECT + INSERT only | additive |
| 3 | Trigger `cod_ledger_append_only` on `cod_collections` and the new table: UPDATE refused; DELETE refused unless the order itself is being deleted | new guard on an existing table |
| 4 | `REVOKE TRUNCATE ON cod_collections FROM service_role` (and public/anon/authenticated): TRUNCATE skips row triggers | grant change on an existing table |
| 5 | `record_cod_collection(jsonb)` replaced: identical to 20261023150000 plus `order_closed` for cancelled/returned orders | function replace, same signature and grants |
| 6 | New `adjust_cod_collection(jsonb)`: owner/admin/manager, server-only, row lock, idempotent, keeps 0 ≤ collected ≤ total due, writes ledger + `order_events` + `audit_logs`; collected back to 0 → `refunded_or_adjusted` | additive |

**Not changed:** order totals, subtotal, shipping, COD fee, discount (5% campaign), `create_cod_order`, checkout,
existing rows. No data is migrated.

### G22-2. Production facts (read-only, 2026-11-26)

| Fact | Value |
|---|---|
| Orders | 1 (`placed`, `unpaid_cod`, collected 0) |
| `cod_collections` rows | 0 |
| `cod_collection_adjustments` / `adjust_cod_collection` | absent |
| Triggers on `cod_collections` | 0 |
| `service_role` on `cod_collections` | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| `record_cod_collection` definition md5 | `6c6ca2e59c0db85749b296725e7d9cc5` = exactly the 20261023150000 version (checked locally) |
| Migration ledger | 43/43 aligned (doc 24 §10); this would be the 44th |

### G22-3. Evidence (local isolated stack)

| Test | Result |
|---|---|
| `scripts/db-tests/cod-adjustments-matrix.sql` (rolled back) | **41/41** — roles, reasons, idempotent replay/conflict, double reversal, bounds, `refunded_or_adjusted`, ledger arithmetic, events, audit, totals unchanged incl. a 5%-discount order, append-only UPDATE/DELETE, grants incl. TRUNCATE, Data-API refusal, order delete cascade |
| `scripts/db-tests/shipping-cod-matrix.sql` | 37/37 (test now pauses campaigns inside its rolled-back transaction; it predated the 5% campaign) |
| `scripts/db-tests/reels-reviews-matrix.sql` | 15/15 |
| `tests/e2e-isolated/p1-cod-ledger-g22.spec.ts` | 3/3 — UI collect with its own note, reverse, correct, reload; API replay/conflict/bounds/reason; fulfillment 403; cancelled order refuses cash (UI + API) |
| Order/admin regression (owner acceptance 36 steps, variant order journey, backup/COD gate, isolation/checkout gates, launch journey, prehydration, admin mobile matrix) | 54/54 after updating the acceptance spec to the G13 media form |
| Migration re-applied twice locally | idempotent |

### G22-4. Code behaviour before the migration (what production runs after the merge)

- Collection route refuses cancelled/returned orders itself (409 `order_closed`) — **active immediately**.
- Collection form has its own note (no longer reuses the fulfilment note).
- Cash history shows collections with staff and time; reversal/correction controls are replaced by
  "available after the pending database update".
- `POST /api/admin/cod-collections/adjust` answers 503 `not_available`.
- Verified locally with the table and function renamed away: page OK, adjust 503, normal collection 200.

### G22-5. Execution steps (only after approval)

1. `npx supabase migration list --linked` → exactly one pending: `20261126140000`. If anything else is pending, stop.
2. Pre-checks (read-only): the md5 above unchanged; `to_regclass('public.cod_collection_adjustments')` is null;
   `cod_collections` row count recorded.
3. `npx supabase db push --linked` (applies only that file).
4. Post-checks (read-only):
   - table, 3 indexes, 2 triggers present;
   - `has_function_privilege('anon'|'authenticated', 'public.adjust_cod_collection(jsonb)', 'EXECUTE')` = false;
   - `has_table_privilege('service_role', 'public.cod_collections', 'TRUNCATE')` = false;
   - `has_table_privilege('service_role', 'public.cod_collection_adjustments', 'UPDATE')` = false;
   - order count and totals unchanged.
5. Admin smoke (read-only): open the existing order page; "Cash history" shows the correction form for the owner.
   **No real or fake collection, reversal or correction is recorded in production.**
6. Record the execution in this document.

### G22-6. Rollback

Safe while the ledger is empty; if any adjustment exists, keep the table (it is the financial record) and only roll back
the function changes.

```sql
DROP TRIGGER IF EXISTS cod_collections_append_only ON public.cod_collections;
DROP TRIGGER IF EXISTS cod_collection_adjustments_append_only ON public.cod_collection_adjustments;
DROP FUNCTION IF EXISTS public.adjust_cod_collection(jsonb);
DROP TABLE IF EXISTS public.cod_collection_adjustments;      -- only if it has 0 rows
DROP FUNCTION IF EXISTS public.cod_ledger_append_only();
GRANT TRUNCATE ON TABLE public.cod_collections TO service_role;
-- then re-run the record_cod_collection definition from 20261023150000_cod_collection_idempotency_conflict.sql
```

followed by `npx supabase migration repair --linked --status reverted 20261126140000`. The merged code keeps working
(it falls back to the pre-migration behaviour in G22-4).

### G22-7. Decision needed

`G22-DB`: approve applying `20261126140000` to production as in G22-5.

---

## G19 — content-page revisions

In preparation (next section of this document): migration, local rehearsal and exact production plan. Not applied.
