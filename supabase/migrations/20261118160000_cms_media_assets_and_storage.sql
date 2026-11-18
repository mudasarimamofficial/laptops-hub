-- CMS media library: public read bucket + metadata table for merchant uploads.
-- Service-role API writes objects; anon/authenticated may read public URLs.
-- Rollback: drop policies/table/bucket (destructive to uploaded objects).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cms-media',
  'cms-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.cms_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  public_url text NOT NULL,
  alt text NOT NULL DEFAULT '',
  mime_type text,
  byte_size integer,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cms_media_assets_created_at_idx
  ON public.cms_media_assets (created_at DESC);

COMMENT ON TABLE public.cms_media_assets IS
  'Merchant-uploaded CMS images (blog covers, etc.). Stored in storage bucket cms-media.';

ALTER TABLE public.cms_media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cms_media_assets_public_select ON public.cms_media_assets;
CREATE POLICY cms_media_assets_public_select ON public.cms_media_assets
  FOR SELECT TO anon, authenticated
  USING (true);

-- Public read of storage objects in cms-media (writes via service role only).
DROP POLICY IF EXISTS cms_media_public_read ON storage.objects;
CREATE POLICY cms_media_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'cms-media');
