-- Security hardening: column-level grants for public catalog.
-- Revokes broad table SELECT on products and product_variants from anon and authenticated,
-- and grants SELECT only on public storefront columns.
-- Internal metadata (flags, media_approval, import_source, deleted_at, deleted_by, updated_by)
-- and inventory (quantity_on_hand, inventory_mode, cost_paisa, low_stock_threshold, allow_oversell)
-- remain accessible ONLY to service_role and staff RPCs.

REVOKE ALL ON TABLE public.products FROM anon, authenticated;
REVOKE ALL ON TABLE public.product_variants FROM anon, authenticated;

-- Allow authenticated staff / writes as per RLS policies
GRANT INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.product_variants TO authenticated;

-- Public storefront columns on products
GRANT SELECT (
  id,
  handle,
  title,
  description_safe,
  summary,
  merchant_vendor,
  manufacturer,
  product_type,
  category,
  status,
  featured,
  tags,
  specs,
  option_names,
  template_key,
  seo_title,
  seo_description,
  created_at,
  updated_at
) ON TABLE public.products TO anon, authenticated;

-- Public storefront columns on product_variants
GRANT SELECT (
  id,
  product_id,
  sku,
  title,
  barcode,
  option_values,
  price_paisa,
  compare_at_paisa,
  compare_policy,
  purchasable,
  max_per_order,
  weight_grams,
  position,
  media_id,
  created_at,
  updated_at
) ON TABLE public.product_variants TO anon, authenticated;
