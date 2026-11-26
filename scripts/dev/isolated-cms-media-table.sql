-- LOCAL ISOLATED STACK ONLY. The isolated Supabase runs without the Storage API (docs/ISOLATED_TESTS.md), so
-- migration 20261118160000 cannot create its storage bucket/policies and public.cms_media_assets is missing locally.
-- This creates just the table, exactly as in that migration (production parity verified 2026-11-26, doc 24 §1).
-- Idempotent. Never run against production (production already has it).
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

REVOKE ALL ON public.cms_media_assets FROM anon, authenticated;  -- production grants service_role only
GRANT ALL ON public.cms_media_assets TO service_role;
