-- Theme RLS hardening + draft-save RPC + inventory ledger on variant sync.
-- Idempotent: safe on stacks that already applied 20261025130000 / 140000.
-- LOCAL / isolated until owner approves Production.

-- ── Helpers ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_can_edit_theme_drafts()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_staff_role(ARRAY['owner','admin','editor']::public.staff_role[]);
$$;

REVOKE ALL ON FUNCTION public.staff_can_edit_theme_drafts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_can_edit_theme_drafts() TO authenticated, service_role;

-- Block direct mutation of theme versions; only RPCs that set app.theme_mutation may write
-- (including when the API uses the service_role key).
CREATE OR REPLACE FUNCTION public.theme_versions_immutability_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

DROP TRIGGER IF EXISTS theme_versions_immutability ON public.theme_versions;
CREATE TRIGGER theme_versions_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.theme_versions
  FOR EACH ROW EXECUTE FUNCTION public.theme_versions_immutability_guard();

CREATE OR REPLACE FUNCTION public.theme_publications_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

DROP TRIGGER IF EXISTS theme_publications_guard ON public.theme_publications;
CREATE TRIGGER theme_publications_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.theme_publications
  FOR EACH ROW EXECUTE FUNCTION public.theme_publications_guard();

-- ── Revoke broad authenticated writes; read-only for staff ──────────────────
REVOKE ALL ON public.theme_templates FROM anon, authenticated;
REVOKE ALL ON public.theme_versions FROM anon, authenticated;
REVOKE ALL ON public.theme_publications FROM anon, authenticated;

GRANT SELECT ON public.theme_templates TO authenticated;
GRANT SELECT ON public.theme_versions TO authenticated;
GRANT SELECT ON public.theme_publications TO authenticated;

GRANT ALL ON public.theme_templates TO service_role;
GRANT ALL ON public.theme_versions TO service_role;
GRANT ALL ON public.theme_publications TO service_role;

DROP POLICY IF EXISTS theme_templates_staff ON public.theme_templates;
DROP POLICY IF EXISTS theme_templates_staff_select ON public.theme_templates;
CREATE POLICY theme_templates_staff_select ON public.theme_templates
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS theme_versions_staff ON public.theme_versions;
DROP POLICY IF EXISTS theme_versions_staff_select ON public.theme_versions;
CREATE POLICY theme_versions_staff_select ON public.theme_versions
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS theme_publications_staff ON public.theme_publications;
DROP POLICY IF EXISTS theme_publications_staff_select ON public.theme_publications;
CREATE POLICY theme_publications_staff_select ON public.theme_publications
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- No INSERT/UPDATE/DELETE policies for authenticated on theme_* — drafts/publish via RPCs only.

-- ── Draft save RPC (owner/admin/editor) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_homepage_draft(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.save_homepage_draft(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_homepage_draft(jsonb) TO authenticated, service_role;

-- Harden publish/rollback to set mutation flag + section validation (replace bodies)
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

REVOKE ALL ON FUNCTION public.publish_homepage_theme(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rollback_homepage_theme(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_homepage_theme(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rollback_homepage_theme(jsonb) TO authenticated, service_role;

-- Editors calling publish RPC must still fail role check inside function (owner/admin only).

-- ── Inventory ledger on atomic variant sync (replace function) ──────────────
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

REVOKE ALL ON FUNCTION public.sync_product_variants(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_product_variants(jsonb) TO service_role;
