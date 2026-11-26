-- G22: COD collection financial safety (docs/client-ownership-handover/26_G19_G22_PRODUCTION_MIGRATION_PLAN.md).
--
-- 1. record_cod_collection refuses cancelled and returned orders ('order_closed'). Replays of an operation that was
--    already recorded still answer as before.
-- 2. New append-only ledger public.cod_collection_adjustments: reversals (undo one collection, fully) and corrections
--    (signed amount), each with staff, time, reason and an idempotency key. Order totals (subtotal, fees, discount,
--    total_due) are never changed; only amount_collected_paisa and payment_status move, and every move is in the
--    ledger, order_events and audit_logs.
-- 3. New RPC adjust_cod_collection(jsonb): owner/admin/manager only, server-only (service_role), row-locked,
--    idempotent (same key + same order + same signed amount replays; anything else is 'idempotency_conflict').
--    'refunded_or_adjusted' becomes reachable: collected money brought back to zero.
-- 4. History is append-only: UPDATE is refused on cod_collections and cod_collection_adjustments; DELETE is refused
--    unless the parent order itself is being deleted (cascade).
--
-- Additive: one table, two triggers, one new function, one replaced function (same signature, grants kept).
-- No existing row is changed. Rollback: see the plan document §G22-rollback.

-- ── 1. ledger table ─────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cod_collection_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES public.cod_collections(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('reversal', 'correction')),
  delta_paisa bigint NOT NULL CHECK (delta_paisa <> 0),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 5 AND 500),
  recorded_by uuid NOT NULL,
  idempotency_key text NOT NULL,
  collected_before_paisa bigint NOT NULL CHECK (collected_before_paisa >= 0),
  collected_after_paisa bigint NOT NULL CHECK (collected_after_paisa >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cod_adjustments_reversal_shape CHECK (
    (kind = 'reversal' AND collection_id IS NOT NULL AND delta_paisa < 0)
    OR (kind = 'correction' AND collection_id IS NULL)
  ),
  CONSTRAINT cod_adjustments_arithmetic CHECK (collected_after_paisa = collected_before_paisa + delta_paisa)
);

CREATE UNIQUE INDEX IF NOT EXISTS cod_collection_adjustments_idempotency_uidx
  ON public.cod_collection_adjustments (idempotency_key);
CREATE INDEX IF NOT EXISTS cod_collection_adjustments_order_id_idx
  ON public.cod_collection_adjustments (order_id, created_at);
CREATE INDEX IF NOT EXISTS cod_collection_adjustments_collection_id_idx
  ON public.cod_collection_adjustments (collection_id);

ALTER TABLE public.cod_collection_adjustments ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (admin server routes) reads or writes it.
-- The project's default privileges give service_role everything on new tables; the ledger only needs to be read and
-- appended to. TRUNCATE is removed on both ledgers because it bypasses row triggers.
REVOKE ALL ON TABLE public.cod_collection_adjustments FROM public, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.cod_collection_adjustments TO service_role;
REVOKE TRUNCATE ON TABLE public.cod_collections FROM public, anon, authenticated, service_role;

-- ── 2. append-only guard ────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cod_ledger_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'ledger_append_only' USING ERRCODE = 'P0001',
      DETAIL = format('%s rows cannot be changed; record an adjustment instead.', TG_TABLE_NAME);
  END IF;
  -- DELETE: allowed only as part of deleting the order itself (ON DELETE CASCADE), never on its own.
  IF EXISTS (SELECT 1 FROM public.orders o WHERE o.id = OLD.order_id) THEN
    RAISE EXCEPTION 'ledger_append_only' USING ERRCODE = 'P0001',
      DETAIL = format('%s rows cannot be deleted while the order exists.', TG_TABLE_NAME);
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cod_collections_append_only ON public.cod_collections;
CREATE TRIGGER cod_collections_append_only
  BEFORE UPDATE OR DELETE ON public.cod_collections
  FOR EACH ROW EXECUTE FUNCTION public.cod_ledger_append_only();

DROP TRIGGER IF EXISTS cod_collection_adjustments_append_only ON public.cod_collection_adjustments;
CREATE TRIGGER cod_collection_adjustments_append_only
  BEFORE UPDATE OR DELETE ON public.cod_collection_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.cod_ledger_append_only();

REVOKE EXECUTE ON FUNCTION public.cod_ledger_append_only() FROM public, anon, authenticated;

-- ── 3. record_cod_collection: refuse closed orders (otherwise identical to 20261023150000) ─────────────────────────
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

    SELECT * INTO v_existing
    FROM public.cod_collections c
    WHERE c.idempotency_key = v_idem;

    IF v_existing.id IS NULL THEN
      -- G22: no new money on an order that was cancelled or returned.
      IF v_order.status IN ('cancelled', 'returned') THEN
        RAISE EXCEPTION 'order_closed' USING ERRCODE = 'P0001';
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

      BEGIN
        INSERT INTO public.cod_collections (
          order_id, amount_paisa, collector_ref, recorded_by, note, idempotency_key
        ) VALUES (
          v_order.id, v_amount, v_collector, v_actor, v_note, v_idem
        )
        RETURNING id INTO v_col_id;
      EXCEPTION WHEN unique_violation THEN
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

-- ── 4. adjust_cod_collection ────────────────────────────────────────────────────────────────────────────────────
-- payload: actor_user_id, order_number, kind ('reversal' | 'correction'), idempotency_key, reason,
--          collection_id (reversal), delta_paisa (correction: signed, non-zero).
CREATE OR REPLACE FUNCTION public.adjust_cod_collection(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := (payload->>'actor_user_id')::uuid;
  v_order_number text := trim(payload->>'order_number');
  v_kind text := trim(payload->>'kind');
  v_idem text := nullif(trim(payload->>'idempotency_key'), '');
  v_reason text := btrim(coalesce(payload->>'reason', ''));
  v_collection_id uuid := nullif(trim(payload->>'collection_id'), '')::uuid;
  v_delta bigint := nullif(trim(payload->>'delta_paisa'), '')::bigint;
  v_order public.orders%ROWTYPE;
  v_col public.cod_collections%ROWTYPE;
  v_existing public.cod_collection_adjustments%ROWTYPE;
  v_reversed bigint;
  v_next bigint;
  v_pay public.payment_status;
  v_adj_id uuid;
  v_constraint text;
BEGIN
  IF coalesce(auth.role(), 'service_role') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;

  IF v_actor IS NULL OR v_order_number IS NULL OR v_kind IS NULL OR v_kind NOT IN ('reversal', 'correction') THEN
    RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001';
  END IF;
  IF v_idem IS NULL THEN
    RAISE EXCEPTION 'idempotency_required' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_reason) < 5 OR char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0001';
  END IF;
  IF v_kind = 'reversal' AND v_collection_id IS NULL THEN
    RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001';
  END IF;
  IF v_kind = 'correction' AND (v_delta IS NULL OR v_delta = 0 OR abs(v_delta) > 100000000000) THEN
    RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001';
  END IF;

  -- Money corrections are for owners, admins and managers (fulfillment staff can record collections only).
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_memberships m
    WHERE m.user_id = v_actor
      AND m.is_active = true
      AND m.role IN ('owner', 'admin', 'manager')
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

  -- Same key: replay the recorded operation, or refuse a different one.
  SELECT * INTO v_existing FROM public.cod_collection_adjustments a WHERE a.idempotency_key = v_idem;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.order_id <> v_order.id OR v_existing.kind <> v_kind
       OR v_existing.collection_id IS DISTINCT FROM v_collection_id
       OR (v_kind = 'correction' AND v_existing.delta_paisa <> v_delta) THEN
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object(
      'ok', true, 'idempotent_replay', true, 'adjustment_id', v_existing.id,
      'delta_paisa', v_existing.delta_paisa,
      'amount_collected_paisa', v_order.amount_collected_paisa, 'payment_status', v_order.payment_status
    );
  END IF;

  IF v_kind = 'reversal' THEN
    SELECT * INTO v_col FROM public.cod_collections c WHERE c.id = v_collection_id AND c.order_id = v_order.id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
    END IF;
    SELECT coalesce(-sum(a.delta_paisa), 0) INTO v_reversed
    FROM public.cod_collection_adjustments a
    WHERE a.collection_id = v_col.id AND a.kind = 'reversal';
    IF v_reversed >= v_col.amount_paisa THEN
      RAISE EXCEPTION 'already_reversed' USING ERRCODE = 'P0001';
    END IF;
    v_delta := -(v_col.amount_paisa - v_reversed);
  END IF;

  v_next := v_order.amount_collected_paisa + v_delta;
  IF v_next < 0 THEN
    RAISE EXCEPTION 'below_zero' USING ERRCODE = 'P0001';
  END IF;
  IF v_next > v_order.total_due_paisa THEN
    RAISE EXCEPTION 'over_collection' USING ERRCODE = 'P0001';
  END IF;

  IF v_next >= v_order.total_due_paisa AND v_order.total_due_paisa > 0 THEN
    v_pay := 'collected';
  ELSIF v_next > 0 THEN
    v_pay := 'partially_collected';
  ELSE
    v_pay := 'refunded_or_adjusted';
  END IF;

  BEGIN
    INSERT INTO public.cod_collection_adjustments (
      order_id, collection_id, kind, delta_paisa, reason, recorded_by, idempotency_key,
      collected_before_paisa, collected_after_paisa
    ) VALUES (
      v_order.id, CASE WHEN v_kind = 'reversal' THEN v_collection_id END, v_kind, v_delta, v_reason, v_actor, v_idem,
      v_order.amount_collected_paisa, v_next
    )
    RETURNING id INTO v_adj_id;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'cod_collection_adjustments_idempotency_uidx' THEN
      -- Same key used concurrently for another order (this order's lock did not serialize it).
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    RAISE;
  END;

  UPDATE public.orders
  SET amount_collected_paisa = v_next,
      payment_status = v_pay,
      updated_at = now()
  WHERE id = v_order.id;

  INSERT INTO public.order_events (order_id, event_type, actor_user_id, note, meta)
  VALUES (
    v_order.id, 'cod_adjusted', v_actor, v_reason,
    jsonb_build_object('kind', v_kind, 'delta_paisa', v_delta, 'adjustment_id', v_adj_id,
                       'collection_id', v_collection_id, 'payment_status', v_pay)
  );

  INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, before, after)
  VALUES (
    v_actor, 'cod.adjust', 'orders', v_order.id::text,
    jsonb_build_object('amount_collected_paisa', v_order.amount_collected_paisa, 'payment_status', v_order.payment_status),
    jsonb_build_object('amount_collected_paisa', v_next, 'payment_status', v_pay, 'kind', v_kind,
                       'delta_paisa', v_delta, 'reason', v_reason, 'idempotency_key', v_idem)
  );

  RETURN jsonb_build_object(
    'ok', true, 'idempotent_replay', false, 'adjustment_id', v_adj_id, 'delta_paisa', v_delta,
    'amount_collected_paisa', v_next, 'payment_status', v_pay
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.adjust_cod_collection(jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_cod_collection(jsonb) TO service_role;

COMMENT ON TABLE public.cod_collection_adjustments IS
  'G22 append-only COD ledger: reversals and corrections with staff, time and reason. Order totals are never edited.';
