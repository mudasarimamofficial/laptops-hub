-- Alias / ledger convergence for reel_products.
-- Hosted Supabase already applied the identical DDL under version 20261118162150.
-- This file remains so repositories that only knew 20261118220000 stay compatible.
-- Safe on production: asserts the table exists; does not drop or recreate.

do $$
begin
  if to_regclass('public.reel_products') is null then
    raise exception 'reel_products missing — apply 20261118162150_reel_products.sql first';
  end if;
end
$$;
