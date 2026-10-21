-- Laptops HUB — initial schema (COD-only commerce)
-- Project: xvmmjkrkgznnakcobmww
-- Safe to apply on empty greenfield DB. Review before push.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enums ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.product_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.media_approval AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_mode AS ENUM ('untracked', 'tracked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('cod');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM (
    'unpaid_cod',
    'collection_pending',
    'collected',
    'partially_collected',
    'collection_failed',
    'refunded_or_adjusted'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM (
    'placed',
    'pending_confirmation',
    'confirmed',
    'packing',
    'shipped',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'delivery_failed',
    'returned',
    'return_requested'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.staff_role AS ENUM ('owner', 'admin', 'manager', 'editor', 'fulfillment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.inquiry_status AS ENUM ('new', 'open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Helpers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── Catalog ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle text NOT NULL UNIQUE,
  title text NOT NULL,
  description_safe text NOT NULL DEFAULT '',
  merchant_vendor text NOT NULL DEFAULT 'Laptops HUB',
  manufacturer text,
  product_type text,
  category text,
  status public.product_status NOT NULL DEFAULT 'draft',
  featured boolean NOT NULL DEFAULT false,
  media_approval public.media_approval NOT NULL DEFAULT 'pending',
  seo_title text,
  seo_description text,
  tags text[] NOT NULL DEFAULT '{}',
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  flags text[] NOT NULL DEFAULT '{}',
  import_source text NOT NULL DEFAULT 'csv',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_handle_format CHECK (handle ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku text,
  title text NOT NULL DEFAULT 'Default',
  option_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_paisa bigint NOT NULL CHECK (price_paisa >= 0),
  compare_at_paisa bigint CHECK (compare_at_paisa IS NULL OR compare_at_paisa >= 0),
  purchasable boolean NOT NULL DEFAULT true,
  inventory_mode public.inventory_mode NOT NULL DEFAULT 'untracked',
  quantity_on_hand integer,
  max_per_order integer NOT NULL DEFAULT 5 CHECK (max_per_order > 0 AND max_per_order <= 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, sku)
);

CREATE TABLE IF NOT EXISTS public.product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 1 CHECK (position >= 1),
  approval public.media_approval NOT NULL DEFAULT 'pending',
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, position)
);

CREATE TABLE IF NOT EXISTS public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  featured boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.collection_products (
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, product_id)
);

-- ── Content & settings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  body_html text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'draft', 'published')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.faq_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_label text NOT NULL,
  question text NOT NULL,
  answer_html text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.shipping_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provinces text[] NOT NULL DEFAULT '{}',
  cities text[] NOT NULL DEFAULT '{}',
  flat_fee_paisa bigint NOT NULL DEFAULT 0 CHECK (flat_fee_paisa >= 0),
  cod_fee_paisa bigint NOT NULL DEFAULT 0 CHECK (cod_fee_paisa >= 0),
  is_active boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Staff ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.staff_role NOT NULL DEFAULT 'admin',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_memberships m
    WHERE m.user_id = auth.uid() AND m.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_staff_role(roles public.staff_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_memberships m
    WHERE m.user_id = auth.uid()
      AND m.is_active = true
      AND m.role = ANY (roles)
  );
$$;

-- ── Commerce ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  access_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status public.order_status NOT NULL DEFAULT 'placed',
  payment_method public.payment_method NOT NULL DEFAULT 'cod',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid_cod',
  currency text NOT NULL DEFAULT 'PKR' CHECK (currency = 'PKR'),
  customer_name text NOT NULL,
  customer_phone_e164 text NOT NULL,
  customer_phone_normalized text NOT NULL,
  customer_email text,
  subtotal_paisa bigint NOT NULL CHECK (subtotal_paisa >= 0),
  shipping_paisa bigint NOT NULL DEFAULT 0 CHECK (shipping_paisa >= 0),
  cod_fee_paisa bigint NOT NULL DEFAULT 0 CHECK (cod_fee_paisa >= 0),
  discount_paisa bigint NOT NULL DEFAULT 0 CHECK (discount_paisa >= 0),
  tax_paisa bigint NOT NULL DEFAULT 0 CHECK (tax_paisa >= 0),
  total_due_paisa bigint NOT NULL CHECK (total_due_paisa >= 0),
  amount_collected_paisa bigint NOT NULL DEFAULT 0 CHECK (amount_collected_paisa >= 0),
  shipping_zone_id uuid REFERENCES public.shipping_zones(id),
  customer_note text NOT NULL DEFAULT '',
  confirmation_version text NOT NULL DEFAULT 'cod-v1-pending-legal',
  confirmation_accepted_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_total_invariant CHECK (
    total_due_paisa = subtotal_paisa + shipping_paisa + cod_fee_paisa + tax_paisa - discount_paisa
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_uidx ON public.orders (idempotency_key);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_phone_idx ON public.orders (customer_phone_normalized);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders (status);

CREATE TABLE IF NOT EXISTS public.order_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  line1 text NOT NULL,
  line2 text NOT NULL DEFAULT '',
  city text NOT NULL,
  province text NOT NULL,
  postcode text NOT NULL DEFAULT '',
  landmark text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT 'PK'
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  handle text NOT NULL,
  title_snapshot text NOT NULL,
  variant_title_snapshot text NOT NULL DEFAULT 'Default',
  sku_snapshot text,
  unit_price_paisa bigint NOT NULL CHECK (unit_price_paisa >= 0),
  quantity integer NOT NULL CHECK (quantity > 0 AND quantity <= 20),
  line_total_paisa bigint NOT NULL CHECK (line_total_paisa >= 0),
  CONSTRAINT order_items_line_math CHECK (line_total_paisa = unit_price_paisa * quantity)
);

CREATE TABLE IF NOT EXISTS public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  actor_user_id uuid,
  note text NOT NULL DEFAULT '',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cod_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount_paisa bigint NOT NULL CHECK (amount_paisa > 0),
  collected_at timestamptz NOT NULL DEFAULT now(),
  collector_ref text NOT NULL DEFAULT '',
  recorded_by uuid,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  carrier text NOT NULL DEFAULT '',
  tracking_number text NOT NULL DEFAULT '',
  dispatched_at timestamptz,
  delivered_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  subject text NOT NULL DEFAULT '',
  message text NOT NULL,
  status public.inquiry_status NOT NULL DEFAULT 'new',
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  channel text NOT NULL,
  template text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  dry_run boolean NOT NULL DEFAULT false,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

-- Updated-at triggers
DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS variants_updated_at ON public.product_variants;
CREATE TRIGGER variants_updated_at BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Public catalog views (safe projections) ────────────────────────────────
CREATE OR REPLACE VIEW public.catalog_products_public
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.handle,
  p.title,
  p.description_safe,
  p.merchant_vendor,
  p.manufacturer,
  p.product_type,
  p.category,
  p.featured,
  p.tags,
  p.specs,
  p.updated_at,
  v.id AS variant_id,
  v.sku,
  v.price_paisa,
  v.compare_at_paisa,
  v.max_per_order
FROM public.products p
JOIN public.product_variants v ON v.product_id = p.id
WHERE p.status = 'active'
  AND v.purchasable = true
  AND v.price_paisa > 0;

-- ── COD order creation (atomic, service-role / security definer) ───────────
CREATE OR REPLACE FUNCTION public.create_cod_order(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := payload->>'idempotency_key';
  v_existing public.orders%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_line jsonb;
  v_variant public.product_variants%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_subtotal bigint := 0;
  v_shipping bigint := 0;
  v_cod_fee bigint := 0;
  v_zone public.shipping_zones%ROWTYPE;
  v_qty int;
  v_order_number text;
  v_lines jsonb := COALESCE(payload->'lines', '[]'::jsonb);
  v_checkout_enabled text;
BEGIN
  IF v_key IS NULL OR length(v_key) < 8 THEN
    RAISE EXCEPTION 'invalid_idempotency_key';
  END IF;

  SELECT value->>'enabled' INTO v_checkout_enabled
  FROM public.store_settings WHERE key = 'cod_checkout';

  IF COALESCE(v_checkout_enabled, 'false') <> 'true' THEN
    RAISE EXCEPTION 'checkout_disabled';
  END IF;

  SELECT * INTO v_existing FROM public.orders WHERE idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'order_id', v_existing.id,
      'order_number', v_existing.order_number,
      'access_token', v_existing.access_token,
      'total_due_paisa', v_existing.total_due_paisa
    );
  END IF;

  IF jsonb_array_length(v_lines) < 1 OR jsonb_array_length(v_lines) > 20 THEN
    RAISE EXCEPTION 'invalid_lines';
  END IF;

  -- Shipping zone (must be active)
  IF payload ? 'shipping_zone_id' AND (payload->>'shipping_zone_id') IS NOT NULL THEN
    SELECT * INTO v_zone FROM public.shipping_zones
    WHERE id = (payload->>'shipping_zone_id')::uuid AND is_active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'shipping_unavailable';
    END IF;
    v_shipping := v_zone.flat_fee_paisa;
    v_cod_fee := v_zone.cod_fee_paisa;
  ELSE
    RAISE EXCEPTION 'shipping_required';
  END IF;

  -- Pre-validate lines and compute subtotal
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines)
  LOOP
    v_qty := (v_line->>'quantity')::int;
    IF v_qty IS NULL OR v_qty < 1 THEN
      RAISE EXCEPTION 'invalid_quantity';
    END IF;

    SELECT * INTO v_variant FROM public.product_variants
    WHERE id = (v_line->>'variant_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'variant_not_found'; END IF;

    SELECT * INTO v_product FROM public.products WHERE id = v_variant.product_id;
    IF v_product.status <> 'active' OR NOT v_variant.purchasable OR v_variant.price_paisa <= 0 THEN
      RAISE EXCEPTION 'product_not_purchasable';
    END IF;
    IF v_qty > v_variant.max_per_order THEN
      RAISE EXCEPTION 'quantity_exceeds_limit';
    END IF;

    IF v_variant.inventory_mode = 'tracked' THEN
      IF v_variant.quantity_on_hand IS NULL OR v_variant.quantity_on_hand < v_qty THEN
        RAISE EXCEPTION 'insufficient_stock';
      END IF;
      UPDATE public.product_variants
        SET quantity_on_hand = quantity_on_hand - v_qty
      WHERE id = v_variant.id;
    END IF;

    v_subtotal := v_subtotal + (v_variant.price_paisa * v_qty);
  END LOOP;

  v_order_number := 'LH-' || to_char(now() AT TIME ZONE 'Asia/Karachi', 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.orders (
    order_number, status, payment_method, payment_status,
    customer_name, customer_phone_e164, customer_phone_normalized, customer_email,
    subtotal_paisa, shipping_paisa, cod_fee_paisa, discount_paisa, tax_paisa, total_due_paisa,
    shipping_zone_id, customer_note, confirmation_version, confirmation_accepted_at,
    idempotency_key, ip_hash, user_agent
  ) VALUES (
    v_order_number, 'placed', 'cod', 'unpaid_cod',
    trim(payload->>'customer_name'),
    trim(payload->>'customer_phone_e164'),
    trim(payload->>'customer_phone_normalized'),
    NULLIF(trim(payload->>'customer_email'), ''),
    v_subtotal, v_shipping, v_cod_fee, 0, 0,
    v_subtotal + v_shipping + v_cod_fee,
    v_zone.id,
    COALESCE(trim(payload->>'customer_note'), ''),
    COALESCE(payload->>'confirmation_version', 'cod-v1-pending-legal'),
    now(),
    v_key,
    payload->>'ip_hash',
    payload->>'user_agent'
  ) RETURNING * INTO v_order;

  INSERT INTO public.order_addresses (
    order_id, line1, line2, city, province, postcode, landmark
  ) VALUES (
    v_order.id,
    trim(payload#>>'{address,line1}'),
    COALESCE(trim(payload#>>'{address,line2}'), ''),
    trim(payload#>>'{address,city}'),
    trim(payload#>>'{address,province}'),
    COALESCE(trim(payload#>>'{address,postcode}'), ''),
    COALESCE(trim(payload#>>'{address,landmark}'), '')
  );

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines)
  LOOP
    SELECT * INTO v_variant FROM public.product_variants WHERE id = (v_line->>'variant_id')::uuid;
    SELECT * INTO v_product FROM public.products WHERE id = v_variant.product_id;
    v_qty := (v_line->>'quantity')::int;

    INSERT INTO public.order_items (
      order_id, product_id, variant_id, handle, title_snapshot, variant_title_snapshot,
      sku_snapshot, unit_price_paisa, quantity, line_total_paisa
    ) VALUES (
      v_order.id, v_product.id, v_variant.id, v_product.handle, v_product.title, v_variant.title,
      v_variant.sku, v_variant.price_paisa, v_qty, v_variant.price_paisa * v_qty
    );
  END LOOP;

  INSERT INTO public.order_events (order_id, event_type, to_status, note)
  VALUES (v_order.id, 'order_placed', 'placed', 'COD order created');

  INSERT INTO public.notification_outbox (order_id, channel, template, payload)
  VALUES (
    v_order.id, 'email', 'order_placed_cod',
    jsonb_build_object('order_number', v_order.order_number, 'total_due_paisa', v_order.total_due_paisa)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'access_token', v_order.access_token,
    'total_due_paisa', v_order.total_due_paisa
  );
END;
$$;

-- Only service role / trusted server should execute create_cod_order
REVOKE ALL ON FUNCTION public.create_cod_order(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_cod_order(jsonb) FROM anon, authenticated;
-- Grant executed via service role (bypasses RLS); app never exposes this to browser.

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cod_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- Public read: active products
CREATE POLICY products_public_select ON public.products
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

CREATE POLICY products_staff_all ON public.products
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY variants_public_select ON public.product_variants
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.status = 'active'
    )
    AND purchasable = true
    AND price_paisa > 0
  );

CREATE POLICY variants_staff_all ON public.product_variants
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY media_public_select ON public.product_media
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.status = 'active'
    )
  );

CREATE POLICY media_staff_all ON public.product_media
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY collections_public_select ON public.collections
  FOR SELECT TO anon, authenticated
  USING (published = true);

CREATE POLICY collections_staff_all ON public.collections
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY collection_products_public_select ON public.collection_products
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.published = true)
  );

CREATE POLICY collection_products_staff_all ON public.collection_products
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY pages_public_select ON public.content_pages
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY pages_staff_all ON public.content_pages
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY faq_public_select ON public.faq_entries
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY faq_staff_all ON public.faq_entries
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY articles_public_select ON public.articles
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY articles_staff_all ON public.articles
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Settings: public may read only non-secret keys
CREATE POLICY settings_public_select ON public.store_settings
  FOR SELECT TO anon, authenticated
  USING (key IN ('brand', 'announcement', 'cod_checkout', 'seo'));

CREATE POLICY settings_staff_all ON public.store_settings
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY shipping_public_select ON public.shipping_zones
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY shipping_staff_all ON public.shipping_zones
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Orders: NO anon insert/select. Staff only via policies; guests use access_token via server.
CREATE POLICY orders_staff_all ON public.orders
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY order_addresses_staff_all ON public.order_addresses
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY order_items_staff_all ON public.order_items
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY order_events_staff_all ON public.order_events
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY cod_collections_staff_all ON public.cod_collections
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY fulfillments_staff_all ON public.fulfillments
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY inquiries_staff_all ON public.contact_inquiries
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Contact: allow anon insert only (no select)
CREATE POLICY inquiries_anon_insert ON public.contact_inquiries
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY outbox_staff_all ON public.notification_outbox
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY audit_staff_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY import_staff_all ON public.import_jobs
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY admin_memberships_self_select ON public.admin_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

-- Seed store settings (checkout OFF)
INSERT INTO public.store_settings (key, value) VALUES
  ('cod_checkout', '{"enabled": false, "reason": "Owner shipping/policies pending"}'::jsonb),
  ('brand', '{"name":"Laptops HUB","locale":"en-PK","currency":"PKR","timezone":"Asia/Karachi"}'::jsonb),
  ('seo', '{"siteName":"Laptops HUB"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
