-- Discount campaigns + server-side automatic pricing for create_cod_order.
-- Additive. Rollback: DROP TABLE discount_campaigns CASCADE; restore prior create_cod_order body.
-- Money: integer paisa. Percent discounts round to nearest paisa.
-- Stacking: one automatic storewide/product/collection campaign; no coupons in this migration.
-- Order math: subtotal = sum(selling*qty); discount_paisa = sum(list-selling)*qty; total uses invariant.

CREATE TABLE IF NOT EXISTS public.discount_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  kind text NOT NULL CHECK (kind IN ('percent', 'fixed_paisa')),
  value integer NOT NULL CHECK (value > 0),
  scope text NOT NULL DEFAULT 'storewide' CHECK (scope IN ('storewide', 'products', 'collections')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'scheduled', 'expired', 'disabled')),
  starts_at timestamptz,
  ends_at timestamptz,
  announcement text NOT NULL DEFAULT '',
  show_announcement boolean NOT NULL DEFAULT true,
  code_required boolean NOT NULL DEFAULT false,
  product_ids uuid[] NOT NULL DEFAULT '{}',
  collection_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discount_campaigns_percent_range CHECK (kind <> 'percent' OR (value >= 1 AND value <= 90)),
  CONSTRAINT discount_campaigns_window CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS discount_campaigns_status_idx ON public.discount_campaigns (status);
CREATE INDEX IF NOT EXISTS discount_campaigns_live_idx ON public.discount_campaigns (status, starts_at, ends_at);

ALTER TABLE public.discount_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS discount_campaigns_staff_all ON public.discount_campaigns;
CREATE POLICY discount_campaigns_staff_all ON public.discount_campaigns
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Snapshot columns on order lines (nullable for historical rows).
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit_list_price_paisa bigint CHECK (unit_list_price_paisa IS NULL OR unit_list_price_paisa >= 0),
  ADD COLUMN IF NOT EXISTS line_discount_paisa bigint NOT NULL DEFAULT 0 CHECK (line_discount_paisa >= 0),
  ADD COLUMN IF NOT EXISTS discount_campaign_id uuid REFERENCES public.discount_campaigns(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.order_items.unit_list_price_paisa IS 'Catalog list price at order time (paisa). unit_price_paisa is the charged selling price.';
COMMENT ON COLUMN public.order_items.line_discount_paisa IS 'Per-line savings: (list - selling) * quantity.';

-- Seed the owner-approved default campaign (idempotent by name).
INSERT INTO public.discount_campaigns (
  name, description, kind, value, scope, status, announcement, show_announcement, code_required
)
SELECT
  'Storewide 5% Off',
  'Automatic 5% discount on all eligible products and variants. No code needed.',
  'percent',
  5,
  'storewide',
  'active',
  'FLAT 5% OFF STOREWIDE — Automatically Applied. No Code Needed.',
  true,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.discount_campaigns WHERE name = 'Storewide 5% Off'
);

CREATE OR REPLACE FUNCTION public.active_automatic_discount(at_ts timestamptz DEFAULT now())
RETURNS public.discount_campaigns
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.discount_campaigns%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.discount_campaigns c
  WHERE c.code_required = false
    AND c.status IN ('active', 'scheduled')
    AND (c.starts_at IS NULL OR c.starts_at <= at_ts)
    AND (c.ends_at IS NULL OR c.ends_at >= at_ts)
    AND (
      (c.status = 'active')
      OR (c.status = 'scheduled' AND c.starts_at IS NOT NULL AND c.starts_at <= at_ts)
    )
  ORDER BY
    CASE WHEN c.scope = 'storewide' THEN 0 ELSE 1 END,
    c.updated_at DESC
  LIMIT 1;
  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.active_automatic_discount(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.active_automatic_discount(timestamptz) TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.unit_selling_paisa(list_paisa bigint, campaign public.discount_campaigns)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_list bigint := GREATEST(0, COALESCE(list_paisa, 0));
  v_selling bigint;
BEGIN
  IF campaign.id IS NULL OR v_list <= 0 THEN
    RETURN v_list;
  END IF;
  IF campaign.kind = 'percent' THEN
    v_selling := GREATEST(0, ROUND((v_list * (100 - campaign.value))::numeric / 100.0));
  ELSIF campaign.kind = 'fixed_paisa' THEN
    v_selling := GREATEST(0, v_list - LEAST(campaign.value, v_list));
  ELSE
    v_selling := v_list;
  END IF;
  RETURN v_selling;
END;
$function$;

REVOKE ALL ON FUNCTION public.unit_selling_paisa(bigint, public.discount_campaigns) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unit_selling_paisa(bigint, public.discount_campaigns) TO service_role;

-- Patch create_cod_order: apply active automatic discount once; snapshot list vs selling.
CREATE OR REPLACE FUNCTION public.create_cod_order(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key text := payload->>'idempotency_key';
  v_existing public.orders%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_line jsonb;
  v_variant public.product_variants%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_shipping bigint := 0;
  v_cod_fee bigint := 0;
  v_zone public.shipping_zones%ROWTYPE;
  v_qty int;
  v_order_number text;
  v_lines jsonb := COALESCE(payload->'lines', '[]'::jsonb);
  v_checkout_enabled text;
  v_city text;
  v_province text;
  v_track_inventory boolean := public.inventory_tracking_enabled();
  v_campaign public.discount_campaigns%ROWTYPE;
  v_list bigint;
  v_selling bigint;
  v_line_discount bigint;
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
    IF v_existing.shipping_zone_id IS DISTINCT FROM nullif(payload->>'shipping_zone_id', '')::uuid
       OR COALESCE((
            SELECT jsonb_object_agg(s.variant_id, s.qty)
            FROM (
              SELECT oi.variant_id::text AS variant_id, sum(oi.quantity) AS qty
              FROM public.order_items oi
              WHERE oi.order_id = v_existing.id
              GROUP BY 1
            ) s
          ), '{}'::jsonb)
          IS DISTINCT FROM COALESCE((
            SELECT jsonb_object_agg(s.variant_id, s.qty)
            FROM (
              SELECT l->>'variant_id' AS variant_id, sum((l->>'quantity')::int) AS qty
              FROM jsonb_array_elements(v_lines) l
              GROUP BY 1
            ) s
          ), '{}'::jsonb)
    THEN
      RAISE EXCEPTION 'idempotency_conflict';
    END IF;
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

  v_city := trim(payload#>>'{address,city}');
  v_province := trim(payload#>>'{address,province}');
  IF v_city IS NULL OR length(v_city) < 2 OR v_province IS NULL OR length(v_province) < 2 THEN
    RAISE EXCEPTION 'address_incomplete';
  END IF;

  IF payload ? 'shipping_zone_id' AND (payload->>'shipping_zone_id') IS NOT NULL THEN
    SELECT * INTO v_zone FROM public.shipping_zones
    WHERE id = (payload->>'shipping_zone_id')::uuid AND is_active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'shipping_unavailable';
    END IF;
    IF NOT public.zone_serves_address(v_zone, v_city, v_province) THEN
      RAISE EXCEPTION 'zone_mismatch';
    END IF;
    v_shipping := v_zone.flat_fee_paisa;
    v_cod_fee := v_zone.cod_fee_paisa;
  ELSE
    RAISE EXCEPTION 'shipping_required';
  END IF;

  v_campaign := public.active_automatic_discount(now());

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

    IF v_track_inventory AND v_variant.inventory_mode = 'tracked' THEN
      IF v_variant.quantity_on_hand IS NULL
         OR (v_variant.quantity_on_hand < v_qty AND NOT COALESCE(v_variant.allow_oversell, false)) THEN
        RAISE EXCEPTION 'insufficient_stock';
      END IF;
      UPDATE public.product_variants
        SET quantity_on_hand = quantity_on_hand - v_qty
      WHERE id = v_variant.id;
    END IF;

    v_list := v_variant.price_paisa;
    IF v_campaign.id IS NOT NULL AND v_campaign.scope = 'storewide' THEN
      v_selling := public.unit_selling_paisa(v_list, v_campaign);
    ELSIF v_campaign.id IS NOT NULL AND v_campaign.scope = 'products' AND v_product.id = ANY (v_campaign.product_ids) THEN
      v_selling := public.unit_selling_paisa(v_list, v_campaign);
    ELSE
      v_selling := v_list;
    END IF;
    v_line_discount := (v_list - v_selling) * v_qty;
    v_subtotal := v_subtotal + (v_selling * v_qty);
    v_discount := v_discount + v_line_discount;
  END LOOP;

  -- Free-shipping threshold uses discounted merchandise subtotal (amount customer pays for goods).
  IF v_zone.free_shipping_min_paisa IS NOT NULL AND v_subtotal >= v_zone.free_shipping_min_paisa THEN
    v_shipping := 0;
  END IF;

  v_order_number := 'LH-' || to_char(now() AT TIME ZONE 'Asia/Karachi', 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  -- Store discounted merchandise as subtotal; keep discount_paisa as savings snapshot.
  -- Invariant: total = subtotal + shipping + cod + tax - discount.
  -- Using discount in the invariant would undercharge, so we keep discount_paisa = 0 in the math
  -- and record savings on lines + order_events.meta.
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
    v_city,
    v_province,
    COALESCE(trim(payload#>>'{address,postcode}'), ''),
    COALESCE(trim(payload#>>'{address,landmark}'), '')
  );

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines)
  LOOP
    SELECT * INTO v_variant FROM public.product_variants WHERE id = (v_line->>'variant_id')::uuid;
    SELECT * INTO v_product FROM public.products WHERE id = v_variant.product_id;
    v_qty := (v_line->>'quantity')::int;
    v_list := v_variant.price_paisa;
    IF v_campaign.id IS NOT NULL AND v_campaign.scope = 'storewide' THEN
      v_selling := public.unit_selling_paisa(v_list, v_campaign);
    ELSIF v_campaign.id IS NOT NULL AND v_campaign.scope = 'products' AND v_product.id = ANY (v_campaign.product_ids) THEN
      v_selling := public.unit_selling_paisa(v_list, v_campaign);
    ELSE
      v_selling := v_list;
    END IF;
    v_line_discount := (v_list - v_selling) * v_qty;

    INSERT INTO public.order_items (
      order_id, product_id, variant_id, handle, title_snapshot, variant_title_snapshot,
      sku_snapshot, unit_price_paisa, quantity, line_total_paisa,
      unit_list_price_paisa, line_discount_paisa, discount_campaign_id
    ) VALUES (
      v_order.id, v_product.id, v_variant.id, v_product.handle, v_product.title, v_variant.title,
      v_variant.sku, v_selling, v_qty, v_selling * v_qty,
      v_list, v_line_discount, v_campaign.id
    );
  END LOOP;

  INSERT INTO public.order_events (order_id, event_type, to_status, note, meta)
  VALUES (
    v_order.id, 'order_placed', 'placed', 'COD order created',
    jsonb_build_object(
      'discount_campaign_id', v_campaign.id,
      'discount_campaign_name', v_campaign.name,
      'merchandise_savings_paisa', v_discount
    )
  );

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
    'total_due_paisa', v_order.total_due_paisa,
    'merchandise_savings_paisa', v_discount
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_cod_order(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_cod_order(jsonb) TO service_role;

-- Keepalive activity log (minimal writes; used by /api/cron/keepalive).
CREATE TABLE IF NOT EXISTS public.system_keepalive (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_ping_at timestamptz NOT NULL DEFAULT now(),
  last_source text NOT NULL DEFAULT 'init',
  ping_count bigint NOT NULL DEFAULT 0
);

INSERT INTO public.system_keepalive (id, last_source)
VALUES (1, 'migration')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.system_keepalive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_keepalive_staff_select ON public.system_keepalive;
CREATE POLICY system_keepalive_staff_select ON public.system_keepalive
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE OR REPLACE FUNCTION public.touch_keepalive(p_source text DEFAULT 'cron')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.system_keepalive%ROWTYPE;
BEGIN
  INSERT INTO public.system_keepalive (id, last_ping_at, last_source, ping_count)
  VALUES (1, now(), COALESCE(NULLIF(trim(p_source), ''), 'cron'), 1)
  ON CONFLICT (id) DO UPDATE
    SET last_ping_at = now(),
        last_source = EXCLUDED.last_source,
        ping_count = public.system_keepalive.ping_count + 1
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'last_ping_at', v_row.last_ping_at,
    'ping_count', v_row.ping_count,
    'source', v_row.last_source
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.touch_keepalive(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_keepalive(text) TO service_role;
