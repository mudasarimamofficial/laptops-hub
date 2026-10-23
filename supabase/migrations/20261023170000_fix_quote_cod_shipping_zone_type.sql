-- quote_cod_shipping: the zone loop variable was a generic `record`, which PL/pgSQL cannot pass to
-- zone_serves_address(public.shipping_zones, …) ("cannot cast type record to shipping_zones"). Every quote failed as
-- soon as one active shipping zone existed (production has none yet, so it answered "unserviceable" and hid the bug).
-- Only the declaration changes; body otherwise copied from 20261021140000. Grants are kept (CREATE OR REPLACE).

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
