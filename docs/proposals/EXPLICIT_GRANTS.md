# Proposal: explicit GRANTs in migrations (owner review — not applied)

## Why
The migrations in `supabase/migrations/` never `GRANT` table or function privileges to `anon`, `authenticated`
or `service_role`. The hosted project gets them from Supabase's legacy default privileges ("auto-expose new
tables"). A fresh database built from the migrations alone (current CLI default) gives those roles **no** table
privileges: every API call fails with `permission denied` (observed on the local stack, 2026-10-22).

Locally this is papered over with `auto_expose_new_tables = true` in `supabase/config.toml`. That option is
deprecated and is removed on **2026-10-30**; after that, a local stack, a Supabase branch or a disaster-recovery
rebuild from migrations will not work until the grants are explicit.

## Effective privileges today (local stack with legacy auto-expose = production behaviour)
- 24 public tables/views; `anon`, `authenticated` and `service_role` hold all table privileges on each (RLS is
  what actually restricts rows), except:
  - `products`, `product_variants`: `anon`/`authenticated` have **column-level** `SELECT` only (P0 hardening —
    internal columns hidden); `service_role` has full `SELECT`.
- Functions: `create_cod_order` is `service_role` only. All others (`consume_rate_limit`,
  `get_order_confirmation_by_token`, `has_staff_role`, `is_staff`, `norm_place`, `quote_cod_shipping`,
  `record_cod_collection`, `transition_order_status`, `zone_serves_address`) are executable by `anon` and
  `authenticated`; the staff RPCs check `is_staff`/`has_staff_role` internally (verified by the role matrix).

## Proposed migration (review, then add as a new timestamped file)
Step 1 reproduces today's behaviour exactly, so it is safe on production (a no-op there). Step 2 is optional
tightening that needs its own testing.

```sql
-- 1. Explicit grants equal to the current legacy defaults.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to service_role;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
-- P0: keep internal product/variant columns hidden (re-apply the column lists from 20261021130000).
revoke select on public.products, public.product_variants from anon, authenticated;
-- grant select (<public columns>) on public.products to anon, authenticated;  -- copy from P0 migration
-- grant select (<public columns>) on public.product_variants to anon, authenticated;

grant execute on function public.consume_rate_limit, public.get_order_confirmation_by_token,
  public.has_staff_role, public.is_staff, public.norm_place, public.quote_cod_shipping,
  public.record_cod_collection, public.transition_order_status, public.zone_serves_address
  to anon, authenticated;
revoke execute on function public.create_cod_order from public, anon, authenticated;

-- 2. Optional tightening (separate change): drop TRUNCATE/REFERENCES/TRIGGER from anon/authenticated
--    (already omitted above) and revoke write privileges on tables that only staff/service code writes.
```

Function signatures must be spelled out (`grant execute on function name(argtypes)`) when the migration is
written; generate them with `select oid::regprocedure from pg_proc where pronamespace = 'public'::regnamespace`.

## Verification
`supabase db reset --local` with `auto_expose_new_tables` removed, then run the isolated suite
(`docs/ISOLATED_TESTS.md`) and `npm run test:security:p0`. All must pass before applying to production.
