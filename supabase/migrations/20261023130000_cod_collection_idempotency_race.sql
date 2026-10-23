-- record_cod_collection: concurrent calls with one idempotency key could both pass the replay check (taken before
-- the order lock) and the loser failed on cod_collections_idempotency_uidx instead of returning a replay.
-- Money was never collected twice (the unique index held), but staff saw an error for a recorded collection.
--
-- Now: replay check before the lock (fast path), again after `FOR UPDATE` (the winner has committed by then and
-- READ COMMITTED gives the statement a fresh snapshot), and a unique_violation handler on the insert for the
-- remaining case of one key reused on a different order. All paths return the same replay payload.
-- Behaviour, signature and privileges are otherwise unchanged (CREATE OR REPLACE keeps the grants).

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

  -- Idempotent replay (fast path, no lock)
  SELECT c.id INTO v_existing_id
  FROM public.cod_collections c
  WHERE c.idempotency_key = v_idem;

  IF v_existing_id IS NULL THEN
    SELECT * INTO v_order
    FROM public.orders
    WHERE order_number = v_order_number
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
    END IF;

    -- A concurrent same-key call for this order held the lock first and has committed: replay it.
    SELECT c.id INTO v_existing_id
    FROM public.cod_collections c
    WHERE c.idempotency_key = v_idem;
  END IF;

  IF v_existing_id IS NULL THEN
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
      -- Same key used concurrently for another order (that order's lock did not serialize us).
      SELECT c.id INTO v_existing_id
      FROM public.cod_collections c
      WHERE c.idempotency_key = v_idem;
      IF v_existing_id IS NULL THEN
        RAISE;
      END IF;
    END;
  END IF;

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
