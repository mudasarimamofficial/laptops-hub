-- COD collection idempotency contract + server-only guard on the staff RPCs (docs/COD_IDEMPOTENCY_CONTRACT.md).
--
-- 20261023130000 made concurrent same-key calls replay instead of failing, but it replayed ANY existing row for
-- the key: the same key sent for a different order or a different amount returned success for an operation that
-- never happened. Now an idempotency key identifies one operation (order + amount):
--   * same key, same order, same amount  -> one collection row; every other call returns idempotent_replay
--   * same key, other order or amount    -> P0001 'idempotency_conflict' (nothing written)
--   * only cod_collections_idempotency_uidx is treated as a key race; other unique violations re-raise.
-- collector_ref and note are descriptive and do not make two calls different operations.
--
-- Both staff RPCs also refuse callers whose JWT role is not service_role (anon/authenticated via the Data API),
-- independent of EXECUTE grants. Direct database sessions (no JWT claims) are unaffected.
-- Signatures, return shapes and grants are unchanged (CREATE OR REPLACE keeps privileges).

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
