-- Least-privilege default privileges for objects that later migrations create (migrations run as postgres).
--
-- Production's defaults (pg_default_acl, verified read-only 2026-10-23) grant ALL on new tables/sequences and
-- EXECUTE on new functions in public to anon and authenticated. 20261023120000 fixed the existing objects only,
-- so the next SECURITY DEFINER function or table would be exposed again. From here on every migration must grant
-- what it needs explicitly (see docs/SECURITY_RPC_REVIEW.md).
--
-- Defaults owned by supabase_admin are platform-managed and cannot be changed by postgres; no project migration
-- creates objects as supabase_admin.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
-- EXECUTE for PUBLIC is a built-in global default; per-schema defaults cannot remove it, so revoke it globally
-- for objects postgres creates (auth/storage functions are owned by supabase_admin and unaffected).
alter default privileges for role postgres
  revoke execute on functions from public;

-- service_role keeps full access to new objects (server code).
alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
