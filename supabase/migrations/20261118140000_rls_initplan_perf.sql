-- Performance: wrap auth.uid() in (select ...) so RLS init plans evaluate once per query.
-- Advisors: auth_rls_initplan on admin_memberships_self_select and inventory_ledger_staff_read.
-- Behavior unchanged; no privilege expansion.

drop policy if exists admin_memberships_self_select on public.admin_memberships;
create policy admin_memberships_self_select
  on public.admin_memberships
  for select
  using (((user_id = (select auth.uid())) or public.is_staff()));

drop policy if exists inventory_ledger_staff_read on public.inventory_ledger;
create policy inventory_ledger_staff_read
  on public.inventory_ledger
  for select
  using (
    exists (
      select 1
      from public.admin_memberships m
      where m.user_id = (select auth.uid())
        and m.is_active = true
    )
  );
