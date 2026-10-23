-- Notification outbox: processing lease, per-recipient state, bounded retries (docs/NOTIFICATIONS.md).
--
-- Before: a worker claimed a row by flipping status to 'sending'; stale recovery used the row's created_at, so an
-- old notification could be reclaimed while a worker was still sending it, and the outcome of each recipient was
-- not recorded. Now:
--   * claim_notifications() claims rows atomically (FOR UPDATE SKIP LOCKED) and gives each claim a token + time;
--     every later write by the worker is conditional on that token, so an expired worker cannot overwrite a newer
--     result. Stale recovery uses claimed_at (lease age).
--   * business_* / customer_* record each recipient separately; an accepted recipient is never sent again.
--   * Automatic retries: max attempts, backoff (next_attempt_at) and a retry window inside the provider's 24-hour
--     idempotency retention; beyond it rows become 'failed' for a staff decision (manual retry).
--   * 'accepted' = accepted by the email provider (not confirmed delivery). Legacy 'sent' rows become 'accepted'.
-- Additive: existing columns and the create_cod_order insert are unchanged.

alter table public.notification_outbox
  add column if not exists claim_token uuid,
  add column if not exists claimed_at timestamptz,
  add column if not exists first_attempt_at timestamptz,
  add column if not exists next_attempt_at timestamptz not null default pg_catalog.now(),
  add column if not exists business_status text not null default 'pending',
  add column if not exists business_message_id text,
  add column if not exists business_accepted_at timestamptz,
  add column if not exists customer_status text not null default 'pending',
  add column if not exists customer_message_id text,
  add column if not exists customer_accepted_at timestamptz;

update public.notification_outbox set status = 'accepted', business_status = 'accepted', business_accepted_at = sent_at
where status = 'sent';

alter table public.notification_outbox
  add constraint notification_outbox_status_chk check (status in ('pending', 'sending', 'accepted', 'failed')),
  add constraint notification_outbox_business_status_chk check (business_status in ('pending', 'accepted', 'failed')),
  add constraint notification_outbox_customer_status_chk check (customer_status in ('pending', 'accepted', 'failed', 'skipped'));

create index if not exists notification_outbox_due_idx on public.notification_outbox (status, next_attempt_at);

create or replace function public.claim_notifications(
  p_limit integer default 10,
  p_lease_seconds integer default 300,
  p_order_id uuid default null,
  p_max_attempts integer default 5,
  p_retry_window_hours integer default 23,
  p_manual boolean default false
)
returns setof public.notification_outbox
language plpgsql
-- Invoker rights: the function grants nothing beyond what the caller already has (service_role: table privileges,
-- bypasses RLS). Empty search_path; every reference is schema-qualified (pg_catalog is always searched).
security invoker
set search_path = ''
as $$
begin
  -- Fail closed: only a request whose JWT role claim is service_role. A missing claim (NULL) is rejected too.
  if auth.role() is distinct from 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Give up automatically on rows that may not be retried any more (attempts used up, or the first attempt is older
  -- than the retry window so the provider no longer de-duplicates). They stay visible as 'failed' for staff.
  if not p_manual then
    update public.notification_outbox o
       set status = 'failed', claim_token = null,
           last_error = pg_catalog.left(coalesce(o.last_error || ' · ', '') || 'automatic retries stopped', 500)
     where (p_order_id is null or o.order_id = p_order_id)
       and (
         (o.status = 'sending' and o.claimed_at < pg_catalog.now() - pg_catalog.make_interval(secs => p_lease_seconds))
         or o.status in ('pending', 'failed')
       )
       and (o.attempts >= p_max_attempts
            or o.first_attempt_at < pg_catalog.now() - pg_catalog.make_interval(hours => p_retry_window_hours))
       and not (o.status = 'failed' and coalesce(o.last_error, '') like '%automatic retries stopped');
  end if;

  return query
  with due as (
    select o.id
      from public.notification_outbox o
     where (p_order_id is null or o.order_id = p_order_id)
       and (
         -- waiting rows
         (o.status in ('pending', 'failed')
           and (p_manual
                or (o.attempts < p_max_attempts
                    and o.next_attempt_at <= pg_catalog.now()
                    and (o.first_attempt_at is null
                         or o.first_attempt_at >= pg_catalog.now() - pg_catalog.make_interval(hours => p_retry_window_hours)))))
         -- abandoned claims: lease expired (claim age, not row age)
         or (o.status = 'sending'
             and o.claimed_at < pg_catalog.now() - pg_catalog.make_interval(secs => p_lease_seconds)
             and (p_manual
                  or (o.attempts < p_max_attempts
                      and o.first_attempt_at >= pg_catalog.now() - pg_catalog.make_interval(hours => p_retry_window_hours))))
       )
     order by o.created_at
     limit greatest(1, least(p_limit, 100))
     for update skip locked
  )
  update public.notification_outbox o
     set status = 'sending',
         claim_token = pg_catalog.gen_random_uuid(),
         claimed_at = pg_catalog.now(),
         attempts = o.attempts + 1,
         first_attempt_at = coalesce(o.first_attempt_at, pg_catalog.now())
    from due
   where o.id = due.id
  returning o.*;
end;
$$;

alter function public.claim_notifications(integer, integer, uuid, integer, integer, boolean) owner to postgres;
revoke all on function public.claim_notifications(integer, integer, uuid, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.claim_notifications(integer, integer, uuid, integer, integer, boolean) to service_role;
