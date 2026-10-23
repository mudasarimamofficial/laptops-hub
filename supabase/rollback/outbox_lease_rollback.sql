-- Rollback of 20261024100000_notification_outbox_lease.sql (owner instruction only).
-- Restores the pre-migration table shape. Per-recipient results and claim data are discarded; 'accepted' rows
-- become 'sent' again. Deploy application code from before the lease change FIRST (it does not call
-- claim_notifications and writes 'sent'), then run this, then:
--   supabase migration repair --status reverted 20261024100000 --linked

begin;

drop function if exists public.claim_notifications(integer, integer, uuid, integer, integer, boolean);

alter table public.notification_outbox
  drop constraint if exists notification_outbox_status_chk,
  drop constraint if exists notification_outbox_business_status_chk,
  drop constraint if exists notification_outbox_customer_status_chk;

update public.notification_outbox set status = 'sent' where status = 'accepted';
update public.notification_outbox set status = 'pending' where status = 'sending';

drop index if exists public.notification_outbox_due_idx;

alter table public.notification_outbox
  drop column if exists claim_token,
  drop column if exists claimed_at,
  drop column if exists first_attempt_at,
  drop column if exists next_attempt_at,
  drop column if exists business_status,
  drop column if exists business_message_id,
  drop column if exists business_accepted_at,
  drop column if exists customer_status,
  drop column if exists customer_message_id,
  drop column if exists customer_accepted_at;

commit;
