-- Atomic COD collection + order status transitions, catalog listing view,
-- CMS legal approval separation, COD collection idempotency.

-- ── COD collection idempotency ─────────────────────────────────────────────
ALTER TABLE public.cod_collections
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS cod_collections_idempotency_uidx
  ON public.cod_collections (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── CMS: editorial publish ≠ legal/business approval ───────────────────────
ALTER TABLE public.content_pages
  ADD COLUMN IF NOT EXISTS legal_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS legal_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_approved_by uuid;

COMMENT ON COLUMN public.content_pages.legal_approved IS
  'Owner/manager legal approval for warranty/shipping/privacy/returns/terms. Editors cannot set this.';

-- Public may only see published AND (non-legal pages OR legally approved legal pages)
DROP POLICY IF EXISTS pages_public_select ON public.content_pages;
CREATE POLICY pages_public_select ON public.content_pages
  FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    AND (
      slug NOT IN ('shipping', 'returns', 'warranty', 'privacy', 'terms')
      OR legal_approved = true
    )
  );

-- ── Public catalog listing (price-sortable, no inventory) ──────────────────
CREATE OR REPLACE VIEW public.public_catalog_listing
WITH (security_invoker = true)
AS
SELECT
  p.id,
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
FROM public.products p
INNER JOIN LATERAL (
  SELECT pv.id, pv.sku, pv.price_paisa, pv.compare_at_paisa, pv.max_per_order
  FROM public.product_variants pv
  WHERE pv.product_id = p.id
    AND pv.purchasable = true
    AND pv.price_paisa > 0
  ORDER BY pv.price_paisa ASC
  LIMIT 1
) v ON true
WHERE p.status = 'active';

GRANT SELECT ON public.public_catalog_listing TO anon, authenticated;

-- ── Atomic COD collection ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_cod_collection(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := (payload->>'actor_user_id')::uuid;
  v_order_number text := trim(payload->>'order_number');
  v_amount bigint := (payload->>'amount_paisa')::bigint;
  v_idem text := nullif(trim(payload->>'idempotency_key'), '');
  v_collector text := coalesce(trim(payload->>'collector_ref'), '');
  v_note text := coalesce(trim(payload->>'note'), '');
  v_order public.orders%ROWTYPE;
  v_next bigint;
  v_pay public.payment_status;
  v_existing_id uuid;
  v_col_id uuid;
BEGIN
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

  -- Idempotent replay
  SELECT c.id INTO v_existing_id
  FROM public.cod_collections c
  WHERE c.idempotency_key = v_idem;
  IF v_existing_id IS NOT NULL THEN
    SELECT o.amount_collected_paisa, o.payment_status
      INTO v_next, v_pay
    FROM public.orders o
    JOIN public.cod_collections c ON c.order_id = o.id
    WHERE c.id = v_existing_id;
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent_replay', true,
      'collection_id', v_existing_id,
      'amount_collected_paisa', v_next,
      'payment_status', v_pay
    );
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE order_number = v_order_number
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;

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

  INSERT INTO public.cod_collections (
    order_id, amount_paisa, collector_ref, recorded_by, note, idempotency_key
  ) VALUES (
    v_order.id, v_amount, v_collector, v_actor, v_note, v_idem
  )
  RETURNING id INTO v_col_id;

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

REVOKE ALL ON FUNCTION public.record_cod_collection(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_cod_collection(jsonb) TO service_role;

-- ── Atomic order status transition ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.transition_order_status(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.transition_order_status(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_order_status(jsonb) TO service_role;
