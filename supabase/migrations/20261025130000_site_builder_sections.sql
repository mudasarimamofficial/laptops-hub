-- Site / theme section store (draft + published pointers).
-- LOCAL ONLY until owner approves Production apply.
-- Does not change storefront rendering until the app reads published versions.

CREATE TABLE IF NOT EXISTS public.theme_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.theme_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.theme_templates(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'draft',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  theme_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (template_id, label)
);

CREATE TABLE IF NOT EXISTS public.theme_publications (
  template_key text PRIMARY KEY REFERENCES public.theme_templates(key) ON DELETE CASCADE,
  published_version_id uuid NOT NULL REFERENCES public.theme_versions(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS theme_versions_template_status_idx
  ON public.theme_versions (template_id, status);

ALTER TABLE public.theme_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_publications ENABLE ROW LEVEL SECURITY;

-- Staff may SELECT only. Draft save / publish / rollback go through SECURITY DEFINER RPCs
-- (see 20261025140000 + 20261025150000). No authenticated table DML.
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

REVOKE ALL ON public.theme_templates FROM anon, authenticated;
REVOKE ALL ON public.theme_versions FROM anon, authenticated;
REVOKE ALL ON public.theme_publications FROM anon, authenticated;
GRANT SELECT ON public.theme_templates TO authenticated;
GRANT SELECT ON public.theme_versions TO authenticated;
GRANT SELECT ON public.theme_publications TO authenticated;
GRANT ALL ON public.theme_templates TO service_role;
GRANT ALL ON public.theme_versions TO service_role;
GRANT ALL ON public.theme_publications TO service_role;

-- Seed homepage template + V5-default section tree (draft only — not published)
INSERT INTO public.theme_templates (key, title, schema_version)
VALUES ('homepage', 'Homepage', 1)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.theme_versions (template_id, label, status, sections, theme_settings)
SELECT
  t.id,
  'v5-default-draft',
  'draft',
  '[
    {"id":"hero","type":"v5_cinematic_hero","enabled":true,"label":"Cinematic hero","settings":{"productHandles":["dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage","hp-probook-640-g2-core-i5-6th-gen-8gb-ram-256gb-storage","lenovo-thinkpad-t580-core-i5-8th-gen-16gb-ram-512gb-storage"]}},
    {"id":"story","type":"v5_product_story","enabled":true,"label":"Product story","settings":{"productHandle":"dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage"}},
    {"id":"featured","type":"v5_featured_products","enabled":true,"label":"Featured","settings":{}},
    {"id":"brands","type":"v5_brand_grid","enabled":true,"label":"Brands","settings":{}},
    {"id":"budget","type":"v5_budget_bands","enabled":true,"label":"Budget","settings":{}},
    {"id":"specs","type":"v5_spec_filters","enabled":true,"label":"Specs","settings":{}},
    {"id":"newgen","type":"v5_new_gen","enabled":true,"label":"New gen","settings":{}},
    {"id":"chromebook","type":"v5_chromebook","enabled":true,"label":"Chromebook","settings":{}},
    {"id":"compare","type":"v5_compare_demo","enabled":true,"label":"Compare demo","settings":{}},
    {"id":"promo","type":"v5_promo","enabled":true,"label":"Promo","settings":{}},
    {"id":"inquiry","type":"v5_home_inquiry","enabled":true,"label":"Inquiry","settings":{}}
  ]'::jsonb,
  '{"theme":"v5","note":"Seeded from approved V5 composition. Publishing requires owner approval."}'::jsonb
FROM public.theme_templates t
WHERE t.key = 'homepage'
  AND NOT EXISTS (
    SELECT 1 FROM public.theme_versions v
    WHERE v.template_id = t.id AND v.label = 'v5-default-draft'
  );

COMMENT ON TABLE public.theme_versions IS 'Immutable-ish section snapshots; publish via theme_publications pointer switch.';
