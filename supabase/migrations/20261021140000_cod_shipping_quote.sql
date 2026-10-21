-- COD shipping: quote + enforce zone serves customer city/province
-- Checkout remains gated by store_settings.cod_checkout.enabled

ALTER TABLE public.shipping_zones
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'PK';

-- Normalize helper
CREATE OR REPLACE FUNCTION public.norm_place(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(both FROM coalesce(t, '')));
$$;

CREATE OR REPLACE FUNCTION public.zone_serves_address(
  z public.shipping_zones,
  p_city text,
  p_province text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  city text := public.norm_place(p_city);
  province text := public.norm_place(p_province);
  z_cities text[];
  z_provinces text[];
BEGIN
  IF NOT z.is_active THEN
    RETURN false;
  END IF;

  SELECT array_agg(public.norm_place(x)) INTO z_provinces FROM unnest(z.provinces) AS x;
  SELECT array_agg(public.norm_place(x)) INTO z_cities FROM unnest(z.cities) AS x;

  -- Empty coverage arrays mean "not configured" — never match
  IF z_provinces IS NULL OR cardinality(z_provinces) = 0 THEN
    RETURN false;
  END IF;

  IF NOT (province = ANY (z_provinces)) THEN
    RETURN false;
  END IF;

  -- If cities listed, must match; if cities empty, province-wide for that zone
  IF z_cities IS NOT NULL AND cardinality(z_cities) > 0 THEN
    RETURN city = ANY (z_cities);
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.quote_cod_shipping(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city text := trim(payload#>>'{address,city}');
  v_province text := trim(payload#>>'{address,province}');
  v_zone public.shipping_zones%ROWTYPE;
  v_matches jsonb := '[]'::jsonb;
  r record;
BEGIN
  IF v_city IS NULL OR length(v_city) < 2 OR v_province IS NULL OR length(v_province) < 2 THEN
    RAISE EXCEPTION 'address_incomplete';
  END IF;

  FOR r IN
    SELECT * FROM public.shipping_zones z
    WHERE z.is_active = true
    ORDER BY z.flat_fee_paisa ASC, z.name ASC
  LOOP
    IF public.zone_serves_address(r, v_city, v_province) THEN
      v_matches := v_matches || jsonb_build_array(jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'flat_fee_paisa', r.flat_fee_paisa,
        'cod_fee_paisa', r.cod_fee_paisa,
        'notes', r.notes
      ));
    END IF;
  END LOOP;

  IF jsonb_array_length(v_matches) = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'unserviceable',
      'message', 'We do not currently deliver COD to this city/province.',
      'options', '[]'::jsonb
    );
  END IF;

  -- Optional preferred zone must still match
  IF payload ? 'shipping_zone_id' AND nullif(payload->>'shipping_zone_id','') IS NOT NULL THEN
    SELECT * INTO v_zone FROM public.shipping_zones
    WHERE id = (payload->>'shipping_zone_id')::uuid AND is_active = true;
    IF NOT FOUND OR NOT public.zone_serves_address(v_zone, v_city, v_province) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'zone_mismatch',
        'message', 'Selected delivery option is not available for this address.',
        'options', v_matches
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'options', v_matches,
    'currency', 'PKR'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.quote_cod_shipping(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quote_cod_shipping(jsonb) TO anon, authenticated, service_role;

-- Patch create_cod_order: validate zone serves address (replace function body key section via full replace)
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
  v_city text;
  v_province text;
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

REVOKE ALL ON FUNCTION public.create_cod_order(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_cod_order(jsonb) FROM anon, authenticated;
