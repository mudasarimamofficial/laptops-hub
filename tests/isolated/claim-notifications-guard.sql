-- claim_notifications() authorization, at the database level (LOCAL Supabase only; everything rolls back).
--   docker exec -i <supabase_db container> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/isolated/claim-notifications-guard.sql
-- Any failed expectation raises an exception (psql exits non-zero); each passing check prints "ok - …".
begin;

insert into public.notification_outbox (order_id, channel, template) values (null, 'email', 'guard_test');

-- 1. Service-role database role WITHOUT a JWT role claim → rejected (fail closed; previously NULL counted as service_role).
set local role service_role;
do $$ begin
  perform public.claim_notifications(p_limit => 100, p_manual => true);
  raise exception 'FAIL: call without role claim was accepted';
exception when insufficient_privilege then raise notice 'ok - missing role claim rejected';
end $$;
reset role;

-- 2. authenticated (no EXECUTE) → permission denied.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
do $$ begin
  perform public.claim_notifications(p_limit => 100, p_manual => true);
  raise exception 'FAIL: authenticated could execute';
exception when insufficient_privilege then raise notice 'ok - authenticated refused';
end $$;
reset role;

-- 3. anon even if EXECUTE were re-granted by mistake → the guard refuses.
grant execute on function public.claim_notifications(integer, integer, uuid, integer, integer, boolean) to anon;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  perform public.claim_notifications(p_limit => 100, p_manual => true);
  raise exception 'FAIL: anon passed the guard';
exception when insufficient_privilege then raise notice 'ok - anon refused by guard (EXECUTE re-granted)';
end $$;

-- 4. Defence in depth: anon database role with a (hypothetically forged) service_role claim passes the guard, but the
--    function runs with the caller's rights (SECURITY INVOKER) → RLS hides every row, nothing is claimed.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$ declare n int; begin
  select count(*) into n from public.claim_notifications(p_limit => 100, p_manual => true);
  if n <> 0 then raise exception 'FAIL: anon claimed % rows', n; end if;
  raise notice 'ok - invoker rights: forged claim on anon role claims nothing';
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.notification_outbox where template = 'guard_test' and status <> 'pending') then
    raise exception 'FAIL: row changed by anon';
  end if;
end $$;

-- 5. Proper service-role request → works.
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$ declare n int; begin
  select count(*) into n from public.claim_notifications(p_limit => 100, p_manual => true) c where c.template = 'guard_test';
  if n <> 1 then raise exception 'FAIL: service role claimed % guard rows', n; end if;
  raise notice 'ok - service_role claim works';
end $$;
reset role;

-- 6. Hardening attributes.
do $$ declare r record; begin
  select p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) as owner,
         has_function_privilege('anon', p.oid, 'execute') as anon_x,
         has_function_privilege('authenticated', p.oid, 'execute') as auth_x,
         has_function_privilege('service_role', p.oid, 'execute') as svc_x
    into r from pg_proc p where p.oid = 'public.claim_notifications(integer, integer, uuid, integer, integer, boolean)'::regprocedure;
  -- anon_x is true here only because of step 3's grant inside this transaction; check the others.
  if r.prosecdef then raise exception 'FAIL: security definer'; end if;
  if r.proconfig is distinct from array['search_path=""'] then raise exception 'FAIL: search_path %', r.proconfig; end if;
  if r.owner <> 'postgres' then raise exception 'FAIL: owner %', r.owner; end if;
  if r.auth_x or not r.svc_x then raise exception 'FAIL: execute privileges'; end if;
  raise notice 'ok - invoker, search_path empty, owner postgres, EXECUTE service_role only';
end $$;

rollback;
