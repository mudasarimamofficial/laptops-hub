-- Order inventory integrity (2026-11-17)
--  1. create_cod_order honours product_variants.allow_oversell (it ignored it; a merchant-enabled "continue selling"
--     variant was still refused at zero). Without the flag, behaviour is unchanged: tracked stock never goes negative.
--     Body otherwise identical to the definition in force after 20261114100000 (taken from pg_get_functiondef).
--  2. Every order line on a TRACKED variant writes an inventory_ledger row in the same transaction (reason
--     order_placed) — the order path previously decremented stock with no ledger entry.
--  3. Cancelling an order that has NOT shipped (placed / pending_confirmation / confirmed / packing → cancelled)
--     returns tracked stock exactly once, with a ledger row (reason order_cancelled). Stock that left the shop
--     (delivery_failed → cancelled, returned) is NOT restocked automatically: staff inspect the unit and adjust
--     stock with a reason. Untracked variants are never touched.
-- Additive: no table/column changes, no data rewrites. Rollback: re-run the previous create_cod_order definition
-- and DROP the two triggers/functions below (ledger rows already written are history and stay).

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
      -- Continue selling below zero only when the merchant explicitly allowed it for this variant (owner/admin-set).
      IF v_variant.quantity_on_hand IS NULL
         OR (v_variant.quantity_on_hand < v_qty AND NOT COALESCE(v_variant.allow_oversell, false)) THEN
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
$function$;


REVOKE ALL ON FUNCTION public.create_cod_order(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_cod_order(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.order_items_inventory_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode text;
  v_qoh integer;
BEGIN
  IF NEW.variant_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT inventory_mode::text, quantity_on_hand INTO v_mode, v_qoh
  FROM public.product_variants WHERE id = NEW.variant_id;
  IF v_mode = 'tracked' THEN
    INSERT INTO public.inventory_ledger (variant_id, delta, quantity_after, reason, reference_type, reference_id)
    VALUES (NEW.variant_id, -NEW.quantity, v_qoh, 'order_placed', 'order', NEW.order_id::text);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.order_items_inventory_ledger() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS order_items_inventory_ledger ON public.order_items;
CREATE TRIGGER order_items_inventory_ledger
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_items_inventory_ledger();

CREATE OR REPLACE FUNCTION public.orders_cancel_restock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_after integer;
BEGIN
  IF NEW.status::text <> 'cancelled' OR OLD.status::text = 'cancelled'
     OR OLD.status::text NOT IN ('placed', 'pending_confirmation', 'confirmed', 'packing') THEN
    RETURN NEW;
  END IF;
  -- Exactly once per order, even if a future path re-enters this transition.
  IF EXISTS (
    SELECT 1 FROM public.inventory_ledger
    WHERE reference_type = 'order' AND reference_id = NEW.id::text AND reason = 'order_cancelled'
  ) THEN
    RETURN NEW;
  END IF;
  FOR v_item IN
    SELECT oi.variant_id, sum(oi.quantity)::int AS qty
    FROM public.order_items oi
    JOIN public.product_variants pv ON pv.id = oi.variant_id
    WHERE oi.order_id = NEW.id AND pv.inventory_mode = 'tracked'
    GROUP BY oi.variant_id
  LOOP
    UPDATE public.product_variants
      SET quantity_on_hand = COALESCE(quantity_on_hand, 0) + v_item.qty, updated_at = now()
    WHERE id = v_item.variant_id
    RETURNING quantity_on_hand INTO v_after;
    INSERT INTO public.inventory_ledger (variant_id, delta, quantity_after, reason, reference_type, reference_id)
    VALUES (v_item.variant_id, v_item.qty, v_after, 'order_cancelled', 'order', NEW.id::text);
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.orders_cancel_restock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_cancel_restock ON public.orders;
CREATE TRIGGER orders_cancel_restock
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_cancel_restock();

CREATE INDEX IF NOT EXISTS inventory_ledger_reference_idx
  ON public.inventory_ledger (reference_type, reference_id);
