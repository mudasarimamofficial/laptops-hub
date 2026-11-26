-- G19: content pages — revision history, restore, SEO fields, create, slug change with redirects
-- (docs/client-ownership-handover/26_G19_G22_PRODUCTION_MIGRATION_PLAN.md).
--
-- 1. content_pages gains seo_title, seo_description, version (optimistic concurrency), created_at, published_at.
-- 2. content_page_revisions: append-only snapshot of every saved state (title, body, status, legal approval, SEO,
--    slug), with staff, time, action and note. Backfilled with one "baseline" revision per existing page, so the
--    current wording of every page (including the published, legally approved policies) is preserved before any
--    later edit. Existing content_pages rows are NOT modified (new columns take defaults only).
-- 3. content_slug_redirects: old slug → new slug, readable by the public storefront (308 redirect).
-- 4. save_content_page(jsonb) and create_content_page(jsonb): server-only, staff-checked, row-locked; legal pages keep
--    their gate (published needs legal approval; only owner/admin/manager approve; editors never publish them) and
--    can never be renamed, nor can any page take a legal slug.
--
-- Backward compatible: the current admin code (direct UPDATE of content_pages) keeps working after this migration.
-- Rollback: see the plan document §G19-rollback.

-- ── 1. columns ──────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.content_pages
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.content_pages ADD CONSTRAINT content_pages_seo_lengths
    CHECK (char_length(coalesce(seo_title, '')) <= 120 AND char_length(coalesce(seo_description, '')) <= 320);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The storefront reads published pages with the anon key through column-level grants: add the two public search
-- fields only (version, created_at and published_at stay staff-only).
GRANT SELECT (seo_title, seo_description) ON public.content_pages TO anon, authenticated;

-- ── 2. revisions ────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_page_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.content_pages(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version >= 1),
  action text NOT NULL CHECK (action IN ('baseline', 'create', 'save', 'publish', 'unpublish', 'restore', 'rename')),
  slug text NOT NULL,
  title text NOT NULL,
  body_html text NOT NULL,
  status text NOT NULL,
  legal_approved boolean NOT NULL,
  seo_title text,
  seo_description text,
  saved_by uuid,
  saved_at timestamptz NOT NULL DEFAULT now(),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  restored_from integer,
  UNIQUE (page_id, version)
);
CREATE INDEX IF NOT EXISTS content_page_revisions_page_idx ON public.content_page_revisions (page_id, version DESC);

ALTER TABLE public.content_page_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.content_page_revisions FROM public, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.content_page_revisions TO service_role;

CREATE OR REPLACE FUNCTION public.content_revisions_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'revisions_append_only' USING ERRCODE = 'P0001';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.content_revisions_append_only() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS content_page_revisions_append_only ON public.content_page_revisions;
CREATE TRIGGER content_page_revisions_append_only
  BEFORE UPDATE OR DELETE ON public.content_page_revisions
  FOR EACH ROW EXECUTE FUNCTION public.content_revisions_append_only();

-- Baseline: the state of every existing page when history is switched on (idempotent).
INSERT INTO public.content_page_revisions (page_id, version, action, slug, title, body_html, status, legal_approved,
                                           seo_title, seo_description, saved_by, saved_at, note)
SELECT p.id, p.version, 'baseline', p.slug, p.title, p.body_html, p.status, p.legal_approved, p.seo_title,
       p.seo_description, NULL, now(), 'State when revision history was switched on'
FROM public.content_pages p
WHERE NOT EXISTS (SELECT 1 FROM public.content_page_revisions r WHERE r.page_id = p.id);

-- ── 3. redirects ────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_slug_redirects (
  from_slug text PRIMARY KEY CHECK (from_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  to_slug text NOT NULL CHECK (to_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND to_slug <> from_slug),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.content_slug_redirects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_slug_redirects_public_select ON public.content_slug_redirects;
CREATE POLICY content_slug_redirects_public_select ON public.content_slug_redirects
  FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON TABLE public.content_slug_redirects FROM public, anon, authenticated;
GRANT SELECT ON TABLE public.content_slug_redirects TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_slug_redirects TO service_role;

-- ── 4. save / create ────────────────────────────────────────────────────────────────────────────────────────────
-- payload: actor_user_id, slug, expected_version, title, body_html, status, seo_title, seo_description,
--          legal_approved (optional boolean), new_slug (optional), action ('save' | 'restore'), restored_from, note
CREATE OR REPLACE FUNCTION public.save_content_page(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := (payload->>'actor_user_id')::uuid;
  v_slug text := trim(payload->>'slug');
  v_expected integer := (payload->>'expected_version')::integer;
  v_title text := btrim(coalesce(payload->>'title', ''));
  v_body text := coalesce(payload->>'body_html', '');
  v_status text := trim(payload->>'status');
  v_seo_title text := nullif(btrim(coalesce(payload->>'seo_title', '')), '');
  v_seo_desc text := nullif(btrim(coalesce(payload->>'seo_description', '')), '');
  v_new_slug text := nullif(trim(coalesce(payload->>'new_slug', '')), '');
  v_action text := coalesce(nullif(trim(payload->>'action'), ''), 'save');
  v_restored_from integer := nullif(trim(coalesce(payload->>'restored_from', '')), '')::integer;
  v_note text := left(btrim(coalesce(payload->>'note', '')), 500);
  v_legal_in boolean := CASE WHEN payload ? 'legal_approved' AND jsonb_typeof(payload->'legal_approved') = 'boolean'
                             THEN (payload->>'legal_approved')::boolean END;
  v_role text;
  v_page public.content_pages%ROWTYPE;
  v_legal_slugs text[] := ARRAY['shipping', 'returns', 'warranty', 'privacy', 'terms'];
  v_is_legal boolean;
  v_legal boolean;
  v_stamp boolean;
  v_final_slug text;
  v_version integer;
  v_rev_action text;
BEGIN
  IF coalesce(auth.role(), 'service_role') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;
  IF v_actor IS NULL OR v_slug IS NULL OR v_expected IS NULL OR char_length(v_title) < 2 OR char_length(v_title) > 200
     OR v_status NOT IN ('pending', 'draft', 'published') OR char_length(v_body) > 100000
     OR v_action NOT IN ('save', 'restore') THEN
    RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(coalesce(v_seo_title, '')) > 120 OR char_length(coalesce(v_seo_desc, '')) > 320 THEN
    RAISE EXCEPTION 'seo_too_long' USING ERRCODE = 'P0001';
  END IF;

  SELECT m.role::text INTO v_role FROM public.admin_memberships m
  WHERE m.user_id = v_actor AND m.is_active = true AND m.role IN ('owner', 'admin', 'manager', 'editor');
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_page FROM public.content_pages WHERE slug = v_slug FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_page.version <> v_expected THEN
    RAISE EXCEPTION 'stale_version' USING ERRCODE = 'P0001';
  END IF;

  v_is_legal := v_page.slug = ANY (v_legal_slugs);
  v_legal := v_page.legal_approved;
  v_stamp := false;
  IF v_legal_in IS NOT NULL THEN
    IF v_role NOT IN ('owner', 'admin', 'manager') THEN
      -- Editors may resend the current value (unchanged form field) but never change it.
      IF v_legal_in IS DISTINCT FROM v_page.legal_approved THEN
        RAISE EXCEPTION 'legal_forbidden' USING ERRCODE = 'P0001';
      END IF;
    ELSIF NOT v_is_legal THEN
      IF v_legal_in IS DISTINCT FROM v_page.legal_approved THEN
        RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001';
      END IF;
    ELSE
      -- An approver's decision is recorded with their name and time on every save that states it (as before G19),
      -- so the record shows who last approved the wording now on the page.
      v_legal := v_legal_in;
      v_stamp := true;
    END IF;
  END IF;
  IF v_is_legal AND v_status = 'published' THEN
    IF v_role = 'editor' THEN
      RAISE EXCEPTION 'legal_forbidden' USING ERRCODE = 'P0001';
    END IF;
    IF NOT v_legal THEN
      RAISE EXCEPTION 'legal_approval_required' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_final_slug := v_page.slug;
  IF v_new_slug IS NOT NULL AND v_new_slug <> v_page.slug THEN
    IF v_is_legal OR v_new_slug = ANY (v_legal_slugs) THEN
      RAISE EXCEPTION 'slug_locked' USING ERRCODE = 'P0001';
    END IF;
    IF v_new_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR char_length(v_new_slug) NOT BETWEEN 2 AND 80 THEN
      RAISE EXCEPTION 'slug_invalid' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.content_pages WHERE slug = v_new_slug) THEN
      RAISE EXCEPTION 'slug_taken' USING ERRCODE = 'P0001';
    END IF;
    v_final_slug := v_new_slug;
  END IF;

  v_version := v_page.version + 1;
  v_rev_action := CASE
    WHEN v_action = 'restore' THEN 'restore'
    WHEN v_final_slug <> v_page.slug THEN 'rename'
    WHEN v_status = 'published' AND v_page.status <> 'published' THEN 'publish'
    WHEN v_status <> 'published' AND v_page.status = 'published' THEN 'unpublish'
    ELSE 'save'
  END;

  UPDATE public.content_pages
  SET slug = v_final_slug,
      title = v_title,
      body_html = v_body,
      status = v_status,
      seo_title = v_seo_title,
      seo_description = v_seo_desc,
      legal_approved = v_legal,
      legal_approved_at = CASE WHEN v_stamp THEN CASE WHEN v_legal THEN now() END ELSE v_page.legal_approved_at END,
      legal_approved_by = CASE WHEN v_stamp THEN CASE WHEN v_legal THEN v_actor END ELSE v_page.legal_approved_by END,
      version = v_version,
      published_at = CASE WHEN v_status = 'published' AND v_page.status <> 'published' THEN now() ELSE v_page.published_at END,
      updated_at = now()
  WHERE id = v_page.id;

  IF v_final_slug <> v_page.slug THEN
    DELETE FROM public.content_slug_redirects WHERE from_slug = v_final_slug;
    UPDATE public.content_slug_redirects SET to_slug = v_final_slug WHERE to_slug = v_page.slug;
    INSERT INTO public.content_slug_redirects (from_slug, to_slug, created_by)
    VALUES (v_page.slug, v_final_slug, v_actor)
    ON CONFLICT (from_slug) DO UPDATE SET to_slug = EXCLUDED.to_slug, created_by = EXCLUDED.created_by, created_at = now();
  END IF;

  INSERT INTO public.content_page_revisions (page_id, version, action, slug, title, body_html, status, legal_approved,
                                             seo_title, seo_description, saved_by, note, restored_from)
  VALUES (v_page.id, v_version, v_rev_action, v_final_slug, v_title, v_body, v_status, v_legal, v_seo_title, v_seo_desc,
          v_actor, v_note, CASE WHEN v_action = 'restore' THEN v_restored_from END);

  INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, before, after)
  VALUES (v_actor, 'content.' || v_rev_action, 'content_pages', v_page.id::text,
          jsonb_build_object('slug', v_page.slug, 'title', v_page.title, 'status', v_page.status,
                             'legal_approved', v_page.legal_approved, 'version', v_page.version),
          jsonb_build_object('slug', v_final_slug, 'title', v_title, 'status', v_status, 'legal_approved', v_legal,
                             'version', v_version, 'restored_from', v_restored_from));

  RETURN jsonb_build_object('ok', true, 'slug', v_final_slug, 'version', v_version, 'action', v_rev_action,
                            'status', v_status, 'legal_approved', v_legal);
END;
$$;

-- payload: actor_user_id, slug, title
CREATE OR REPLACE FUNCTION public.create_content_page(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := (payload->>'actor_user_id')::uuid;
  v_slug text := trim(payload->>'slug');
  v_title text := btrim(coalesce(payload->>'title', ''));
  v_id uuid;
BEGIN
  IF coalesce(auth.role(), 'service_role') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;
  IF v_actor IS NULL OR v_slug IS NULL OR char_length(v_title) < 2 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'validation_failed' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_memberships m WHERE m.user_id = v_actor AND m.is_active = true
                 AND m.role IN ('owner', 'admin', 'manager', 'editor')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;
  IF v_slug = ANY (ARRAY['shipping', 'returns', 'warranty', 'privacy', 'terms']) THEN
    RAISE EXCEPTION 'slug_locked' USING ERRCODE = 'P0001';
  END IF;
  IF v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR char_length(v_slug) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'slug_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.content_pages WHERE slug = v_slug) THEN
    RAISE EXCEPTION 'slug_taken' USING ERRCODE = 'P0001';
  END IF;

  -- A new page takes over an address that used to redirect elsewhere.
  DELETE FROM public.content_slug_redirects WHERE from_slug = v_slug;
  INSERT INTO public.content_pages (slug, title, body_html, status, version)
  VALUES (v_slug, v_title, '', 'draft', 1)
  RETURNING id INTO v_id;
  INSERT INTO public.content_page_revisions (page_id, version, action, slug, title, body_html, status, legal_approved, saved_by, note)
  VALUES (v_id, 1, 'create', v_slug, v_title, '', 'draft', false, v_actor, 'Page created');
  INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, after)
  VALUES (v_actor, 'content.create', 'content_pages', v_id::text, jsonb_build_object('slug', v_slug, 'title', v_title));
  RETURN jsonb_build_object('ok', true, 'slug', v_slug, 'version', 1);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_content_page(jsonb), public.create_content_page(jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_content_page(jsonb), public.create_content_page(jsonb) TO service_role;

COMMENT ON TABLE public.content_page_revisions IS
  'G19 append-only history of content pages (baseline at migration, then every save/publish/unpublish/restore/rename).';
COMMENT ON TABLE public.content_slug_redirects IS 'G19 old content-page slug → current slug (storefront 308).';
