-- Defence in depth + query performance. Additive / privilege-narrowing only; safe to re-run.
--
-- 1. anon (signed-out visitors) keeps table-level INSERT/UPDATE/DELETE on the tables created before
--    20261023140000 (explicit_grants mirrored the legacy auto-expose defaults). RLS already denies every one of
--    those writes — the only anon write policy is contact_inquiries INSERT (the public contact form, which uses
--    the anon server client). Revoke the rest so a future permissive policy cannot silently open a table.
--    authenticated keeps its grants: staff writes go through RLS policies that check admin_memberships.
--    Rollback: re-grant with `grant insert, update, delete on table public.<t> to anon;` (not expected to be needed).
--
-- 2. Covering indexes for foreign keys used by admin order/fulfilment pages, cascades and audit lookups
--    (Supabase advisor "unindexed_foreign_keys"). Plain CREATE INDEX IF NOT EXISTS: these tables are small
--    (tens to low thousands of rows), so the brief lock is negligible. Rollback: drop index.

do $$
declare t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    if t = 'contact_inquiries' then
      execute format('revoke update, delete, truncate on table public.%I from anon', t);
    else
      execute format('revoke insert, update, delete, truncate on table public.%I from anon', t);
    end if;
  end loop;
end $$;

create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_variant_id_idx on public.order_items (variant_id);
create index if not exists order_items_product_id_idx on public.order_items (product_id);
create index if not exists order_events_order_id_idx on public.order_events (order_id);
create index if not exists fulfillments_order_id_idx on public.fulfillments (order_id);
create index if not exists cod_collections_order_id_idx on public.cod_collections (order_id);
create index if not exists notification_outbox_order_id_idx on public.notification_outbox (order_id);
create index if not exists orders_shipping_zone_id_idx on public.orders (shipping_zone_id);
create index if not exists collection_products_product_id_idx on public.collection_products (product_id);
create index if not exists inventory_ledger_actor_user_id_idx on public.inventory_ledger (actor_user_id);
create index if not exists import_jobs_actor_user_id_idx on public.import_jobs (actor_user_id);
create index if not exists products_updated_by_idx on public.products (updated_by);
create index if not exists products_deleted_by_idx on public.products (deleted_by);
create index if not exists theme_versions_created_by_idx on public.theme_versions (created_by);
create index if not exists theme_publications_updated_by_idx on public.theme_publications (updated_by);
create index if not exists theme_publications_published_version_id_idx on public.theme_publications (published_version_id);
