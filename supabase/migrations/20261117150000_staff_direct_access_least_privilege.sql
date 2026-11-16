-- Least privilege for direct Data API (PostgREST) access + a public, boolean-only stock signal.
--
-- 1. Staff privilege escalation through the Data API (pre-existing since 20261021120000 / 20261023120000).
--    The *_staff_all RLS policies allow FOR ALL when is_staff() — i.e. ANY active membership — and `authenticated`
--    held table-level INSERT/UPDATE/DELETE. A fulfillment or editor account could therefore, with its own access
--    token and without going through the Next.js role checks, change prices/stock, zero shipping fees, enable COD
--    in store_settings, mark legal pages approved, record cash collections or publish articles, and read every
--    order and address. Reproduced by scripts/security-direct-staff-access.mjs.
--    The application performs every merchant write and private read with the service role after
--    requireStaff(allowedRoles) (src/lib/auth/staff.ts), so direct table writes by anon/authenticated are not
--    needed by any code path. Revoking them closes the hole without touching the app.
--    Kept: public catalog/content SELECT (column-level where internal columns exist), anon/authenticated INSERT
--    on contact_inquiries (insert-only contact form), staff SELECT on theme tables, inventory_ledger and own
--    membership.
--
-- 2. product_media internal rights metadata (approval, rights_note, source_provider, origin, health checks) was
--    readable by anon — the same class of data already hidden on products.media_approval. The storefront reads
--    only url/alt/position.
--
-- 3. catalog_products_public (security_invoker) filters on products.deleted_at, which public roles could not
--    read, so the view failed with 42501 for anon. deleted_at is a timestamp that is NULL on every row the public
--    policy can see (soft delete also archives); granting it is harmless.
--
-- 4. storefront_variant_availability(product_ids): the PDP needs to know whether each variant can be bought now
--    without learning stock quantities. Mirrors create_cod_order's stock rule exactly (tracked stock must cover
--    one unit unless the merchant allowed overselling; tracked with NULL quantity is not purchasable).
--
-- Additive/reversible: privileges and one function only; no table, column or data changes.
-- Rollback: re-grant the revoked privileges (see docs/LAPTOPS_HUB_MIGRATION_COMPATIBILITY_MATRIX.md) and
-- DROP FUNCTION public.storefront_variant_availability(uuid[]).

-- ── 1. no direct writes to merchant tables ───────────────────────────────────────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.admin_memberships,
  public.articles,
  public.audit_logs,
  public.cod_collections,
  public.collection_products,
  public.collections,
  public.content_pages,
  public.faq_entries,
  public.fulfillments,
  public.import_jobs,
  public.notification_outbox,
  public.order_addresses,
  public.order_events,
  public.order_items,
  public.orders,
  public.product_media,
  public.product_variants,
  public.products,
  public.rate_limit_buckets,
  public.shipping_zones,
  public.store_settings
FROM anon, authenticated;

-- Contact form: insert-only for the public (inquiries_anon_insert); staff read inquiries via the service role.
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.contact_inquiries FROM anon, authenticated;
GRANT INSERT ON TABLE public.contact_inquiries TO anon, authenticated;

-- ── customer PII and operational tables: no direct reads (admin reads them via the service role) ──────────────────
REVOKE SELECT ON TABLE
  public.audit_logs,
  public.cod_collections,
  public.contact_inquiries,
  public.fulfillments,
  public.import_jobs,
  public.notification_outbox,
  public.order_addresses,
  public.order_events,
  public.order_items,
  public.orders,
  public.rate_limit_buckets
FROM anon, authenticated;

-- No anon policy exists on memberships; drop the dangling table grant too (staff keep their own-row SELECT).
REVOKE SELECT ON TABLE public.admin_memberships FROM anon;

-- ── 2. product_media: public columns only ────────────────────────────────────────────────────────────────────────
REVOKE SELECT ON TABLE public.product_media FROM anon, authenticated;
GRANT SELECT (id, product_id, variant_id, url, alt, position, is_primary, width, height, content_type, created_at)
  ON TABLE public.product_media TO anon, authenticated;

-- ── 3. catalog_products_public works for public roles ────────────────────────────────────────────────────────────
GRANT SELECT (deleted_at) ON TABLE public.products TO anon, authenticated;

-- ── 4. boolean-only stock signal for the storefront ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.storefront_variant_availability(p_product_ids uuid[])
RETURNS TABLE (product_id uuid, variant_id uuid, available boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT v.product_id,
         v.id,
         (v.inventory_mode <> 'tracked'
          OR COALESCE(v.allow_oversell, false)
          OR COALESCE(v.quantity_on_hand, 0) > 0) AS available
  FROM public.product_variants v
  JOIN public.products p ON p.id = v.product_id
  WHERE p.id = ANY (p_product_ids[1:200])
    AND p.status = 'active'
    AND p.deleted_at IS NULL
    AND v.purchasable = true
    AND v.price_paisa > 0;
$$;

REVOKE ALL ON FUNCTION public.storefront_variant_availability(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storefront_variant_availability(uuid[]) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.storefront_variant_availability(uuid[]) IS
  'Public stock signal: (product_id, variant_id, true/false) per purchasable variant of active products (max 200 products per call). Never exposes quantities. Mirrors create_cod_order stock rule.';
