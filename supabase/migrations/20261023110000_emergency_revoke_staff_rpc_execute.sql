-- EMERGENCY, minimal: server-only RPCs must not be executable through the Data API by anon/authenticated.
--
-- Production (verified read-only 2026-10-23 via pg_proc ACLs): anon and authenticated hold EXECUTE on
--   record_cod_collection(jsonb)        SECURITY DEFINER, trusts payload.actor_user_id
--   transition_order_status(jsonb)      SECURITY DEFINER, trusts payload.actor_user_id
--   consume_rate_limit(text,int,int)    SECURITY DEFINER, writes rate_limit_buckets
-- granted by the legacy default privileges, although their migrations restricted them to service_role.
-- The app calls all three only with the service-role client (createAuthorizedStaffClient / rate-limit.ts).
--
-- This file is self-contained and idempotent so it can be applied on its own, ahead of the broader
-- 20261023120000_explicit_grants.sql (which repeats these revokes). No data, tables or other grants change.
-- Rollback (re-opens the exposure, not recommended):
--   grant execute on function <same three> to anon, authenticated;

revoke execute on function
  public.record_cod_collection(jsonb),
  public.transition_order_status(jsonb),
  public.consume_rate_limit(text, integer, integer)
from public, anon, authenticated;

grant execute on function
  public.record_cod_collection(jsonb),
  public.transition_order_status(jsonb),
  public.consume_rate_limit(text, integer, integer)
to service_role;
