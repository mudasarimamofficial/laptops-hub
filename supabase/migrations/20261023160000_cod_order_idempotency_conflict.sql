-- create_cod_order: a replayed idempotency key must describe the same checkout (docs/COD_IDEMPOTENCY_CONTRACT.md).
--
-- Before: any existing order with the key was returned as a successful duplicate, even when the new request had
-- a different cart or shipping zone (e.g. a submit whose response was lost, then the cart changed and was sent
-- again with the same per-page key). The customer would see a confirmation for an order that is not their cart.
-- Now: same lines (variant -> total quantity) and zone -> duplicate replay as before; otherwise
-- 'idempotency_conflict' and nothing is written. Customer/address fields are not compared (re-typed details on a
-- retry are the same checkout). Body otherwise copied unchanged from 20261021140000; grants are kept
-- (service_role only).

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
    -- A key identifies one checkout: the same lines (variant -> total quantity) and shipping zone replay it.
    -- Anything else must not be answered with the earlier order as if it were this cart.
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
