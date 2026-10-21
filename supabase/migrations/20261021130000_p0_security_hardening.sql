-- P0 security hardening: column exposure + order token lookup RPC
-- Non-destructive. Review before push.

-- ── Public must not read inventory internals via Data API ──────────────────
-- RLS allows row SELECT; PostgREST still returns all granted columns.
REVOKE SELECT ON TABLE public.product_variants FROM anon;
GRANT SELECT (
  id,
  product_id,
  sku,
  title,
  option_values,
  price_paisa,
  compare_at_paisa,
  purchasable,
  max_per_order,
  created_at,
  updated_at
) ON TABLE public.product_variants TO anon;

-- Authenticated non-staff customers (if any) also must not see warehouse qty via API.
-- Staff pages use service role AFTER requireStaff(), so they retain full access.
REVOKE SELECT ON TABLE public.product_variants FROM authenticated;
GRANT SELECT (
  id,
  product_id,
  sku,
  title,
  option_values,
  price_paisa,
  compare_at_paisa,
  purchasable,
  max_per_order,
  created_at,
  updated_at
) ON TABLE public.product_variants TO authenticated;

-- Hide internal product ops columns from public roles
REVOKE SELECT ON TABLE public.products FROM anon;
GRANT SELECT (
  id,
  handle,
  title,
  description_safe,
  merchant_vendor,
  manufacturer,
  product_type,
  category,
  status,
  featured,
  tags,
  specs,
  seo_title,
  seo_description,
  created_at,
  updated_at
) ON TABLE public.products TO anon;

REVOKE SELECT ON TABLE public.products FROM authenticated;
GRANT SELECT (
  id,
  handle,
  title,
  description_safe,
  merchant_vendor,
  manufacturer,
  product_type,
  category,
  status,
  featured,
  tags,
  specs,
  seo_title,
  seo_description,
  created_at,
  updated_at
) ON TABLE public.products TO authenticated;

-- Staff still need full product/variant columns via authenticated when using user client
-- after RLS is_staff(). Re-grant full SELECT to authenticated for staff policies would
-- re-expose columns to any logged-in user. Keep full table access only for service_role
-- (bypasses grants for table owner / supabase_admin). Ensure service_role retains ALL.
GRANT ALL ON TABLE public.products TO service_role;
GRANT ALL ON TABLE public.product_variants TO service_role;

-- ── Safe order confirmation by opaque token (no broad service queries from page) ──
CREATE OR REPLACE FUNCTION public.get_order_confirmation_by_token(p_token uuid)
RETURNS TABLE (
  order_number text,
  total_due_paisa bigint,
  payment_status public.payment_status,
  status public.order_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT o.order_number, o.total_due_paisa, o.payment_status, o.status
  FROM public.orders o
  WHERE o.access_token = p_token
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_confirmation_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_confirmation_by_token(uuid) TO anon, authenticated, service_role;

-- Ensure admin_memberships cannot be self-inserted by authenticated users
DROP POLICY IF EXISTS admin_memberships_no_self_insert ON public.admin_memberships;
CREATE POLICY admin_memberships_no_self_insert ON public.admin_memberships
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS admin_memberships_no_self_update ON public.admin_memberships;
CREATE POLICY admin_memberships_no_self_update ON public.admin_memberships
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS admin_memberships_no_self_delete ON public.admin_memberships;
CREATE POLICY admin_memberships_no_self_delete ON public.admin_memberships
  FOR DELETE TO authenticated
  USING (false);

-- Keep existing self-select + staff-select policies (from init migration)
