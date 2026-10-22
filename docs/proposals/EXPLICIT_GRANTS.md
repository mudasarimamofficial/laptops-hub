# Explicit GRANTs — implemented locally, NOT applied to production

Migration: `supabase/migrations/20261023120000_explicit_grants.sql` (2026-10-23).

**Update (later 2026-10-23):** the urgent part is now a separate, smaller migration `20261023110000` that can be applied alone; future-object defaults are fixed in `20261023140000`. Current review and approval request: `docs/SECURITY_RPC_REVIEW.md`, `docs/MIGRATION_PRODUCTION_APPROVAL.md`.

## Why
The earlier migrations never granted privileges to `anon`, `authenticated` or `service_role`; the hosted project
got them from Supabase's legacy "auto-expose" default privileges, which are removed on **2026-10-30**. Without
explicit grants, a database rebuilt from migrations (local stack, branch, disaster recovery) denies every API call.

## Security finding (live on production today)
The legacy defaults re-granted EXECUTE to `anon`/`authenticated` on three functions the migrations had restricted
to `service_role`. Verified on production 2026-10-23 with non-mutating probes (empty payload → `validation_failed`
from inside the function, i.e. callable; `create_cod_order` correctly returns `42501`):

| Function | Risk |
|---|---|
| `record_cod_collection` | `SECURITY DEFINER`, trusts `payload.actor_user_id` → anyone knowing an active staff UUID can record cash collections over `/rest/v1/rpc` |
| `transition_order_status` | same → can change order status |
| `consume_rate_limit` | can inflate any rate-limit bucket (contact-form denial of service) |

No staff UUID is currently readable by `anon`, but `content_pages.legal_approved_by` becomes readable the moment
the owner approves and publishes a legal page. **Apply this migration before approving any legal page.**

## What the migration does
Same as production's effective privileges, except (intentionally):
- the three functions above: `service_role` only (the app calls them only with the service-role client);
- `anon`/`authenticated` lose TRUNCATE, REFERENCES, TRIGGER (unused via the API; TRUNCATE ignores RLS);
- the two catalog views are SELECT-only;
- `content_pages.legal_approved_by` is not selectable by `anon`/`authenticated`.

Row access is unchanged (RLS). Write privileges for `anon`/`authenticated` are kept (e.g. the contact route
inserts as `anon`); narrowing them is a separate change.

## Verification (local Supabase, never production)
- Fresh DB from migrations with `auto_expose_new_tables` removed: privilege snapshot (206 rows: schema, tables,
  catalog/content columns, functions) differs from the legacy baseline only in the items above.
- Production path simulated (legacy auto-expose on, then this migration): **identical** end state.
- Role matrix 15/15 · checkout isolated 21/21 (incl. anon denied on the three RPCs; 8×6 HTTP submits all 200) ·
  role HTTP 87/87 (incl. approver id not readable) · anon reads catalog listing/prices, hidden columns denied,
  anon product update affects 0 rows.
- COD concurrency: the unrelated same-key collection race is fixed separately in `20261023130000` (10/10).

## Applying to production (owner)
Review, then `supabase db push` (or SQL editor) during a quiet window; re-run `npm run test:security:p0` and
`npm run test:security:auth-matrix` against production afterwards. New tables/functions now need their own GRANTs.
