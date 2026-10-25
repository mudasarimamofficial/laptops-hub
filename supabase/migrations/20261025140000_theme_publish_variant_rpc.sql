-- Theme publish/rollback RPCs + public published-sections read + atomic variant sync.
-- LOCAL / isolated apply only until owner approves Production.
-- Does not open theme tables to anon; only a narrow SECURITY DEFINER reader.

-- ── Public: read ONLY published homepage section settings ───────────────────
CREATE OR REPLACE FUNCTION public.get_published_homepage_sections()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.get_published_homepage_sections() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_homepage_sections() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_published_homepage_sections() IS
  'Returns published homepage sections jsonb only. No drafts, actor IDs, or theme metadata.';

-- ── Staff: publish immutable snapshot from a source draft/version ───────────
CREATE OR REPLACE FUNCTION public.publish_homepage_theme(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := (payload->>'actor_user_id')::uuid;
  v_source uuid := (payload->>'source_version_id')::uuid;
  v_template public.theme_templates%ROWTYPE;
  v_src public.theme_versions%ROWTYPE;
  v_new_id uuid;
  v_label text;
  v_prev uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001', MESSAGE = 'actor_user_id required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.admin_memberships m
    WHERE m.user_id = v_actor AND m.is_active AND m.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001', MESSAGE = 'owner or admin required to publish';
  END IF;

  SELECT * INTO v_template FROM public.theme_templates WHERE key = 'homepage';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'migration_required' USING ERRCODE = 'P0001', MESSAGE = 'homepage template missing';
  END IF;

  IF v_source IS NULL THEN
    SELECT * INTO v_src
    FROM public.theme_versions
    WHERE template_id = v_template.id AND status = 'draft'
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    SELECT * INTO v_src
    FROM public.theme_versions
    WHERE id = v_source AND template_id = v_template.id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_draft' USING ERRCODE = 'P0001', MESSAGE = 'source version not found for homepage';
  END IF;

  IF v_src.status NOT IN ('draft', 'published') THEN
    RAISE EXCEPTION 'invalid_source' USING ERRCODE = 'P0001', MESSAGE = 'source must be draft or published';
  END IF;

  IF jsonb_typeof(v_src.sections) <> 'array' OR jsonb_array_length(v_src.sections) < 1 THEN
    RAISE EXCEPTION 'invalid_sections' USING ERRCODE = 'P0001', MESSAGE = 'sections payload empty';
  END IF;

  SELECT published_version_id INTO v_prev
  FROM public.theme_publications
  WHERE template_key = 'homepage';

  v_label := 'published-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISSMS');

  INSERT INTO public.theme_versions (
    template_id, label, status, sections, theme_settings, created_by, published_at
  ) VALUES (
    v_template.id,
    v_label,
    'published',
    v_src.sections,
    COALESCE(v_src.theme_settings, '{}'::jsonb),
    v_actor,
    now()
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.theme_publications (template_key, published_version_id, updated_at, updated_by)
  VALUES ('homepage', v_new_id, now(), v_actor)
  ON CONFLICT (template_key) DO UPDATE
    SET published_version_id = EXCLUDED.published_version_id,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by;

  INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, after)
  VALUES (
    v_actor,
    'theme.homepage.publish',
    'theme_publications',
    'homepage',
    jsonb_build_object(
      'published_version_id', v_new_id,
      'source_version_id', v_src.id,
      'previous_version_id', v_prev,
      'label', v_label
    )
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

REVOKE ALL ON FUNCTION public.publish_homepage_theme(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_homepage_theme(jsonb) TO service_role;

-- ── Staff: rollback pointer to a previously published snapshot ──────────────
CREATE OR REPLACE FUNCTION public.rollback_homepage_theme(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  SELECT * INTO v_template FROM public.theme_templates WHERE key = 'homepage';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'migration_required' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_ver
  FROM public.theme_versions
  WHERE id = v_target AND template_id = v_template.id AND status = 'published';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_target' USING ERRCODE = 'P0001', MESSAGE = 'target must be an existing published homepage version';
  END IF;

  SELECT published_version_id INTO v_prev FROM public.theme_publications WHERE template_key = 'homepage';

  INSERT INTO public.theme_publications (template_key, published_version_id, updated_at, updated_by)
  VALUES ('homepage', v_target, now(), v_actor)
  ON CONFLICT (template_key) DO UPDATE
    SET published_version_id = EXCLUDED.published_version_id,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by;

  INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, after)
  VALUES (
    v_actor,
    'theme.homepage.rollback',
    'theme_publications',
    'homepage',
    jsonb_build_object('published_version_id', v_target, 'previous_version_id', v_prev)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'published_version_id', v_target,
    'previous_version_id', v_prev
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rollback_homepage_theme(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rollback_homepage_theme(jsonb) TO service_role;

-- ── Atomic product variant matrix sync ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_product_variants(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF NOT EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = v_product_id AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(v_variants) <> 'array' OR jsonb_array_length(v_variants) < 1 THEN
    RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001', MESSAGE = 'at least one variant required';
  END IF;

  IF jsonb_array_length(v_variants) > 250 THEN
    RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001', MESSAGE = 'max 250 variants';
  END IF;

  -- Reject duplicate option combinations in the payload
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_variants)
  LOOP
    v_opts := COALESCE(v_row->'option_values', '{}'::jsonb);
    v_key := v_opts::text;
    IF v_key = ANY (v_keys) THEN
      RAISE EXCEPTION 'duplicate_options' USING ERRCODE = 'P0001', MESSAGE = 'duplicate option combination in payload';
    END IF;
    v_keys := array_append(v_keys, v_key);
  END LOOP;

  -- Lock product row for the duration of the sync
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

  -- Phase 1: bump positions out of the way to avoid unique collisions
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

    IF v_price IS NULL OR v_price < 0 THEN
      RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001', MESSAGE = 'invalid price_paisa';
    END IF;
    IF v_mode NOT IN ('tracked', 'untracked') THEN
      RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001', MESSAGE = 'invalid inventory_mode';
    END IF;
    IF v_mode = 'untracked' THEN
      v_qty := NULL;
    ELSIF v_qty IS NULL THEN
      v_qty := 0;
    END IF;

    v_existing := NULL;
    IF v_id IS NOT NULL THEN
      SELECT id INTO v_existing
      FROM public.product_variants
      WHERE id = v_id AND product_id = v_product_id;
      IF v_existing IS NULL THEN
        RAISE EXCEPTION 'cross_product_variant' USING ERRCODE = 'P0001', MESSAGE = 'variant id does not belong to product';
      END IF;
    ELSE
      SELECT id INTO v_existing
      FROM public.product_variants
      WHERE product_id = v_product_id
        AND option_values = v_opts
      LIMIT 1;
      IF v_existing IS NULL AND v_sku IS NOT NULL THEN
        SELECT id INTO v_existing
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
        updated_at = now()
      WHERE id = v_existing;
      v_kept := array_append(v_kept, v_existing);
      v_updated := v_updated + 1;
    ELSE
      INSERT INTO public.product_variants (
        product_id, title, sku, barcode, price_paisa, compare_at_paisa,
        inventory_mode, quantity_on_hand, purchasable, option_values, position
      ) VALUES (
        v_product_id, v_title, v_sku, v_barcode, v_price, v_compare,
        v_mode::public.inventory_mode, v_qty, v_purchasable, v_opts, v_pos
      )
      RETURNING id INTO v_existing;
      v_kept := array_append(v_kept, v_existing);
      v_created := v_created + 1;
    END IF;
  END LOOP;

  IF v_remove_missing THEN
    FOR v_ex IN
      SELECT id FROM public.product_variants
      WHERE product_id = v_product_id
        AND NOT (id = ANY (v_kept))
    LOOP
      SELECT count(*) INTO v_order_count
      FROM public.order_items
      WHERE variant_id = v_ex.id;

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
    v_actor,
    'products.variants.sync',
    'products',
    v_product_id::text,
    jsonb_build_object(
      'created', v_created,
      'updated', v_updated,
      'disabled', v_disabled,
      'deleted', v_deleted,
      'option_names', to_jsonb(v_option_names)
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'created', v_created,
    'updated', v_updated,
    'disabled', v_disabled,
    'deleted', v_deleted,
    'kept_ids', to_jsonb(v_kept)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_product_variants(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_product_variants(jsonb) TO service_role;
