CREATE SCHEMA public;
COMMENT ON SCHEMA public IS 'standard public schema';
CREATE TYPE public.inquiry_status AS ENUM (
    'new',
    'open',
    'closed'
);
CREATE TYPE public.inventory_mode AS ENUM (
    'untracked',
    'tracked'
);
CREATE TYPE public.media_approval AS ENUM (
    'pending',
    'approved',
    'rejected'
);
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
CREATE TYPE public.payment_method AS ENUM (
    'cod'
);
CREATE TYPE public.payment_status AS ENUM (
    'unpaid_cod',
    'collection_pending',
    'collected',
    'partially_collected',
    'collection_failed',
    'refunded_or_adjusted'
);
CREATE TYPE public.product_status AS ENUM (
    'draft',
    'active',
    'archived'
);
CREATE TYPE public.staff_role AS ENUM (
    'owner',
    'admin',
    'manager',
    'editor',
    'fulfillment'
);
CREATE FUNCTION public.adjust_inventory(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id uuid := nullif(payload->>'variant_id', '')::uuid;
  v_mode text := payload->>'mode';
  v_amount integer := (payload->>'amount')::integer;
  v_reason text := payload->>'reason';
  v_actor uuid := nullif(payload->>'actor_user_id', '')::uuid;
  v_expected integer := (payload->>'expected_quantity')::integer;
  v_row public.product_variants%ROWTYPE;
  v_new integer;
  v_delta integer;
BEGIN
  IF v_id IS NULL OR v_actor IS NULL OR v_amount IS NULL THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;
  IF v_mode NOT IN ('delta', 'set') THEN
    RAISE EXCEPTION 'invalid_mode';
  END IF;
  IF v_reason NOT IN ('stock_received', 'count_correction', 'damaged_or_lost', 'customer_return', 'other') THEN
    RAISE EXCEPTION 'invalid_reason';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_memberships m
                 WHERE m.user_id = v_actor AND m.is_active AND m.role IN ('owner', 'admin', 'manager')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO v_row FROM public.product_variants WHERE id = v_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'variant_not_found';
  END IF;
  IF v_row.inventory_mode IS DISTINCT FROM 'tracked' OR v_row.quantity_on_hand IS NULL THEN
    RAISE EXCEPTION 'not_tracked';
  END IF;
  IF v_mode = 'set' THEN
    IF v_expected IS NULL THEN
      RAISE EXCEPTION 'expected_quantity_required';
    END IF;
    IF v_expected <> v_row.quantity_on_hand THEN
      RAISE EXCEPTION 'stale_quantity';
    END IF;
    v_new := v_amount;
  ELSE
    IF v_amount = 0 THEN
      RAISE EXCEPTION 'zero_adjustment';
    END IF;
    v_new := v_row.quantity_on_hand + v_amount;
  END IF;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'negative_stock';
  END IF;
  v_delta := v_new - v_row.quantity_on_hand;
  IF v_delta = 0 THEN
    RAISE EXCEPTION 'zero_adjustment';
  END IF;
  UPDATE public.product_variants SET quantity_on_hand = v_new WHERE id = v_id;
  INSERT INTO public.inventory_ledger (variant_id, delta, quantity_after, reason, reference_type, reference_id, actor_user_id)
  VALUES (v_id, v_delta, v_new, v_reason, 'manual_adjustment', NULL, v_actor);
  RETURN jsonb_build_object('ok', true, 'variant_id', v_id, 'quantity_before', v_row.quantity_on_hand,
                            'quantity_after', v_new, 'delta', v_delta);
END;
$$;
CREATE TABLE public.notification_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    channel text NOT NULL,
    template text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    claim_token uuid,
    claimed_at timestamp with time zone,
    first_attempt_at timestamp with time zone,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    business_status text DEFAULT 'pending'::text NOT NULL,
    business_message_id text,
    business_accepted_at timestamp with time zone,
    customer_status text DEFAULT 'pending'::text NOT NULL,
    customer_message_id text,
    customer_accepted_at timestamp with time zone,
    CONSTRAINT notification_outbox_business_status_chk CHECK ((business_status = ANY (ARRAY['pending'::text, 'accepted'::text, 'failed'::text]))),
    CONSTRAINT notification_outbox_customer_status_chk CHECK ((customer_status = ANY (ARRAY['pending'::text, 'accepted'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT notification_outbox_status_chk CHECK ((status = ANY (ARRAY['pending'::text, 'sending'::text, 'accepted'::text, 'failed'::text])))
);
CREATE FUNCTION public.claim_notifications(p_limit integer DEFAULT 10, p_lease_seconds integer DEFAULT 300, p_order_id uuid DEFAULT NULL::uuid, p_max_attempts integer DEFAULT 5, p_retry_window_hours integer DEFAULT 23, p_manual boolean DEFAULT false) RETURNS SETOF public.notification_outbox
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  -- Fail closed: only a request whose JWT role claim is service_role. A missing claim (NULL) is rejected too.
  if auth.role() is distinct from 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Give up automatically on rows that may not be retried any more (attempts used up, or the first attempt is older
  -- than the retry window so the provider no longer de-duplicates). They stay visible as 'failed' for staff.
  if not p_manual then
    update public.notification_outbox o
       set status = 'failed', claim_token = null,
           last_error = pg_catalog.left(coalesce(o.last_error || ' · ', '') || 'automatic retries stopped', 500)
     where (p_order_id is null or o.order_id = p_order_id)
       and (
         (o.status = 'sending' and o.claimed_at < pg_catalog.now() - pg_catalog.make_interval(secs => p_lease_seconds))
         or o.status in ('pending', 'failed')
       )
       and (o.attempts >= p_max_attempts
            or o.first_attempt_at < pg_catalog.now() - pg_catalog.make_interval(hours => p_retry_window_hours))
       and not (o.status = 'failed' and coalesce(o.last_error, '') like '%automatic retries stopped');
  end if;
  return query
  with due as (
    select o.id
      from public.notification_outbox o
     where (p_order_id is null or o.order_id = p_order_id)
       and (
         -- waiting rows
         (o.status in ('pending', 'failed')
           and (p_manual
                or (o.attempts < p_max_attempts
                    and o.next_attempt_at <= pg_catalog.now()
                    and (o.first_attempt_at is null
                         or o.first_attempt_at >= pg_catalog.now() - pg_catalog.make_interval(hours => p_retry_window_hours)))))
         -- abandoned claims: lease expired (claim age, not row age)
         or (o.status = 'sending'
             and o.claimed_at < pg_catalog.now() - pg_catalog.make_interval(secs => p_lease_seconds)
             and (p_manual
                  or (o.attempts < p_max_attempts
                      and o.first_attempt_at >= pg_catalog.now() - pg_catalog.make_interval(hours => p_retry_window_hours))))
       )
     order by o.created_at
     limit greatest(1, least(p_limit, 100))
     for update skip locked
  )
  update public.notification_outbox o
     set status = 'sending',
         claim_token = pg_catalog.gen_random_uuid(),
         claimed_at = pg_catalog.now(),
         attempts = o.attempts + 1,
         first_attempt_at = coalesce(o.first_attempt_at, pg_catalog.now())
    from due
   where o.id = due.id
  returning o.*;
end;
$$;
CREATE FUNCTION public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count integer;
  v_start timestamptz;
  v_now timestamptz := now();
BEGIN
  IF p_limit <= 0 OR p_window_seconds <= 0 THEN
    RETURN false;
  END IF;
  INSERT INTO public.rate_limit_buckets (bucket_key, count, window_starts_at, updated_at)
  VALUES (p_key, 1, v_now, v_now)
  ON CONFLICT (bucket_key) DO UPDATE
  SET
    count = CASE
      WHEN public.rate_limit_buckets.window_starts_at + make_interval(secs => p_window_seconds) <= v_now
        THEN 1
      ELSE public.rate_limit_buckets.count + 1
    END,
    window_starts_at = CASE
      WHEN public.rate_limit_buckets.window_starts_at + make_interval(secs => p_window_seconds) <= v_now
        THEN v_now
      ELSE public.rate_limit_buckets.window_starts_at
    END,
    updated_at = v_now
  RETURNING count, window_starts_at INTO v_count, v_start;
  RETURN v_count <= p_limit;
END;
$$;
CREATE FUNCTION public.create_cod_order(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
  -- Optional free-delivery threshold on the zone (20261117120000): computed from server prices only.
  IF v_zone.free_shipping_min_paisa IS NOT NULL AND v_subtotal >= v_zone.free_shipping_min_paisa THEN
    v_shipping := 0;
  END IF;
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
CREATE FUNCTION public.get_order_confirmation_by_token(p_token uuid) RETURNS TABLE(order_number text, total_due_paisa bigint, payment_status public.payment_status, status public.order_status)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT o.order_number, o.total_due_paisa, o.payment_status, o.status
  FROM public.orders o
  WHERE o.access_token = p_token
  LIMIT 1;
END;
$$;
CREATE FUNCTION public.get_published_homepage_sections() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_sections jsonb;
BEGIN
  SELECT v.sections
  INTO v_sections
  FROM public.theme_publications p
  INNER JOIN public.theme_versions v ON v.id = p.published_version_id
  WHERE p.template_key = 'homepage'
    AND v.status = 'published'
  LIMIT 1;
  IF v_sections IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN v_sections;
END;
$$;
COMMENT ON FUNCTION public.get_published_homepage_sections() IS 'Returns published homepage sections jsonb only. No drafts, actor IDs, or theme metadata.';
CREATE FUNCTION public.has_staff_role(roles public.staff_role[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_memberships m
    WHERE m.user_id = auth.uid()
      AND m.is_active = true
      AND m.role = ANY (roles)
  );
$$;
CREATE FUNCTION public.is_staff() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_memberships m
    WHERE m.user_id = auth.uid() AND m.is_active = true
  );
$$;
CREATE FUNCTION public.norm_place(t text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  SELECT lower(trim(both FROM coalesce(t, '')));
$$;
CREATE FUNCTION public.order_items_inventory_ledger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
CREATE FUNCTION public.orders_cancel_restock() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
CREATE FUNCTION public.publish_homepage_theme(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_actor uuid := (payload->>'actor_user_id')::uuid;
  v_source uuid := (payload->>'source_version_id')::uuid;
  v_template public.theme_templates%ROWTYPE;
  v_src public.theme_versions%ROWTYPE;
  v_new_id uuid;
  v_label text;
  v_prev uuid;
  v_sec jsonb;
  v_type text;
  v_url text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_memberships m
    WHERE m.user_id = v_actor AND m.is_active AND m.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001', MESSAGE = 'owner or admin required to publish';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001', MESSAGE = 'actor mismatch';
  END IF;
  SELECT * INTO v_template FROM public.theme_templates WHERE key = 'homepage';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'migration_required' USING ERRCODE = 'P0001';
  END IF;
  IF v_source IS NULL THEN
    SELECT * INTO v_src FROM public.theme_versions
    WHERE template_id = v_template.id AND status = 'draft'
    ORDER BY created_at DESC LIMIT 1;
  ELSE
    SELECT * INTO v_src FROM public.theme_versions
    WHERE id = v_source AND template_id = v_template.id;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_draft' USING ERRCODE = 'P0001';
  END IF;
  IF v_src.status NOT IN ('draft', 'published') THEN
    RAISE EXCEPTION 'invalid_source' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(v_src.sections) <> 'array' OR jsonb_array_length(v_src.sections) < 1 THEN
    RAISE EXCEPTION 'invalid_sections' USING ERRCODE = 'P0001';
  END IF;
  FOR v_sec IN SELECT * FROM jsonb_array_elements(v_src.sections)
  LOOP
    v_type := v_sec->>'type';
    IF v_type IS NULL OR v_type NOT IN (
      'v5_cinematic_hero','v5_product_story','v5_featured_products','v5_brand_grid','v5_budget_bands',
      'v5_spec_filters','v5_new_gen','v5_chromebook','v5_compare_demo','v5_promo','v5_home_inquiry',
      'rich_text','image_banner'
    ) THEN
      RAISE EXCEPTION 'unsupported_section_type' USING ERRCODE = 'P0001';
    END IF;
    FOR v_url IN
      SELECT u FROM unnest(ARRAY[
        v_sec#>>'{settings,mainImageUrl}', v_sec#>>'{settings,side1ImageUrl}', v_sec#>>'{settings,side2ImageUrl}',
        v_sec#>>'{settings,imageUrl}', v_sec#>>'{settings,angleImages,front}', v_sec#>>'{settings,angleImages,left}',
        v_sec#>>'{settings,angleImages,right}', v_sec#>>'{settings,angleImages,rear}'
      ]) AS u WHERE u IS NOT NULL AND u <> ''
    LOOP
      IF v_url !~* '^https://' OR v_url ~* '(javascript:|data:)' OR length(v_url) > 2000 THEN
        RAISE EXCEPTION 'unsafe_asset_url' USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
  END LOOP;
  SELECT published_version_id INTO v_prev FROM public.theme_publications WHERE template_key = 'homepage';
  v_label := 'published-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISSMS');
  PERFORM set_config('app.theme_mutation', 'publish', true);
  INSERT INTO public.theme_versions (
    template_id, label, status, sections, theme_settings, created_by, published_at
  ) VALUES (
    v_template.id, v_label, 'published', v_src.sections,
    COALESCE(v_src.theme_settings, '{}'::jsonb), v_actor, now()
  ) RETURNING id INTO v_new_id;
  INSERT INTO public.theme_publications (template_key, published_version_id, updated_at, updated_by)
  VALUES ('homepage', v_new_id, now(), v_actor)
  ON CONFLICT (template_key) DO UPDATE
    SET published_version_id = EXCLUDED.published_version_id,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by;
  INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, after)
  VALUES (
    v_actor, 'theme.homepage.publish', 'theme_publications', 'homepage',
    jsonb_build_object('published_version_id', v_new_id, 'source_version_id', v_src.id, 'previous_version_id', v_prev, 'label', v_label)
  );
  RETURN jsonb_build_object(
    'ok', true,
    'published_version_id', v_new_id,
    'source_version_id', v_src.id,
    'previous_version_id', v_prev,
    'label', v_label,
    'section_count', jsonb_array_length(v_src.sections)
  );
END;
$$;
CREATE FUNCTION public.quote_cod_shipping(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_city text := trim(payload#>>'{address,city}');
  v_province text := trim(payload#>>'{address,province}');
  v_zone public.shipping_zones%ROWTYPE;
  v_matches jsonb := '[]'::jsonb;
  r public.shipping_zones%ROWTYPE;
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
        'free_shipping_min_paisa', r.free_shipping_min_paisa,
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
CREATE FUNCTION public.record_cod_collection(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_actor uuid := (payload->>'actor_user_id')::uuid;
  v_order_number text := trim(payload->>'order_number');
  v_amount bigint := (payload->>'amount_paisa')::bigint;
  v_idem text := nullif(trim(payload->>'idempotency_key'), '');
  v_collector text := coalesce(trim(payload->>'collector_ref'), '');
  v_note text := coalesce(trim(payload->>'note'), '');
  v_order public.orders%ROWTYPE;
  v_existing public.cod_collections%ROWTYPE;
  v_existing_order_number text;
  v_constraint text;
  v_next bigint;
  v_pay public.payment_status;
  v_col_id uuid;
BEGIN
  -- Server-only: refuse Data API callers other than service_role even if EXECUTE is ever granted again.
  IF coalesce(auth.role(), 'service_role') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;
  IF v_actor IS NULL OR v_order_number IS NULL OR v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001';
  END IF;
  IF v_idem IS NULL THEN
    RAISE EXCEPTION 'idempotency_required' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_memberships m
    WHERE m.user_id = v_actor
      AND m.is_active = true
      AND m.role IN ('owner', 'admin', 'manager', 'fulfillment')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;
  -- Existing operation for this key (fast path, no lock)
  SELECT * INTO v_existing
  FROM public.cod_collections c
  WHERE c.idempotency_key = v_idem;
  IF v_existing.id IS NULL THEN
    SELECT * INTO v_order
    FROM public.orders
    WHERE order_number = v_order_number
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
    END IF;
    -- A concurrent call with this key for the same order held the lock first and has committed.
    SELECT * INTO v_existing
    FROM public.cod_collections c
    WHERE c.idempotency_key = v_idem;
    IF v_existing.id IS NULL THEN
      v_next := v_order.amount_collected_paisa + v_amount;
      IF v_next > v_order.total_due_paisa THEN
        RAISE EXCEPTION 'over_collection' USING ERRCODE = 'P0001';
      END IF;
      IF v_next >= v_order.total_due_paisa THEN
        v_pay := 'collected';
      ELSIF v_next > 0 THEN
        v_pay := 'partially_collected';
      ELSE
        v_pay := v_order.payment_status;
      END IF;
      BEGIN
        INSERT INTO public.cod_collections (
          order_id, amount_paisa, collector_ref, recorded_by, note, idempotency_key
        ) VALUES (
          v_order.id, v_amount, v_collector, v_actor, v_note, v_idem
        )
        RETURNING id INTO v_col_id;
      EXCEPTION WHEN unique_violation THEN
        -- Only the idempotency index means "same key used concurrently" (here: for another order, whose
        -- lock did not serialize us). Any other unique violation is a real error.
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint IS DISTINCT FROM 'cod_collections_idempotency_uidx' THEN
          RAISE;
        END IF;
        SELECT * INTO v_existing
        FROM public.cod_collections c
        WHERE c.idempotency_key = v_idem;
        IF v_existing.id IS NULL THEN
          RAISE;
        END IF;
      END;
    END IF;
  END IF;
  -- A key identifies one operation: same order and same amount replay it; anything else is a conflict.
  IF v_existing.id IS NOT NULL THEN
    SELECT o.order_number, o.amount_collected_paisa, o.payment_status
      INTO v_existing_order_number, v_next, v_pay
    FROM public.orders o
    WHERE o.id = v_existing.order_id;
    IF v_existing_order_number IS DISTINCT FROM v_order_number
       OR v_existing.amount_paisa <> v_amount THEN
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent_replay', true,
      'collection_id', v_existing.id,
      'amount_collected_paisa', v_next,
      'payment_status', v_pay
    );
  END IF;
  UPDATE public.orders
  SET amount_collected_paisa = v_next,
      payment_status = v_pay,
      updated_at = now()
  WHERE id = v_order.id;
  INSERT INTO public.order_events (
    order_id, event_type, actor_user_id, note, meta
  ) VALUES (
    v_order.id,
    'cod_collected',
    v_actor,
    v_note,
    jsonb_build_object('amount_paisa', v_amount, 'payment_status', v_pay, 'collection_id', v_col_id)
  );
  INSERT INTO public.audit_logs (
    actor_user_id, action, entity_type, entity_id, after
  ) VALUES (
    v_actor,
    'cod.collect',
    'orders',
    v_order.id::text,
    jsonb_build_object(
      'amount_paisa', v_amount,
      'payment_status', v_pay,
      'amount_collected_paisa', v_next,
      'idempotency_key', v_idem
    )
  );
  RETURN jsonb_build_object(
    'ok', true,
    'idempotent_replay', false,
    'collection_id', v_col_id,
    'amount_collected_paisa', v_next,
    'payment_status', v_pay
  );
END;
$$;
CREATE FUNCTION public.rollback_homepage_theme(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_actor uuid := (payload->>'actor_user_id')::uuid;
  v_target uuid := (payload->>'target_version_id')::uuid;
  v_template public.theme_templates%ROWTYPE;
  v_ver public.theme_versions%ROWTYPE;
  v_prev uuid;
BEGIN
  IF v_actor IS NULL OR v_target IS NULL THEN
    RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_memberships m
    WHERE m.user_id = v_actor AND m.is_active AND m.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001', MESSAGE = 'actor mismatch';
  END IF;
  SELECT * INTO v_template FROM public.theme_templates WHERE key = 'homepage';
  IF NOT FOUND THEN RAISE EXCEPTION 'migration_required' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO v_ver FROM public.theme_versions
  WHERE id = v_target AND template_id = v_template.id AND status = 'published';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_target' USING ERRCODE = 'P0001';
  END IF;
  SELECT published_version_id INTO v_prev FROM public.theme_publications WHERE template_key = 'homepage';
  PERFORM set_config('app.theme_mutation', 'rollback', true);
  INSERT INTO public.theme_publications (template_key, published_version_id, updated_at, updated_by)
  VALUES ('homepage', v_target, now(), v_actor)
  ON CONFLICT (template_key) DO UPDATE
    SET published_version_id = EXCLUDED.published_version_id,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by;
  INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, after)
  VALUES (
    v_actor, 'theme.homepage.rollback', 'theme_publications', 'homepage',
    jsonb_build_object('published_version_id', v_target, 'previous_version_id', v_prev)
  );
  RETURN jsonb_build_object('ok', true, 'published_version_id', v_target, 'previous_version_id', v_prev);
END;
$$;
CREATE FUNCTION public.save_homepage_draft(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_actor uuid := (payload->>'actor_user_id')::uuid;
  v_sections jsonb := payload->'sections';
  v_settings jsonb := COALESCE(payload->'theme_settings', '{}'::jsonb);
  v_template_id uuid;
  v_id uuid;
  v_n int;
  v_sec jsonb;
  v_type text;
  v_url text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_memberships m
    WHERE m.user_id = v_actor AND m.is_active
      AND m.role IN ('owner', 'admin', 'editor')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001', MESSAGE = 'draft edit requires owner, admin, or editor';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001', MESSAGE = 'actor mismatch';
  END IF;
  IF jsonb_typeof(v_sections) <> 'array' OR jsonb_array_length(v_sections) < 1 OR jsonb_array_length(v_sections) > 40 THEN
    RAISE EXCEPTION 'invalid_sections' USING ERRCODE = 'P0001';
  END IF;
  FOR v_sec IN SELECT * FROM jsonb_array_elements(v_sections)
  LOOP
    v_type := v_sec->>'type';
    IF v_type IS NULL OR length(v_type) > 80 THEN
      RAISE EXCEPTION 'invalid_section_type' USING ERRCODE = 'P0001';
    END IF;
    IF v_type NOT IN (
      'v5_cinematic_hero','v5_product_story','v5_featured_products','v5_brand_grid','v5_budget_bands',
      'v5_spec_filters','v5_new_gen','v5_chromebook','v5_compare_demo','v5_promo','v5_home_inquiry',
      'rich_text','image_banner'
    ) THEN
      RAISE EXCEPTION 'unsupported_section_type' USING ERRCODE = 'P0001', MESSAGE = v_type;
    END IF;
    -- Reject javascript: / data: asset URLs in common image keys
    FOR v_url IN
      SELECT u FROM unnest(ARRAY[
        v_sec#>>'{settings,mainImageUrl}',
        v_sec#>>'{settings,side1ImageUrl}',
        v_sec#>>'{settings,side2ImageUrl}',
        v_sec#>>'{settings,imageUrl}',
        v_sec#>>'{settings,angleImages,front}',
        v_sec#>>'{settings,angleImages,left}',
        v_sec#>>'{settings,angleImages,right}',
        v_sec#>>'{settings,angleImages,rear}'
      ]) AS u
      WHERE u IS NOT NULL AND u <> ''
    LOOP
      IF v_url !~* '^https://' OR v_url ~* '(javascript:|data:)' THEN
        RAISE EXCEPTION 'unsafe_asset_url' USING ERRCODE = 'P0001';
      END IF;
      IF length(v_url) > 2000 THEN
        RAISE EXCEPTION 'asset_url_too_long' USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
  END LOOP;
  SELECT id INTO v_template_id FROM public.theme_templates WHERE key = 'homepage';
  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'migration_required' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('app.theme_mutation', 'draft_save', true);
  SELECT id INTO v_id
  FROM public.theme_versions
  WHERE template_id = v_template_id AND label = 'working-draft'
  LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.theme_versions (template_id, label, status, sections, theme_settings, created_by)
    VALUES (v_template_id, 'working-draft', 'draft', v_sections, v_settings, v_actor)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.theme_versions
    SET sections = v_sections,
        theme_settings = v_settings,
        status = 'draft'
    WHERE id = v_id AND status = 'draft';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'draft_locked' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, after)
  VALUES (v_actor, 'theme.homepage.draft_save', 'theme_versions', v_id::text,
          jsonb_build_object('section_count', jsonb_array_length(v_sections)));
  RETURN jsonb_build_object('ok', true, 'version_id', v_id, 'section_count', jsonb_array_length(v_sections));
END;
$$;
CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE FUNCTION public.staff_can_edit_theme_drafts() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.has_staff_role(ARRAY['owner','admin','editor']::public.staff_role[]);
$$;
CREATE FUNCTION public.storefront_variant_availability(p_product_ids uuid[]) RETURNS TABLE(product_id uuid, variant_id uuid, available boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
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
COMMENT ON FUNCTION public.storefront_variant_availability(p_product_ids uuid[]) IS 'Public stock signal: (product_id, variant_id, true/false) per purchasable variant of active products (max 200 products per call). Never exposes quantities. Mirrors create_cod_order stock rule.';
CREATE FUNCTION public.sync_product_variants(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_actor uuid := (payload->>'actor_user_id')::uuid;
  v_product_id uuid := (payload->>'product_id')::uuid;
  v_option_names text[] := ARRAY(
    SELECT jsonb_array_elements_text(COALESCE(payload->'option_names', '[]'::jsonb))
  );
  v_variants jsonb := COALESCE(payload->'variants', '[]'::jsonb);
  v_remove_missing boolean := COALESCE((payload->>'remove_missing')::boolean, true);
  v_row jsonb;
  v_id uuid;
  v_existing uuid;
  v_opts jsonb;
  v_title text;
  v_sku text;
  v_barcode text;
  v_price bigint;
  v_compare bigint;
  v_mode text;
  v_qty int;
  v_purchasable boolean;
  v_pos int;
  v_kept uuid[] := ARRAY[]::uuid[];
  v_created int := 0;
  v_updated int := 0;
  v_disabled int := 0;
  v_deleted int := 0;
  v_keys text[] := ARRAY[]::text[];
  v_key text;
  v_ex RECORD;
  v_order_count bigint;
  v_old_qty int;
  v_old_mode text;
  v_allow_oversell boolean;
BEGIN
  IF v_actor IS NULL OR v_product_id IS NULL THEN
    RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_memberships m
    WHERE m.user_id = v_actor AND m.is_active
      AND m.role IN ('owner', 'admin', 'manager', 'editor')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = v_product_id AND p.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(v_variants) <> 'array' OR jsonb_array_length(v_variants) < 1 OR jsonb_array_length(v_variants) > 250 THEN
    RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001';
  END IF;
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_variants)
  LOOP
    v_opts := COALESCE(v_row->'option_values', '{}'::jsonb);
    v_key := v_opts::text;
    IF v_key = ANY (v_keys) THEN
      RAISE EXCEPTION 'duplicate_options' USING ERRCODE = 'P0001';
    END IF;
    v_keys := array_append(v_keys, v_key);
  END LOOP;
  PERFORM 1 FROM public.products WHERE id = v_product_id FOR UPDATE;
  BEGIN
    UPDATE public.products
    SET option_names = COALESCE(v_option_names[1:3], '{}'::text[]),
        updated_by = v_actor,
        updated_at = now()
    WHERE id = v_product_id;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;
  UPDATE public.product_variants
  SET position = COALESCE(position, 1) + 10000
  WHERE product_id = v_product_id;
  v_pos := 0;
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_variants)
  LOOP
    v_pos := v_pos + 1;
    v_id := NULLIF(v_row->>'id', '')::uuid;
    v_opts := COALESCE(v_row->'option_values', '{}'::jsonb);
    v_title := COALESCE(NULLIF(trim(v_row->>'title'), ''), 'Default');
    v_sku := NULLIF(trim(v_row->>'sku'), '');
    v_barcode := NULLIF(trim(v_row->>'barcode'), '');
    v_price := (v_row->>'price_paisa')::bigint;
    v_compare := NULLIF(v_row->>'compare_at_paisa', '')::bigint;
    v_mode := COALESCE(NULLIF(v_row->>'inventory_mode', ''), 'untracked');
    v_qty := NULLIF(v_row->>'quantity_on_hand', '')::int;
    v_purchasable := COALESCE((v_row->>'purchasable')::boolean, true);
    v_allow_oversell := COALESCE((v_row->>'allow_oversell')::boolean, false);
    IF v_price IS NULL OR v_price < 0 THEN
      RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001', MESSAGE = 'invalid price_paisa';
    END IF;
    IF v_mode NOT IN ('tracked', 'untracked') THEN
      RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001';
    END IF;
    IF v_mode = 'untracked' THEN
      v_qty := NULL;
    ELSE
      IF v_qty IS NULL THEN v_qty := 0; END IF;
      IF v_qty < 0 AND NOT v_allow_oversell THEN
        RAISE EXCEPTION 'negative_stock_blocked' USING ERRCODE = 'P0001';
      END IF;
    END IF;
    v_existing := NULL;
    v_old_qty := NULL;
    v_old_mode := NULL;
    IF v_id IS NOT NULL THEN
      SELECT id, quantity_on_hand, inventory_mode::text
        INTO v_existing, v_old_qty, v_old_mode
      FROM public.product_variants
      WHERE id = v_id AND product_id = v_product_id;
      IF v_existing IS NULL THEN
        RAISE EXCEPTION 'cross_product_variant' USING ERRCODE = 'P0001';
      END IF;
    ELSE
      SELECT id, quantity_on_hand, inventory_mode::text
        INTO v_existing, v_old_qty, v_old_mode
      FROM public.product_variants
      WHERE product_id = v_product_id AND option_values = v_opts
      LIMIT 1;
      IF v_existing IS NULL AND v_sku IS NOT NULL THEN
        SELECT id, quantity_on_hand, inventory_mode::text
          INTO v_existing, v_old_qty, v_old_mode
        FROM public.product_variants
        WHERE product_id = v_product_id AND sku = v_sku
        LIMIT 1;
      END IF;
    END IF;
    IF v_existing IS NOT NULL THEN
      UPDATE public.product_variants SET
        title = v_title,
        sku = v_sku,
        price_paisa = v_price,
        compare_at_paisa = v_compare,
        inventory_mode = v_mode::public.inventory_mode,
        quantity_on_hand = v_qty,
        purchasable = v_purchasable,
        option_values = v_opts,
        position = v_pos,
        barcode = COALESCE(v_barcode, barcode),
        allow_oversell = v_allow_oversell,
        updated_at = now()
      WHERE id = v_existing;
      IF v_mode = 'tracked' AND (v_old_qty IS DISTINCT FROM v_qty OR v_old_mode IS DISTINCT FROM 'tracked') THEN
        INSERT INTO public.inventory_ledger (
          variant_id, delta, quantity_after, reason, reference_type, reference_id, actor_user_id
        ) VALUES (
          v_existing,
          COALESCE(v_qty, 0) - COALESCE(v_old_qty, 0),
          v_qty,
          CASE WHEN v_old_mode IS DISTINCT FROM 'tracked' THEN 'mode_to_tracked' ELSE 'merchant_adjust' END,
          'variant_sync',
          v_product_id::text,
          v_actor
        );
      END IF;
      v_kept := array_append(v_kept, v_existing);
      v_updated := v_updated + 1;
    ELSE
      INSERT INTO public.product_variants (
        product_id, title, sku, barcode, price_paisa, compare_at_paisa,
        inventory_mode, quantity_on_hand, purchasable, option_values, position, allow_oversell
      ) VALUES (
        v_product_id, v_title, v_sku, v_barcode, v_price, v_compare,
        v_mode::public.inventory_mode, v_qty, v_purchasable, v_opts, v_pos, v_allow_oversell
      ) RETURNING id INTO v_existing;
      IF v_mode = 'tracked' THEN
        INSERT INTO public.inventory_ledger (
          variant_id, delta, quantity_after, reason, reference_type, reference_id, actor_user_id
        ) VALUES (
          v_existing, COALESCE(v_qty, 0), v_qty, 'initial_stock', 'variant_sync', v_product_id::text, v_actor
        );
      END IF;
      v_kept := array_append(v_kept, v_existing);
      v_created := v_created + 1;
    END IF;
  END LOOP;
  IF v_remove_missing THEN
    FOR v_ex IN
      SELECT id FROM public.product_variants
      WHERE product_id = v_product_id AND NOT (id = ANY (v_kept))
    LOOP
      SELECT count(*) INTO v_order_count FROM public.order_items WHERE variant_id = v_ex.id;
      IF v_order_count > 0 THEN
        UPDATE public.product_variants SET purchasable = false, updated_at = now() WHERE id = v_ex.id;
        v_disabled := v_disabled + 1;
      ELSE
        DELETE FROM public.product_variants WHERE id = v_ex.id AND product_id = v_product_id;
        v_deleted := v_deleted + 1;
      END IF;
    END LOOP;
  END IF;
  INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, after)
  VALUES (
    v_actor, 'products.variants.sync', 'products', v_product_id::text,
    jsonb_build_object('created', v_created, 'updated', v_updated, 'disabled', v_disabled, 'deleted', v_deleted)
  );
  RETURN jsonb_build_object(
    'ok', true, 'created', v_created, 'updated', v_updated,
    'disabled', v_disabled, 'deleted', v_deleted, 'kept_ids', to_jsonb(v_kept)
  );
END;
$$;
CREATE FUNCTION public.theme_publications_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_flag text := coalesce(current_setting('app.theme_mutation', true), '');
BEGIN
  IF v_flag IN ('publish', 'rollback') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION 'theme_publication_via_rpc_only' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.theme_versions_immutability_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_flag text := coalesce(current_setting('app.theme_mutation', true), '');
BEGIN
  IF v_flag IN ('publish', 'draft_save', 'rollback') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' AND OLD.status IN ('published', 'archived') THEN
    RAISE EXCEPTION 'immutable_published_theme' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('published', 'archived') THEN
    RAISE EXCEPTION 'immutable_published_theme' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.status = 'published' AND v_flag <> 'publish' THEN
    RAISE EXCEPTION 'publish_via_rpc_only' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' AND v_flag <> 'publish' THEN
    RAISE EXCEPTION 'publish_via_rpc_only' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' AND OLD.status = 'draft' THEN
    RAISE EXCEPTION 'draft_via_rpc_only' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.status = 'draft' THEN
    RAISE EXCEPTION 'draft_via_rpc_only' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'draft' THEN
    RAISE EXCEPTION 'draft_via_rpc_only' USING ERRCODE = 'P0001';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE FUNCTION public.transition_order_status(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_actor uuid := (payload->>'actor_user_id')::uuid;
  v_order_number text := trim(payload->>'order_number');
  v_to text := trim(payload->>'to_status');
  v_note text := coalesce(trim(payload->>'note'), '');
  v_carrier text := coalesce(trim(payload->>'carrier'), '');
  v_tracking text := coalesce(trim(payload->>'tracking_number'), '');
  v_expected_from text := nullif(trim(payload->>'expected_from_status'), '');
  v_order public.orders%ROWTYPE;
  v_allowed text[];
BEGIN
  -- Server-only: refuse Data API callers other than service_role even if EXECUTE is ever granted again.
  IF coalesce(auth.role(), 'service_role') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;
  IF v_actor IS NULL OR v_order_number IS NULL OR v_to IS NULL THEN
    RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_memberships m
    WHERE m.user_id = v_actor
      AND m.is_active = true
      AND m.role IN ('owner', 'admin', 'manager', 'fulfillment')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_order
  FROM public.orders
  WHERE order_number = v_order_number
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_expected_from IS NOT NULL AND v_order.status::text <> v_expected_from THEN
    RAISE EXCEPTION 'stale_status' USING ERRCODE = 'P0001';
  END IF;
  v_allowed := CASE v_order.status::text
    WHEN 'placed' THEN ARRAY['pending_confirmation', 'confirmed', 'cancelled']
    WHEN 'pending_confirmation' THEN ARRAY['confirmed', 'cancelled']
    WHEN 'confirmed' THEN ARRAY['packing', 'cancelled']
    WHEN 'packing' THEN ARRAY['shipped', 'cancelled']
    WHEN 'shipped' THEN ARRAY['out_for_delivery', 'delivery_failed']
    WHEN 'out_for_delivery' THEN ARRAY['delivered', 'delivery_failed']
    WHEN 'delivered' THEN ARRAY['returned']
    WHEN 'delivery_failed' THEN ARRAY['shipped', 'cancelled', 'returned']
    WHEN 'return_requested' THEN ARRAY['returned', 'cancelled']
    ELSE ARRAY[]::text[]
  END;
  IF NOT (v_to = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.orders
  SET status = v_to::public.order_status,
      updated_at = now()
  WHERE id = v_order.id;
  INSERT INTO public.order_events (
    order_id, event_type, from_status, to_status, actor_user_id, note
  ) VALUES (
    v_order.id, 'status_change', v_order.status::text, v_to, v_actor, v_note
  );
  IF v_carrier <> '' OR v_tracking <> '' OR v_to IN ('shipped', 'out_for_delivery', 'delivered') THEN
    INSERT INTO public.fulfillments (
      order_id, carrier, tracking_number, dispatched_at, delivered_at
    ) VALUES (
      v_order.id,
      v_carrier,
      v_tracking,
      CASE WHEN v_to IN ('shipped', 'out_for_delivery') THEN now() ELSE NULL END,
      CASE WHEN v_to = 'delivered' THEN now() ELSE NULL END
    );
  END IF;
  INSERT INTO public.audit_logs (
    actor_user_id, action, entity_type, entity_id, before, after
  ) VALUES (
    v_actor,
    'order.status',
    'orders',
    v_order.id::text,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', v_to)
  );
  RETURN jsonb_build_object(
    'ok', true,
    'from_status', v_order.status,
    'to_status', v_to
  );
END;
$$;
CREATE TABLE public.shipping_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    provinces text[] DEFAULT '{}'::text[] NOT NULL,
    cities text[] DEFAULT '{}'::text[] NOT NULL,
    flat_fee_paisa bigint DEFAULT 0 NOT NULL,
    cod_fee_paisa bigint DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    country text DEFAULT 'PK'::text NOT NULL,
    excluded_cities text[] DEFAULT '{}'::text[] NOT NULL,
    free_shipping_min_paisa bigint,
    CONSTRAINT shipping_zones_cod_fee_paisa_check CHECK ((cod_fee_paisa >= 0)),
    CONSTRAINT shipping_zones_flat_fee_paisa_check CHECK ((flat_fee_paisa >= 0)),
    CONSTRAINT shipping_zones_free_min_nonneg CHECK (((free_shipping_min_paisa IS NULL) OR (free_shipping_min_paisa >= 0)))
);
CREATE FUNCTION public.zone_serves_address(z public.shipping_zones, p_city text, p_province text) RETURNS boolean
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
DECLARE
  city text := public.norm_place(p_city);
  province text := public.norm_place(p_province);
  z_cities text[];
  z_provinces text[];
  z_excluded text[];
BEGIN
  IF NOT z.is_active THEN
    RETURN false;
  END IF;
  SELECT array_agg(public.norm_place(x)) INTO z_provinces FROM unnest(z.provinces) AS x;
  SELECT array_agg(public.norm_place(x)) INTO z_cities FROM unnest(z.cities) AS x;
  SELECT array_agg(public.norm_place(x)) INTO z_excluded FROM unnest(z.excluded_cities) AS x;
  -- Empty coverage arrays mean "not configured" — never match
  IF z_provinces IS NULL OR cardinality(z_provinces) = 0 THEN
    RETURN false;
  END IF;
  IF NOT (province = ANY (z_provinces)) THEN
    RETURN false;
  END IF;
  -- Explicitly excluded cities are never served by this zone
  IF z_excluded IS NOT NULL AND city = ANY (z_excluded) THEN
    RETURN false;
  END IF;
  -- If cities listed, must match; if cities empty, province-wide for that zone
  IF z_cities IS NOT NULL AND cardinality(z_cities) > 0 THEN
    RETURN city = ANY (z_cities);
  END IF;
  RETURN true;
END;
$$;
CREATE TABLE public.admin_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.staff_role DEFAULT 'admin'::public.staff_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);
CREATE TABLE public.articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    excerpt text DEFAULT ''::text NOT NULL,
    body_html text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    published_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT articles_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
);
CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_user_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    before jsonb,
    after jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.product_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    sku text,
    title text DEFAULT 'Default'::text NOT NULL,
    option_values jsonb DEFAULT '{}'::jsonb NOT NULL,
    price_paisa bigint NOT NULL,
    compare_at_paisa bigint,
    purchasable boolean DEFAULT true NOT NULL,
    inventory_mode public.inventory_mode DEFAULT 'untracked'::public.inventory_mode NOT NULL,
    quantity_on_hand integer,
    max_per_order integer DEFAULT 5 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    barcode text,
    cost_paisa bigint,
    compare_policy text DEFAULT 'optional'::text NOT NULL,
    low_stock_threshold integer,
    allow_oversell boolean DEFAULT false NOT NULL,
    weight_grams integer,
    "position" integer DEFAULT 1 NOT NULL,
    media_id uuid,
    CONSTRAINT product_variants_compare_at_paisa_check CHECK (((compare_at_paisa IS NULL) OR (compare_at_paisa >= 0))),
    CONSTRAINT product_variants_cost_paisa_check CHECK (((cost_paisa IS NULL) OR (cost_paisa >= 0))),
    CONSTRAINT product_variants_low_stock_threshold_check CHECK (((low_stock_threshold IS NULL) OR (low_stock_threshold >= 0))),
    CONSTRAINT product_variants_max_per_order_check CHECK (((max_per_order > 0) AND (max_per_order <= 20))),
    CONSTRAINT product_variants_position_check CHECK (("position" >= 1)),
    CONSTRAINT product_variants_price_paisa_check CHECK ((price_paisa >= 0)),
    CONSTRAINT product_variants_weight_grams_check CHECK (((weight_grams IS NULL) OR (weight_grams >= 0)))
);
CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    handle text NOT NULL,
    title text NOT NULL,
    description_safe text DEFAULT ''::text NOT NULL,
    merchant_vendor text DEFAULT 'Laptops HUB'::text NOT NULL,
    manufacturer text,
    product_type text,
    category text,
    status public.product_status DEFAULT 'draft'::public.product_status NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    media_approval public.media_approval DEFAULT 'pending'::public.media_approval NOT NULL,
    seo_title text,
    seo_description text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    specs jsonb DEFAULT '{}'::jsonb NOT NULL,
    flags text[] DEFAULT '{}'::text[] NOT NULL,
    import_source text DEFAULT 'csv'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    summary text DEFAULT ''::text NOT NULL,
    option_names text[] DEFAULT '{}'::text[] NOT NULL,
    template_key text DEFAULT 'product'::text NOT NULL,
    updated_by uuid,
    CONSTRAINT products_handle_format CHECK ((handle ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text))
);
COMMENT ON COLUMN public.products.deleted_at IS 'Soft-delete timestamp; storefront and public views must exclude non-null.';
CREATE VIEW public.catalog_products_public WITH (security_invoker='true') AS
 SELECT p.id,
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
   FROM (public.products p
     JOIN public.product_variants v ON ((v.product_id = p.id)))
  WHERE ((p.status = 'active'::public.product_status) AND (p.deleted_at IS NULL) AND (v.purchasable = true) AND (v.price_paisa > 0));
CREATE TABLE public.cod_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    amount_paisa bigint NOT NULL,
    collected_at timestamp with time zone DEFAULT now() NOT NULL,
    collector_ref text DEFAULT ''::text NOT NULL,
    recorded_by uuid,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    idempotency_key text,
    CONSTRAINT cod_collections_amount_paisa_check CHECK ((amount_paisa > 0))
);
CREATE TABLE public.collection_products (
    collection_id uuid NOT NULL,
    product_id uuid NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);
CREATE TABLE public.collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    rule jsonb DEFAULT '{}'::jsonb NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    published boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    collection_type text DEFAULT 'manual'::text NOT NULL,
    image_url text,
    seo_title text,
    seo_description text,
    template_key text DEFAULT 'collection'::text NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT collections_collection_type_check CHECK ((collection_type = ANY (ARRAY['manual'::text, 'automated'::text])))
);
CREATE TABLE public.contact_inquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    subject text DEFAULT ''::text NOT NULL,
    message text NOT NULL,
    status public.inquiry_status DEFAULT 'new'::public.inquiry_status NOT NULL,
    assigned_to uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.content_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    body_html text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    legal_approved boolean DEFAULT false NOT NULL,
    legal_approved_at timestamp with time zone,
    legal_approved_by uuid,
    CONSTRAINT content_pages_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'draft'::text, 'published'::text])))
);
COMMENT ON COLUMN public.content_pages.legal_approved IS 'Owner/manager legal approval for warranty/shipping/privacy/returns/terms. Editors cannot set this.';
CREATE TABLE public.faq_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_label text NOT NULL,
    question text NOT NULL,
    answer_html text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);
CREATE TABLE public.fulfillments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    carrier text DEFAULT ''::text NOT NULL,
    tracking_number text DEFAULT ''::text NOT NULL,
    dispatched_at timestamp with time zone,
    delivered_at timestamp with time zone,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.import_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    dry_run boolean DEFAULT false NOT NULL,
    report jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    profile text DEFAULT 'shopify_csv'::text NOT NULL,
    strategy text,
    source_filename text,
    source_fingerprint text,
    actor_user_id uuid,
    progress jsonb DEFAULT '{}'::jsonb NOT NULL,
    changeset_id uuid,
    error_export jsonb DEFAULT '[]'::jsonb NOT NULL
);
CREATE TABLE public.inventory_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    variant_id uuid NOT NULL,
    delta integer NOT NULL,
    quantity_after integer,
    reason text NOT NULL,
    reference_type text,
    reference_id text,
    actor_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.order_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    line1 text NOT NULL,
    line2 text DEFAULT ''::text NOT NULL,
    city text NOT NULL,
    province text NOT NULL,
    postcode text DEFAULT ''::text NOT NULL,
    landmark text DEFAULT ''::text NOT NULL,
    country text DEFAULT 'PK'::text NOT NULL
);
CREATE TABLE public.order_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    event_type text NOT NULL,
    from_status text,
    to_status text,
    actor_user_id uuid,
    note text DEFAULT ''::text NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    variant_id uuid,
    handle text NOT NULL,
    title_snapshot text NOT NULL,
    variant_title_snapshot text DEFAULT 'Default'::text NOT NULL,
    sku_snapshot text,
    unit_price_paisa bigint NOT NULL,
    quantity integer NOT NULL,
    line_total_paisa bigint NOT NULL,
    CONSTRAINT order_items_line_math CHECK ((line_total_paisa = (unit_price_paisa * quantity))),
    CONSTRAINT order_items_line_total_paisa_check CHECK ((line_total_paisa >= 0)),
    CONSTRAINT order_items_quantity_check CHECK (((quantity > 0) AND (quantity <= 20))),
    CONSTRAINT order_items_unit_price_paisa_check CHECK ((unit_price_paisa >= 0))
);
CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number text NOT NULL,
    access_token uuid DEFAULT gen_random_uuid() NOT NULL,
    status public.order_status DEFAULT 'placed'::public.order_status NOT NULL,
    payment_method public.payment_method DEFAULT 'cod'::public.payment_method NOT NULL,
    payment_status public.payment_status DEFAULT 'unpaid_cod'::public.payment_status NOT NULL,
    currency text DEFAULT 'PKR'::text NOT NULL,
    customer_name text NOT NULL,
    customer_phone_e164 text NOT NULL,
    customer_phone_normalized text NOT NULL,
    customer_email text,
    subtotal_paisa bigint NOT NULL,
    shipping_paisa bigint DEFAULT 0 NOT NULL,
    cod_fee_paisa bigint DEFAULT 0 NOT NULL,
    discount_paisa bigint DEFAULT 0 NOT NULL,
    tax_paisa bigint DEFAULT 0 NOT NULL,
    total_due_paisa bigint NOT NULL,
    amount_collected_paisa bigint DEFAULT 0 NOT NULL,
    shipping_zone_id uuid,
    customer_note text DEFAULT ''::text NOT NULL,
    confirmation_version text DEFAULT 'cod-v1-pending-legal'::text NOT NULL,
    confirmation_accepted_at timestamp with time zone DEFAULT now() NOT NULL,
    idempotency_key text NOT NULL,
    ip_hash text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orders_amount_collected_paisa_check CHECK ((amount_collected_paisa >= 0)),
    CONSTRAINT orders_cod_fee_paisa_check CHECK ((cod_fee_paisa >= 0)),
    CONSTRAINT orders_currency_check CHECK ((currency = 'PKR'::text)),
    CONSTRAINT orders_discount_paisa_check CHECK ((discount_paisa >= 0)),
    CONSTRAINT orders_shipping_paisa_check CHECK ((shipping_paisa >= 0)),
    CONSTRAINT orders_subtotal_paisa_check CHECK ((subtotal_paisa >= 0)),
    CONSTRAINT orders_tax_paisa_check CHECK ((tax_paisa >= 0)),
    CONSTRAINT orders_total_due_paisa_check CHECK ((total_due_paisa >= 0)),
    CONSTRAINT orders_total_invariant CHECK ((total_due_paisa = ((((subtotal_paisa + shipping_paisa) + cod_fee_paisa) + tax_paisa) - discount_paisa)))
);
CREATE TABLE public.product_badges (
    product_id uuid NOT NULL,
    kind text NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    note text DEFAULT ''::text NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_badges_kind_check CHECK ((kind = ANY (ARRAY['featured'::text, 'popular_pick'::text, 'staff_pick'::text]))),
    CONSTRAINT product_badges_note_check CHECK ((char_length(note) <= 300)),
    CONSTRAINT product_badges_window CHECK (((starts_at IS NULL) OR (ends_at IS NULL) OR (ends_at > starts_at)))
);
CREATE TABLE public.product_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    url text NOT NULL,
    alt text DEFAULT ''::text NOT NULL,
    "position" integer DEFAULT 1 NOT NULL,
    approval public.media_approval DEFAULT 'pending'::public.media_approval NOT NULL,
    width integer,
    height integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    origin text DEFAULT 'remote'::text NOT NULL,
    source_provider text,
    variant_id uuid,
    is_primary boolean DEFAULT false NOT NULL,
    health_status text DEFAULT 'unknown'::text NOT NULL,
    last_checked_at timestamp with time zone,
    content_type text,
    rights_note text,
    CONSTRAINT product_media_health_status_check CHECK ((health_status = ANY (ARRAY['unknown'::text, 'ok'::text, 'redirect'::text, 'missing'::text, 'blocked'::text, 'error'::text]))),
    CONSTRAINT product_media_origin_check CHECK ((origin = ANY (ARRAY['remote'::text, 'uploaded'::text, 'rehosted'::text, 'source_shopify'::text]))),
    CONSTRAINT product_media_position_check CHECK (("position" >= 1))
);
COMMENT ON COLUMN public.product_media.origin IS 'remote = URL reference (incl. authorized Shopify CDN); uploaded/rehosted = controlled hosting.';
CREATE TABLE public.product_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    author_name text NOT NULL,
    rating smallint NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    body text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewer_email text,
    ip_hash text,
    moderated_by uuid,
    moderated_at timestamp with time zone,
    moderation_note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_reviews_author_name_check CHECK (((char_length(btrim(author_name)) >= 2) AND (char_length(btrim(author_name)) <= 60))),
    CONSTRAINT product_reviews_body_check CHECK (((char_length(btrim(body)) >= 10) AND (char_length(btrim(body)) <= 2000))),
    CONSTRAINT product_reviews_moderation_note_check CHECK ((char_length(moderation_note) <= 500)),
    CONSTRAINT product_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT product_reviews_reviewer_email_check CHECK (((reviewer_email IS NULL) OR (char_length(reviewer_email) <= 254))),
    CONSTRAINT product_reviews_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT product_reviews_title_check CHECK ((char_length(title) <= 120))
);
CREATE VIEW public.public_catalog_listing WITH (security_invoker='true') AS
 SELECT p.id,
    p.handle,
    p.title,
    p.description_safe,
    p.manufacturer,
    p.product_type,
    p.category,
    p.featured,
    p.tags,
    p.specs,
    v.id AS variant_id,
    v.sku,
    v.price_paisa,
    v.compare_at_paisa,
    v.max_per_order
   FROM (public.products p
     JOIN LATERAL ( SELECT pv.id,
            pv.sku,
            pv.price_paisa,
            pv.compare_at_paisa,
            pv.max_per_order
           FROM public.product_variants pv
          WHERE ((pv.product_id = p.id) AND (pv.purchasable = true) AND (pv.price_paisa > 0))
          ORDER BY pv.price_paisa
         LIMIT 1) v ON (true))
  WHERE (p.status = 'active'::public.product_status);
CREATE TABLE public.rate_limit_buckets (
    bucket_key text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    window_starts_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rate_limit_buckets_count_check CHECK ((count >= 0))
);
CREATE TABLE public.reels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    caption text DEFAULT ''::text NOT NULL,
    video_url text NOT NULL,
    poster_url text,
    product_id uuid,
    rights_status text DEFAULT 'pending'::text NOT NULL,
    rights_note text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    creator_name text DEFAULT ''::text NOT NULL,
    creator_consent boolean DEFAULT false NOT NULL,
    tag text DEFAULT ''::text NOT NULL,
    CONSTRAINT reels_caption_check CHECK ((char_length(caption) <= 300)),
    CONSTRAINT reels_creator_name_len CHECK ((char_length(creator_name) <= 80)),
    CONSTRAINT reels_creator_requires_consent CHECK (((creator_name = ''::text) OR creator_consent)),
    CONSTRAINT reels_no_reference_assets CHECK (((video_url !~* '^https?://([a-z0-9-]+\.)*ronin\.pk(/|:|$)'::text) AND ((poster_url IS NULL) OR (poster_url !~* '^https?://([a-z0-9-]+\.)*ronin\.pk(/|:|$)'::text)))),
    CONSTRAINT reels_poster_scheme CHECK (((poster_url IS NULL) OR (poster_url ~* '^https://'::text) OR (poster_url ~* '^http://(127\.0\.0\.1|localhost)(:[0-9]+)?/'::text))),
    CONSTRAINT reels_poster_url_check CHECK (((poster_url IS NULL) OR (char_length(poster_url) <= 2048))),
    CONSTRAINT reels_publish_requires_rights CHECK (((status <> 'published'::text) OR (rights_status = ANY (ARRAY['owned'::text, 'licensed'::text])))),
    CONSTRAINT reels_rights_note_check CHECK ((char_length(rights_note) <= 500)),
    CONSTRAINT reels_rights_status_check CHECK ((rights_status = ANY (ARRAY['pending'::text, 'owned'::text, 'licensed'::text]))),
    CONSTRAINT reels_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))),
    CONSTRAINT reels_tag_format CHECK (((tag = ''::text) OR (tag ~ '^#?[A-Za-z0-9_]{1,39}$'::text))),
    CONSTRAINT reels_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 120))),
    CONSTRAINT reels_video_scheme CHECK (((video_url ~* '^https://'::text) OR (video_url ~* '^http://(127\.0\.0\.1|localhost)(:[0-9]+)?/'::text))),
    CONSTRAINT reels_video_url_check CHECK ((char_length(video_url) <= 2048))
);
CREATE TABLE public.store_settings (
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);
CREATE TABLE public.theme_publications (
    template_key text NOT NULL,
    published_version_id uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);
CREATE TABLE public.theme_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    title text NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.theme_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    label text DEFAULT 'draft'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    theme_settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT theme_versions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);
COMMENT ON TABLE public.theme_versions IS 'Immutable-ish section snapshots; publish via theme_publications pointer switch.';
ALTER TABLE ONLY public.admin_memberships
    ADD CONSTRAINT admin_memberships_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.admin_memberships
    ADD CONSTRAINT admin_memberships_user_id_key UNIQUE (user_id);
ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_slug_key UNIQUE (slug);
ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.cod_collections
    ADD CONSTRAINT cod_collections_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.collection_products
    ADD CONSTRAINT collection_products_pkey PRIMARY KEY (collection_id, product_id);
ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_slug_key UNIQUE (slug);
ALTER TABLE ONLY public.contact_inquiries
    ADD CONSTRAINT contact_inquiries_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.content_pages
    ADD CONSTRAINT content_pages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.content_pages
    ADD CONSTRAINT content_pages_slug_key UNIQUE (slug);
ALTER TABLE ONLY public.faq_entries
    ADD CONSTRAINT faq_entries_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.fulfillments
    ADD CONSTRAINT fulfillments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.inventory_ledger
    ADD CONSTRAINT inventory_ledger_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.order_addresses
    ADD CONSTRAINT order_addresses_order_id_key UNIQUE (order_id);
ALTER TABLE ONLY public.order_addresses
    ADD CONSTRAINT order_addresses_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.order_events
    ADD CONSTRAINT order_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_access_token_key UNIQUE (access_token);
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.product_badges
    ADD CONSTRAINT product_badges_pkey PRIMARY KEY (product_id);
ALTER TABLE ONLY public.product_media
    ADD CONSTRAINT product_media_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.product_media
    ADD CONSTRAINT product_media_product_id_position_key UNIQUE (product_id, "position");
ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_sku_key UNIQUE (product_id, sku);
ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_handle_key UNIQUE (handle);
ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.rate_limit_buckets
    ADD CONSTRAINT rate_limit_buckets_pkey PRIMARY KEY (bucket_key);
ALTER TABLE ONLY public.reels
    ADD CONSTRAINT reels_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.shipping_zones
    ADD CONSTRAINT shipping_zones_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.store_settings
    ADD CONSTRAINT store_settings_pkey PRIMARY KEY (key);
ALTER TABLE ONLY public.theme_publications
    ADD CONSTRAINT theme_publications_pkey PRIMARY KEY (template_key);
ALTER TABLE ONLY public.theme_templates
    ADD CONSTRAINT theme_templates_key_key UNIQUE (key);
ALTER TABLE ONLY public.theme_templates
    ADD CONSTRAINT theme_templates_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.theme_versions
    ADD CONSTRAINT theme_versions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.theme_versions
    ADD CONSTRAINT theme_versions_template_id_label_key UNIQUE (template_id, label);
CREATE UNIQUE INDEX cod_collections_idempotency_uidx ON public.cod_collections USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE INDEX cod_collections_order_id_idx ON public.cod_collections USING btree (order_id);
CREATE INDEX collection_products_product_id_idx ON public.collection_products USING btree (product_id);
CREATE INDEX fulfillments_order_id_idx ON public.fulfillments USING btree (order_id);
CREATE INDEX import_jobs_actor_user_id_idx ON public.import_jobs USING btree (actor_user_id);
CREATE INDEX import_jobs_created_idx ON public.import_jobs USING btree (created_at DESC);
CREATE INDEX inventory_ledger_actor_user_id_idx ON public.inventory_ledger USING btree (actor_user_id);
CREATE INDEX inventory_ledger_reference_idx ON public.inventory_ledger USING btree (reference_type, reference_id);
CREATE INDEX inventory_ledger_variant_created_idx ON public.inventory_ledger USING btree (variant_id, created_at DESC);
CREATE INDEX notification_outbox_due_idx ON public.notification_outbox USING btree (status, next_attempt_at);
CREATE INDEX notification_outbox_order_id_idx ON public.notification_outbox USING btree (order_id);
CREATE INDEX order_events_order_id_idx ON public.order_events USING btree (order_id);
CREATE INDEX order_items_order_id_idx ON public.order_items USING btree (order_id);
CREATE INDEX order_items_product_id_idx ON public.order_items USING btree (product_id);
CREATE INDEX order_items_variant_id_idx ON public.order_items USING btree (variant_id);
CREATE INDEX orders_created_at_idx ON public.orders USING btree (created_at DESC);
CREATE UNIQUE INDEX orders_idempotency_key_uidx ON public.orders USING btree (idempotency_key);
CREATE INDEX orders_phone_idx ON public.orders USING btree (customer_phone_normalized);
CREATE INDEX orders_shipping_zone_id_idx ON public.orders USING btree (shipping_zone_id);
CREATE INDEX orders_status_idx ON public.orders USING btree (status);
CREATE INDEX product_media_health_idx ON public.product_media USING btree (health_status);
CREATE INDEX product_media_variant_idx ON public.product_media USING btree (variant_id) WHERE (variant_id IS NOT NULL);
CREATE INDEX product_reviews_public_idx ON public.product_reviews USING btree (product_id, created_at DESC) WHERE (status = 'approved'::text);
CREATE INDEX product_reviews_queue_idx ON public.product_reviews USING btree (status, created_at DESC);
CREATE INDEX product_variants_barcode_idx ON public.product_variants USING btree (barcode) WHERE (barcode IS NOT NULL);
CREATE INDEX product_variants_product_position_idx ON public.product_variants USING btree (product_id, "position");
CREATE INDEX products_deleted_at_idx ON public.products USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);
CREATE INDEX products_deleted_by_idx ON public.products USING btree (deleted_by);
CREATE INDEX products_status_updated_idx ON public.products USING btree (status, updated_at DESC);
CREATE INDEX products_updated_by_idx ON public.products USING btree (updated_by);
CREATE INDEX reels_product_id_idx ON public.reels USING btree (product_id);
CREATE INDEX reels_public_order_idx ON public.reels USING btree (sort_order, created_at DESC) WHERE (status = 'published'::text);
CREATE INDEX theme_publications_published_version_id_idx ON public.theme_publications USING btree (published_version_id);
CREATE INDEX theme_publications_updated_by_idx ON public.theme_publications USING btree (updated_by);
CREATE INDEX theme_versions_created_by_idx ON public.theme_versions USING btree (created_by);
CREATE INDEX theme_versions_template_status_idx ON public.theme_versions USING btree (template_id, status);
CREATE TRIGGER order_items_inventory_ledger AFTER INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.order_items_inventory_ledger();
CREATE TRIGGER orders_cancel_restock AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_cancel_restock();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER product_badges_set_updated_at BEFORE UPDATE ON public.product_badges FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER reels_set_updated_at BEFORE UPDATE ON public.reels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER theme_publications_guard BEFORE INSERT OR DELETE OR UPDATE ON public.theme_publications FOR EACH ROW EXECUTE FUNCTION public.theme_publications_guard();
CREATE TRIGGER theme_versions_immutability BEFORE INSERT OR DELETE OR UPDATE ON public.theme_versions FOR EACH ROW EXECUTE FUNCTION public.theme_versions_immutability_guard();
CREATE TRIGGER variants_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE ONLY public.admin_memberships
    ADD CONSTRAINT admin_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.cod_collections
    ADD CONSTRAINT cod_collections_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.collection_products
    ADD CONSTRAINT collection_products_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.collection_products
    ADD CONSTRAINT collection_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.fulfillments
    ADD CONSTRAINT fulfillments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.inventory_ledger
    ADD CONSTRAINT inventory_ledger_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.inventory_ledger
    ADD CONSTRAINT inventory_ledger_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.order_addresses
    ADD CONSTRAINT order_addresses_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.order_events
    ADD CONSTRAINT order_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_shipping_zone_id_fkey FOREIGN KEY (shipping_zone_id) REFERENCES public.shipping_zones(id);
ALTER TABLE ONLY public.product_badges
    ADD CONSTRAINT product_badges_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.product_media
    ADD CONSTRAINT product_media_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.product_media
    ADD CONSTRAINT product_media_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.reels
    ADD CONSTRAINT reels_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.theme_publications
    ADD CONSTRAINT theme_publications_published_version_id_fkey FOREIGN KEY (published_version_id) REFERENCES public.theme_versions(id);
ALTER TABLE ONLY public.theme_publications
    ADD CONSTRAINT theme_publications_template_key_fkey FOREIGN KEY (template_key) REFERENCES public.theme_templates(key) ON DELETE CASCADE;
ALTER TABLE ONLY public.theme_publications
    ADD CONSTRAINT theme_publications_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.theme_versions
    ADD CONSTRAINT theme_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.theme_versions
    ADD CONSTRAINT theme_versions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.theme_templates(id) ON DELETE CASCADE;
ALTER TABLE public.admin_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_memberships_no_self_delete ON public.admin_memberships FOR DELETE TO authenticated USING (false);
CREATE POLICY admin_memberships_no_self_insert ON public.admin_memberships FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY admin_memberships_no_self_update ON public.admin_memberships FOR UPDATE TO authenticated USING (false);
CREATE POLICY admin_memberships_self_select ON public.admin_memberships FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_staff()));
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY articles_public_select ON public.articles FOR SELECT TO authenticated, anon USING ((status = 'published'::text));
CREATE POLICY articles_staff_all ON public.articles TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_staff_select ON public.audit_logs FOR SELECT TO authenticated USING (public.is_staff());
ALTER TABLE public.cod_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY cod_collections_staff_all ON public.cod_collections TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY collection_products_public_select ON public.collection_products FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.collections c
  WHERE ((c.id = collection_products.collection_id) AND (c.published = true)))));
CREATE POLICY collection_products_staff_all ON public.collection_products TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY collections_public_select ON public.collections FOR SELECT TO authenticated, anon USING ((published = true));
CREATE POLICY collections_staff_all ON public.collections TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY faq_public_select ON public.faq_entries FOR SELECT TO authenticated, anon USING ((status = 'published'::text));
CREATE POLICY faq_staff_all ON public.faq_entries TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
ALTER TABLE public.fulfillments ENABLE ROW LEVEL SECURITY;
CREATE POLICY fulfillments_staff_all ON public.fulfillments TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_staff_all ON public.import_jobs TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY inquiries_anon_insert ON public.contact_inquiries FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY inquiries_staff_all ON public.contact_inquiries TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_ledger_staff_read ON public.inventory_ledger FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.admin_memberships m
  WHERE ((m.user_id = auth.uid()) AND (m.is_active = true)))));
CREATE POLICY media_public_select ON public.product_media FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.id = product_media.product_id) AND (p.status = 'active'::public.product_status)))));
CREATE POLICY media_staff_all ON public.product_media TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_addresses_staff_all ON public.order_addresses TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_events_staff_all ON public.order_events TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_items_staff_all ON public.order_items TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_staff_all ON public.orders TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY outbox_staff_all ON public.notification_outbox TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY pages_public_select ON public.content_pages FOR SELECT TO authenticated, anon USING (((status = 'published'::text) AND ((slug <> ALL (ARRAY['shipping'::text, 'returns'::text, 'warranty'::text, 'privacy'::text, 'terms'::text])) OR (legal_approved = true))));
CREATE POLICY pages_staff_all ON public.content_pages TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
ALTER TABLE public.product_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_badges_public_select ON public.product_badges FOR SELECT TO authenticated, anon USING ((((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at > now()))));
CREATE POLICY product_badges_staff_all ON public.product_badges TO authenticated USING (( SELECT public.has_staff_role(ARRAY['owner'::public.staff_role, 'admin'::public.staff_role, 'manager'::public.staff_role, 'editor'::public.staff_role]) AS has_staff_role)) WITH CHECK (( SELECT public.has_staff_role(ARRAY['owner'::public.staff_role, 'admin'::public.staff_role, 'manager'::public.staff_role, 'editor'::public.staff_role]) AS has_staff_role));
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_reviews_public_select ON public.product_reviews FOR SELECT TO authenticated, anon USING ((status = 'approved'::text));
CREATE POLICY product_reviews_staff_all ON public.product_reviews TO authenticated USING (( SELECT public.has_staff_role(ARRAY['owner'::public.staff_role, 'admin'::public.staff_role, 'manager'::public.staff_role, 'editor'::public.staff_role]) AS has_staff_role)) WITH CHECK (( SELECT public.has_staff_role(ARRAY['owner'::public.staff_role, 'admin'::public.staff_role, 'manager'::public.staff_role, 'editor'::public.staff_role]) AS has_staff_role));
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_public_select ON public.products FOR SELECT TO authenticated, anon USING ((status = 'active'::public.product_status));
CREATE POLICY products_staff_all ON public.products TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
CREATE POLICY reels_public_select ON public.reels FOR SELECT TO authenticated, anon USING (((status = 'published'::text) AND (rights_status = ANY (ARRAY['owned'::text, 'licensed'::text]))));
CREATE POLICY reels_staff_all ON public.reels TO authenticated USING (( SELECT public.has_staff_role(ARRAY['owner'::public.staff_role, 'admin'::public.staff_role, 'editor'::public.staff_role]) AS has_staff_role)) WITH CHECK (( SELECT public.has_staff_role(ARRAY['owner'::public.staff_role, 'admin'::public.staff_role, 'editor'::public.staff_role]) AS has_staff_role));
CREATE POLICY settings_public_select ON public.store_settings FOR SELECT TO authenticated, anon USING ((key = ANY (ARRAY['brand'::text, 'announcement'::text, 'cod_checkout'::text, 'seo'::text])));
CREATE POLICY settings_staff_all ON public.store_settings TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY shipping_public_select ON public.shipping_zones FOR SELECT TO authenticated, anon USING ((is_active = true));
CREATE POLICY shipping_staff_all ON public.shipping_zones TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY theme_publications_staff_select ON public.theme_publications FOR SELECT TO authenticated USING (public.is_staff());
ALTER TABLE public.theme_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY theme_templates_staff_select ON public.theme_templates FOR SELECT TO authenticated USING (public.is_staff());
ALTER TABLE public.theme_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY theme_versions_staff_select ON public.theme_versions FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY variants_public_select ON public.product_variants FOR SELECT TO authenticated, anon USING (((EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.id = product_variants.product_id) AND (p.status = 'active'::public.product_status)))) AND (purchasable = true) AND (price_paisa > 0)));
CREATE POLICY variants_staff_all ON public.product_variants TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
