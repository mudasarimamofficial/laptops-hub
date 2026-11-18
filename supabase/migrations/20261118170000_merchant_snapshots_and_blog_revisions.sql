-- Merchant application snapshots (keep 4 valid) + blog article revisions.
-- Additive. Does not dump full Postgres; stores JSONB merchant CMS payloads.
-- Rollback: DROP TABLE public.merchant_snapshots; DROP TABLE public.article_revisions;
-- and drop the new articles SEO columns if unused.

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS template_key text;

CREATE TABLE IF NOT EXISTS public.article_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  status text NOT NULL,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS article_revisions_article_created_idx
  ON public.article_revisions (article_id, created_at DESC);

ALTER TABLE public.article_revisions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.merchant_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT 'Manual backup',
  kind text NOT NULL DEFAULT 'merchant_cms' CHECK (kind IN ('merchant_cms', 'pre_restore')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'valid', 'failed', 'restored')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_bytes integer NOT NULL DEFAULT 0,
  checksum text,
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  verified_at timestamptz,
  notes text
);

CREATE INDEX IF NOT EXISTS merchant_snapshots_valid_created_idx
  ON public.merchant_snapshots (status, created_at DESC);

ALTER TABLE public.merchant_snapshots ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated table grants; staff access via service role only.
REVOKE ALL ON TABLE public.article_revisions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.merchant_snapshots FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.article_revisions TO service_role;
GRANT ALL ON TABLE public.merchant_snapshots TO service_role;

COMMENT ON TABLE public.merchant_snapshots IS
  'Application-level merchant CMS snapshots. Retain at most 4 valid rows after a new valid snapshot verifies. Not a full disaster-recovery dump.';
