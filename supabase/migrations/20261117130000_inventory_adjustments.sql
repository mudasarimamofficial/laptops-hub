-- Manual stock adjustments for the Inventory desk (master prompt §4 "adjustments with reason and actor").
-- One SECURITY DEFINER function, service_role only (the app calls it after its own staff-role check). Additive.
--
--   adjust_inventory({variant_id, mode: 'delta'|'set', amount, reason, actor_user_id, expected_quantity?})
--
--  * Locks the variant row (same lock create_cod_order takes), so an adjustment and a checkout never interleave.
--  * Tracked variants only. A manual adjustment can never leave stock below 0.
--  * 'set' requires expected_quantity (what the person saw): if stock moved meanwhile (an order came in), the
--    adjustment is refused with 'stale_quantity' instead of silently overwriting it.
--  * Writes exactly one inventory_ledger row (reason = the adjustment reason, reference_type 'manual_adjustment').
--  * Reasons: stock_received, count_correction, damaged_or_lost, customer_return, other.
-- Rollback: drop function public.adjust_inventory(jsonb);

CREATE OR REPLACE FUNCTION public.adjust_inventory(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

REVOKE ALL ON FUNCTION public.adjust_inventory(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_inventory(jsonb) TO service_role;
