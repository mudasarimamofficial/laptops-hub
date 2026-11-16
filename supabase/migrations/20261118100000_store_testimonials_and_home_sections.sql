-- 29: Store testimonials (homepage reviews carousel) + two new homepage section types.
--
-- * store_testimonials holds business-level testimonials with explicit provenance:
--     google   — copied from the store's Google Business Profile, with a link to the original review (source_url)
--     website  — submitted to Laptops HUB directly by a customer
--     merchant — supplied to the merchant by the customer (message, call, visit) and entered by staff
--   Publishing requires recorded consent; an avatar requires recorded permission. Nothing here is a "Google rating":
--   the storefront never computes or shows an aggregate from these rows.
-- * Public (anon/authenticated) can read published rows through column grants only — never consent/verification
--   notes or staff ids. There are no direct write grants: staff write through the app's service role after the
--   app's own role checks (same model as migration 28). Every change is written to audit_logs by the app.
-- * save_homepage_draft / publish_homepage_theme accept 'v5_store_reviews' and 'v5_store_map' (bodies otherwise
--   unchanged from 20261025150000, except: RAISE '<code>' USING ..., MESSAGE = ... was itself an error
--   ("RAISE option already specified") that hid the intended code — the detail now goes to DETAIL).
-- Additive: no existing row is changed.

create table if not exists public.store_testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null check (char_length(btrim(author_name)) between 2 and 80),
  rating smallint check (rating is null or rating between 1 and 5),
  body text not null check (char_length(btrim(body)) between 10 and 2000),
  review_date date,
  source text not null check (source in ('google', 'website', 'merchant')),
  source_url text check (source_url is null or (char_length(source_url) <= 1000 and source_url ~* '^https://[^\s<>"'']+$')),
  avatar_url text check (avatar_url is null or (char_length(avatar_url) <= 1000 and avatar_url ~* '^https://[^\s<>"'']+$')),
  avatar_permission boolean not null default false,
  consent_confirmed boolean not null default false,
  verification_note text not null default '' check (char_length(verification_note) <= 1000),
  status text not null default 'draft' check (status in ('draft', 'pending', 'published', 'hidden')),
  show_on_homepage boolean not null default true,
  featured boolean not null default false,
  sort_order integer not null default 0 check (sort_order between -100000 and 100000),
  created_by uuid,
  updated_by uuid,
  approved_by uuid,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_testimonials_publish_needs_consent check (status <> 'published' or consent_confirmed),
  constraint store_testimonials_avatar_needs_permission check (avatar_url is null or avatar_permission),
  constraint store_testimonials_google_needs_link check (
    source <> 'google'
    or (source_url is not null
        and source_url ~* '^https://((www\.)?google\.(com|[a-z]{2})(\.[a-z]{2})?/maps|maps\.google\.(com|[a-z]{2})(\.[a-z]{2})?/|maps\.app\.goo\.gl/|g\.page/)')
  )
);

create index if not exists store_testimonials_public_idx
  on public.store_testimonials (featured desc, sort_order, published_at desc)
  where status = 'published';
create index if not exists store_testimonials_queue_idx on public.store_testimonials (status, updated_at desc);

drop trigger if exists store_testimonials_updated_at on public.store_testimonials;
create trigger store_testimonials_updated_at before update on public.store_testimonials
  for each row execute function public.set_updated_at();

alter table public.store_testimonials enable row level security;

drop policy if exists store_testimonials_public_select on public.store_testimonials;
create policy store_testimonials_public_select on public.store_testimonials
  for select to anon, authenticated
  using (status = 'published');

revoke all on table public.store_testimonials from anon, authenticated;
grant select (id, author_name, rating, body, review_date, source, source_url, avatar_url, status,
              show_on_homepage, featured, sort_order, published_at)
  on table public.store_testimonials to anon, authenticated;
grant all on table public.store_testimonials to service_role;

-- Theme section types: add v5_store_reviews and v5_store_map.

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
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001', DETAIL = 'draft edit requires owner, admin, or editor';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001', DETAIL = 'actor mismatch';
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
      'v5_store_reviews','v5_store_map',
      'rich_text','image_banner'
    ) THEN
      RAISE EXCEPTION 'unsupported_section_type' USING ERRCODE = 'P0001', DETAIL = v_type;
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
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001', DETAIL = 'owner or admin required to publish';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001', DETAIL = 'actor mismatch';
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
      'v5_store_reviews','v5_store_map',
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
