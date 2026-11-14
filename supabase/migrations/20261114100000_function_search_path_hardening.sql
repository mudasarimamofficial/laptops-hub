-- Supabase security advisor: function_search_path_mutable (norm_place, zone_serves_address, set_updated_at).
-- Pin an empty search_path; every body already schema-qualifies its references (public.*) or uses pg_catalog
-- built-ins (lower, trim, coalesce, now), which are always resolvable. Additive, idempotent, no data change.
-- NOT applied to production: requires owner approval (docs/LAPTOPS_HUB_MIGRATION_AND_RELEASE_RUNBOOK.md).
BEGIN;

ALTER FUNCTION public.norm_place(text) SET search_path = '';
ALTER FUNCTION public.zone_serves_address(public.shipping_zones, text, text) SET search_path = '';
ALTER FUNCTION public.set_updated_at() SET search_path = '';

COMMIT;
