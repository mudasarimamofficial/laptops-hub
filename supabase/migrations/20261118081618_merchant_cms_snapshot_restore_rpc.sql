-- Atomic restore for Merchant CMS application snapshots.
-- Scope (explicit): store_settings, articles, reels, store_testimonials, shipping_zones.
-- Does NOT restore products/variants/collections/orders/auth.
--
-- Ledger note: inventory/snapshot DDL already applied remotely as
-- 20261118074859 / 20261118075155 / 20261118075220 (MCP timestamps).
-- This migration is additive only.
--
-- Rollback: DROP FUNCTION public.restore_merchant_cms_snapshot(jsonb, uuid);

CREATE OR REPLACE FUNCTION public.restore_merchant_cms_snapshot(payload jsonb, actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r jsonb;
  n_settings int := 0;
  n_articles int := 0;
  n_reels int := 0;
  n_testimonials int := 0;
  n_zones int := 0;
BEGIN
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_snapshot_payload';
  END IF;

  IF NOT (payload ? 'store_settings' AND payload ? 'articles' AND payload ? 'reels'
          AND payload ? 'store_testimonials' AND payload ? 'shipping_zones') THEN
    RAISE EXCEPTION 'incomplete_snapshot_payload';
  END IF;

  IF jsonb_typeof(payload->'store_settings') <> 'array'
     OR jsonb_array_length(payload->'store_settings') < 1 THEN
    RAISE EXCEPTION 'snapshot_missing_settings';
  END IF;

  IF jsonb_typeof(payload->'shipping_zones') <> 'array'
     OR jsonb_array_length(payload->'shipping_zones') < 1 THEN
    RAISE EXCEPTION 'snapshot_missing_zones';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(payload->'store_settings')
  LOOP
    IF coalesce(r->>'key', '') = '' THEN CONTINUE; END IF;
    INSERT INTO public.store_settings (key, value, updated_at, updated_by)
    VALUES (r->>'key', coalesce(r->'value', '{}'::jsonb), now(), actor)
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = EXCLUDED.updated_at,
          updated_by = EXCLUDED.updated_by;
    n_settings := n_settings + 1;
  END LOOP;

  FOR r IN SELECT * FROM jsonb_array_elements(payload->'articles')
  LOOP
    IF r->>'id' IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.articles (
      id, slug, title, excerpt, body_html, status, published_at, updated_at,
      seo_title, seo_description, og_image_url, cover_image_url, author_name,
      category, tags, scheduled_for, template_key
    ) VALUES (
      (r->>'id')::uuid,
      coalesce(r->>'slug', 'restored-' || substr(r->>'id', 1, 8)),
      coalesce(r->>'title', 'Restored post'),
      coalesce(r->>'excerpt', ''),
      coalesce(r->>'body_html', ''),
      coalesce(r->>'status', 'draft'),
      NULLIF(r->>'published_at', '')::timestamptz,
      now(),
      NULLIF(r->>'seo_title', ''),
      NULLIF(r->>'seo_description', ''),
      NULLIF(r->>'og_image_url', ''),
      NULLIF(r->>'cover_image_url', ''),
      NULLIF(r->>'author_name', ''),
      NULLIF(r->>'category', ''),
      coalesce((SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(r->'tags', '[]'::jsonb)) t(x)), '{}'::text[]),
      NULLIF(r->>'scheduled_for', '')::timestamptz,
      NULLIF(r->>'template_key', '')
    )
    ON CONFLICT (id) DO UPDATE SET
      slug = EXCLUDED.slug,
      title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      body_html = EXCLUDED.body_html,
      status = EXCLUDED.status,
      published_at = EXCLUDED.published_at,
      seo_title = EXCLUDED.seo_title,
      seo_description = EXCLUDED.seo_description,
      og_image_url = EXCLUDED.og_image_url,
      cover_image_url = EXCLUDED.cover_image_url,
      author_name = EXCLUDED.author_name,
      category = EXCLUDED.category,
      tags = EXCLUDED.tags,
      scheduled_for = EXCLUDED.scheduled_for,
      template_key = EXCLUDED.template_key,
      updated_at = now();
    n_articles := n_articles + 1;
  END LOOP;

  FOR r IN SELECT * FROM jsonb_array_elements(payload->'reels')
  LOOP
    IF r->>'id' IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.reels (
      id, title, caption, video_url, poster_url, product_id, rights_status, rights_note,
      status, sort_order, creator_name, creator_consent, tag, updated_at
    ) VALUES (
      (r->>'id')::uuid,
      coalesce(r->>'title', 'Restored reel'),
      coalesce(r->>'caption', ''),
      coalesce(r->>'video_url', 'https://cdn.example.com/awaiting-owned-media.mp4'),
      NULLIF(r->>'poster_url', ''),
      NULLIF(r->>'product_id', '')::uuid,
      coalesce(r->>'rights_status', 'pending'),
      coalesce(r->>'rights_note', ''),
      coalesce(r->>'status', 'draft'),
      coalesce((r->>'sort_order')::int, 0),
      coalesce(r->>'creator_name', ''),
      coalesce((r->>'creator_consent')::boolean, false),
      coalesce(r->>'tag', ''),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      caption = EXCLUDED.caption,
      video_url = EXCLUDED.video_url,
      poster_url = EXCLUDED.poster_url,
      product_id = EXCLUDED.product_id,
      rights_status = EXCLUDED.rights_status,
      rights_note = EXCLUDED.rights_note,
      status = EXCLUDED.status,
      sort_order = EXCLUDED.sort_order,
      creator_name = EXCLUDED.creator_name,
      creator_consent = EXCLUDED.creator_consent,
      tag = EXCLUDED.tag,
      updated_at = now();
    n_reels := n_reels + 1;
  END LOOP;

  FOR r IN SELECT * FROM jsonb_array_elements(payload->'store_testimonials')
  LOOP
    IF r->>'id' IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.store_testimonials (
      id, author_name, rating, body, review_date, source, source_url, avatar_url,
      avatar_permission, consent_confirmed, verification_note, status, show_on_homepage,
      featured, sort_order, updated_at
    ) VALUES (
      (r->>'id')::uuid,
      coalesce(r->>'author_name', 'Customer'),
      NULLIF(r->>'rating', '')::smallint,
      coalesce(r->>'body', ''),
      NULLIF(r->>'review_date', '')::date,
      coalesce(r->>'source', 'manual'),
      NULLIF(r->>'source_url', ''),
      NULLIF(r->>'avatar_url', ''),
      coalesce((r->>'avatar_permission')::boolean, false),
      coalesce((r->>'consent_confirmed')::boolean, false),
      coalesce(r->>'verification_note', ''),
      coalesce(r->>'status', 'draft'),
      coalesce((r->>'show_on_homepage')::boolean, false),
      coalesce((r->>'featured')::boolean, false),
      coalesce((r->>'sort_order')::int, 0),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      author_name = EXCLUDED.author_name,
      rating = EXCLUDED.rating,
      body = EXCLUDED.body,
      review_date = EXCLUDED.review_date,
      source = EXCLUDED.source,
      source_url = EXCLUDED.source_url,
      avatar_url = EXCLUDED.avatar_url,
      avatar_permission = EXCLUDED.avatar_permission,
      consent_confirmed = EXCLUDED.consent_confirmed,
      verification_note = EXCLUDED.verification_note,
      status = EXCLUDED.status,
      show_on_homepage = EXCLUDED.show_on_homepage,
      featured = EXCLUDED.featured,
      sort_order = EXCLUDED.sort_order,
      updated_at = now();
    n_testimonials := n_testimonials + 1;
  END LOOP;

  FOR r IN SELECT * FROM jsonb_array_elements(payload->'shipping_zones')
  LOOP
    IF r->>'id' IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.shipping_zones (
      id, name, provinces, cities, excluded_cities, flat_fee_paisa, cod_fee_paisa,
      free_shipping_min_paisa, is_active, notes, country
    ) VALUES (
      (r->>'id')::uuid,
      coalesce(r->>'name', 'Restored zone'),
      coalesce((SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(r->'provinces', '[]'::jsonb)) t(x)), '{}'::text[]),
      coalesce((SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(r->'cities', '[]'::jsonb)) t(x)), '{}'::text[]),
      coalesce((SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(r->'excluded_cities', '[]'::jsonb)) t(x)), '{}'::text[]),
      coalesce((r->>'flat_fee_paisa')::bigint, 0),
      coalesce((r->>'cod_fee_paisa')::bigint, 0),
      NULLIF(r->>'free_shipping_min_paisa', '')::bigint,
      coalesce((r->>'is_active')::boolean, true),
      coalesce(r->>'notes', ''),
      coalesce(r->>'country', 'PK')
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      provinces = EXCLUDED.provinces,
      cities = EXCLUDED.cities,
      excluded_cities = EXCLUDED.excluded_cities,
      flat_fee_paisa = EXCLUDED.flat_fee_paisa,
      cod_fee_paisa = EXCLUDED.cod_fee_paisa,
      free_shipping_min_paisa = EXCLUDED.free_shipping_min_paisa,
      is_active = EXCLUDED.is_active,
      notes = EXCLUDED.notes,
      country = EXCLUDED.country;
    n_zones := n_zones + 1;
  END LOOP;

  IF n_settings < 1 OR n_zones < 1 THEN
    RAISE EXCEPTION 'restore_incomplete';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'restored', jsonb_build_object(
      'store_settings', n_settings,
      'articles', n_articles,
      'reels', n_reels,
      'store_testimonials', n_testimonials,
      'shipping_zones', n_zones
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_merchant_cms_snapshot(jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_merchant_cms_snapshot(jsonb, uuid) TO service_role;

COMMENT ON FUNCTION public.restore_merchant_cms_snapshot(jsonb, uuid) IS
  'Atomic Merchant CMS restore (settings, articles, reels, testimonials, shipping zones). Not a full PostgreSQL backup. Catalog/orders/auth excluded.';
