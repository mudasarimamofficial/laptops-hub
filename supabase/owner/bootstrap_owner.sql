-- One-time owner bootstrap (docs/FINAL_LAUNCH_OWNER_INPUTS.md § A). Run in the Supabase SQL editor by the owner, or by
-- engineering only after the owner approves this exact email. Replace the email on the first line, nothing else.
-- Refuses (and changes nothing) unless exactly one CONFIRMED user has that email; never touches any other account.
do $$
declare
  v_email constant text := 'OWNER-EMAIL@EXAMPLE.COM';
  v_ids uuid[];
  v_other_owners int;
begin
  select array_agg(id) into v_ids
    from auth.users
   where lower(email) = lower(v_email) and email_confirmed_at is not null and deleted_at is null;
  if coalesce(array_length(v_ids, 1), 0) <> 1 then
    raise exception 'owner bootstrap refused: % confirmed user(s) with email %', coalesce(array_length(v_ids, 1), 0), v_email;
  end if;

  insert into public.admin_memberships (user_id, role, is_active)
  values (v_ids[1], 'owner', true)
  on conflict (user_id) do update set role = 'owner', is_active = true;

  select count(*) into v_other_owners
    from public.admin_memberships
   where role in ('owner', 'admin') and is_active and user_id <> v_ids[1];
  raise notice 'owner set for % (user %); other active owner/admin memberships: %', v_email, v_ids[1], v_other_owners;
end $$;

-- Verify (read-only):
-- select u.email, m.role, m.is_active from public.admin_memberships m join auth.users u on u.id = m.user_id order by m.role;
