-- Explicit Data API privileges.
--
-- Until now the schema relied on Supabase's legacy "auto-expose" default privileges, which granted every
-- privilege on new tables/functions to anon, authenticated and service_role. That behaviour is being removed
-- (2026-10-30), so a database rebuilt from these migrations would deny every API call. This migration states
-- the privileges explicitly. RLS remains the row-level gate for anon/authenticated.
--
-- Differences from the legacy grants (intentional):
--   * record_cod_collection, transition_order_status, consume_rate_limit: service_role only, as their original
--     migrations intended. The legacy defaults had re-granted them to anon/authenticated; the staff RPCs are
--     SECURITY DEFINER and trust payload.actor_user_id, so anyone knowing a staff UUID could call them directly.
--     The app only calls them with the service-role client.
--   * anon/authenticated lose TRUNCATE, REFERENCES and TRIGGER (never used through the API; TRUNCATE ignores RLS).
--   * Views are read-only for anon/authenticated.
--   * content_pages.legal_approved_by (a staff UUID) is no longer readable by anon/authenticated.

grant usage on schema public to anon, authenticated, service_role;

-- ── Tables ──────────────────────────────────────────────────────────────────
revoke all on all tables in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;

grant select, insert, update, delete on table
  public.admin_memberships,
  public.articles,
  public.audit_logs,
  public.cod_collections,
  public.collection_products,
  public.collections,
  public.contact_inquiries,
  public.faq_entries,
  public.fulfillments,
  public.import_jobs,
  public.notification_outbox,
  public.order_addresses,
  public.order_events,
  public.order_items,
  public.orders,
  public.product_media,
  public.rate_limit_buckets,
  public.shipping_zones,
  public.store_settings
to anon, authenticated;

-- Catalog: internal columns stay hidden (P0 hardening, 20261021130000).
grant insert, update, delete on table public.products, public.product_variants to anon, authenticated;
grant select (
  id, handle, title, description_safe, merchant_vendor, manufacturer, product_type, category, status,
  featured, tags, specs, seo_title, seo_description, created_at, updated_at
) on table public.products to anon, authenticated;
grant select (
  id, product_id, sku, title, option_values, price_paisa, compare_at_paisa, purchasable, max_per_order,
  created_at, updated_at
) on table public.product_variants to anon, authenticated;

-- CMS pages: everything except the approver's user id.
grant insert, update, delete on table public.content_pages to anon, authenticated;
grant select (
  id, slug, title, body_html, status, updated_at, legal_approved, legal_approved_at
) on table public.content_pages to anon, authenticated;

-- Views (security_invoker, not updatable).
grant select on table public.catalog_products_public, public.public_catalog_listing to anon, authenticated;

-- ── Sequences ───────────────────────────────────────────────────────────────
grant usage, select on all sequences in schema public to anon, authenticated;
grant all on all sequences in schema public to service_role;

-- ── Functions ───────────────────────────────────────────────────────────────
grant execute on all functions in schema public to service_role;

-- Public / RLS helpers.
grant execute on function
  public.get_order_confirmation_by_token(uuid),
  public.quote_cod_shipping(jsonb),
  public.is_staff(),
  public.has_staff_role(public.staff_role[]),
  public.norm_place(text),
  public.zone_serves_address(public.shipping_zones, text, text),
  public.set_updated_at()
to anon, authenticated;

-- Server-only (service role).
revoke execute on function
  public.create_cod_order(jsonb),
  public.record_cod_collection(jsonb),
  public.transition_order_status(jsonb),
  public.consume_rate_limit(text, integer, integer)
from public, anon, authenticated;
