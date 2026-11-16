-- Merchant operating system — additive catalog extensions.
-- LOCAL / isolated apply only until owner approves Production.
-- Preserves all existing products, variants, media URLs, orders.

-- Soft-delete + restore window (default archive; hard-delete gated separately)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS option_names text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS template_key text NOT NULL DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS products_deleted_at_idx ON public.products (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_status_updated_idx ON public.products (status, updated_at DESC);

-- Variant merchandising / Shopify CSV parity fields
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS cost_paisa bigint CHECK (cost_paisa IS NULL OR cost_paisa >= 0),
  ADD COLUMN IF NOT EXISTS compare_policy text NOT NULL DEFAULT 'optional',
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0),
  ADD COLUMN IF NOT EXISTS allow_oversell boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weight_grams integer CHECK (weight_grams IS NULL OR weight_grams >= 0),
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 1 CHECK (position >= 1),
  ADD COLUMN IF NOT EXISTS media_id uuid;

CREATE INDEX IF NOT EXISTS product_variants_barcode_idx ON public.product_variants (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_variants_product_position_idx ON public.product_variants (product_id, position);

-- External / Shopify CDN media metadata (URL reference by default — no binary rehost)
ALTER TABLE public.product_media
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'remote'
    CHECK (origin IN ('remote', 'uploaded', 'rehosted', 'source_shopify')),
  ADD COLUMN IF NOT EXISTS source_provider text,
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'unknown'
    CHECK (health_status IN ('unknown', 'ok', 'redirect', 'missing', 'blocked', 'error')),
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS rights_note text;

CREATE INDEX IF NOT EXISTS product_media_variant_idx ON public.product_media (variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_media_health_idx ON public.product_media (health_status);

-- Collection type + SEO (slug remains canonical handle)
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS collection_type text NOT NULL DEFAULT 'manual'
    CHECK (collection_type IN ('manual', 'automated')),
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS template_key text NOT NULL DEFAULT 'collection',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Backfill automated flag from existing non-empty rule objects
UPDATE public.collections
SET collection_type = 'automated'
WHERE collection_type = 'manual'
  AND rule IS NOT NULL
  AND rule <> '{}'::jsonb
  AND jsonb_typeof(rule) = 'object'
  AND (SELECT count(*) FROM jsonb_object_keys(rule)) > 0;

-- Inventory adjustment ledger (tracked variants)
CREATE TABLE IF NOT EXISTS public.inventory_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  quantity_after integer,
  reason text NOT NULL,
  reference_type text,
  reference_id text,
  actor_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_ledger_variant_created_idx
  ON public.inventory_ledger (variant_id, created_at DESC);

ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_ledger_staff_read ON public.inventory_ledger;
CREATE POLICY inventory_ledger_staff_read ON public.inventory_ledger
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_memberships m
      WHERE m.user_id = auth.uid() AND m.is_active = true
    )
  );

-- No direct client writes; service role / RPCs only
REVOKE ALL ON public.inventory_ledger FROM anon, authenticated;
GRANT SELECT ON public.inventory_ledger TO authenticated;
GRANT ALL ON public.inventory_ledger TO service_role;

-- Global inventory default in store_settings (typed via app; key reserved)
INSERT INTO public.store_settings (key, value)
VALUES (
  'inventory_policy',
  '{"default_mode":"untracked","confirm_first_copy":"Availability is confirmed by our team before dispatch.","allow_variant_override":true}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Shopify CSV import job extensions (additive columns on existing import_jobs)
ALTER TABLE public.import_jobs
  ADD COLUMN IF NOT EXISTS profile text NOT NULL DEFAULT 'shopify_csv',
  ADD COLUMN IF NOT EXISTS strategy text,
  ADD COLUMN IF NOT EXISTS source_filename text,
  ADD COLUMN IF NOT EXISTS source_fingerprint text,
  ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS changeset_id uuid,
  ADD COLUMN IF NOT EXISTS error_export jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS import_jobs_created_idx ON public.import_jobs (created_at DESC);

-- Public catalog view: preserve projection; exclude soft-deleted products
CREATE OR REPLACE VIEW public.catalog_products_public
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.handle,
  p.title,
  p.description_safe,
  p.merchant_vendor,
  p.manufacturer,
  p.product_type,
  p.category,
  p.featured,
  p.tags,
  p.specs,
  p.updated_at,
  v.id AS variant_id,
  v.sku,
  v.price_paisa,
  v.compare_at_paisa,
  v.max_per_order
FROM public.products p
JOIN public.product_variants v ON v.product_id = p.id
WHERE p.status = 'active'
  AND p.deleted_at IS NULL
  AND v.purchasable = true
  AND v.price_paisa > 0;

COMMENT ON COLUMN public.products.deleted_at IS 'Soft-delete timestamp; storefront and public views must exclude non-null.';
COMMENT ON COLUMN public.product_media.origin IS 'remote = URL reference (incl. authorized Shopify CDN); uploaded/rehosted = controlled hosting.';
