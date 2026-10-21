-- Seed published collections for merchant-manageable catalog navigation.
-- Rules are advisory metadata; storefront matchers still apply until manual pins exist.
-- Durable rate-limit buckets for serverless (shared via Postgres).

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  window_starts_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: service role only.

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_start timestamptz;
  v_now timestamptz := now();
BEGIN
  IF p_limit <= 0 OR p_window_seconds <= 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limit_buckets (bucket_key, count, window_starts_at, updated_at)
  VALUES (p_key, 1, v_now, v_now)
  ON CONFLICT (bucket_key) DO UPDATE
  SET
    count = CASE
      WHEN public.rate_limit_buckets.window_starts_at + make_interval(secs => p_window_seconds) <= v_now
        THEN 1
      ELSE public.rate_limit_buckets.count + 1
    END,
    window_starts_at = CASE
      WHEN public.rate_limit_buckets.window_starts_at + make_interval(secs => p_window_seconds) <= v_now
        THEN v_now
      ELSE public.rate_limit_buckets.window_starts_at
    END,
    updated_at = v_now
  RETURNING count, window_starts_at INTO v_count, v_start;

  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;

INSERT INTO public.collections (slug, title, description, rule, sort_order, featured, published)
VALUES
  ('laptops', 'Laptops', 'Notebooks including business, gaming, MacBook and Chromebook computers.', '{"kind":"matcher","id":"laptops"}'::jsonb, 10, true, true),
  ('gaming-laptops', 'Gaming laptops', 'Machines tagged or typed for gaming.', '{"kind":"matcher","id":"gaming-laptops"}'::jsonb, 20, false, true),
  ('macbooks', 'MacBooks', 'Apple MacBook computers.', '{"kind":"matcher","id":"macbooks"}'::jsonb, 30, false, true),
  ('chromebooks', 'Chromebooks', 'Chromebook computers only.', '{"kind":"matcher","id":"chromebooks"}'::jsonb, 40, false, true),
  ('tablets', 'Tablets', 'Tablets and smart devices.', '{"kind":"matcher","id":"tablets"}'::jsonb, 50, false, true),
  ('accessories', 'Accessories', 'Chargers, docks, peripherals and other accessories.', '{"kind":"matcher","id":"accessories"}'::jsonb, 60, true, true),
  ('chargers', 'Chargers & adapters', 'Power adapters and chargers.', '{"kind":"matcher","id":"chargers"}'::jsonb, 70, false, true),
  ('workstations', 'Workstations', 'Precision, ZBook and similar workstation lines.', '{"kind":"matcher","id":"workstations"}'::jsonb, 80, false, true),
  ('dell', 'Dell', 'Dell notebooks and devices.', '{"kind":"matcher","id":"dell"}'::jsonb, 90, false, true),
  ('hp', 'HP', 'HP notebooks and devices.', '{"kind":"matcher","id":"hp"}'::jsonb, 100, false, true),
  ('lenovo', 'Lenovo', 'Lenovo notebooks and devices.', '{"kind":"matcher","id":"lenovo"}'::jsonb, 110, false, true),
  ('apple', 'Apple', 'Apple products.', '{"kind":"matcher","id":"apple"}'::jsonb, 120, false, true),
  ('microsoft', 'Microsoft', 'Surface and Microsoft devices.', '{"kind":"matcher","id":"microsoft"}'::jsonb, 130, false, true),
  ('under-40k', 'Under Rs 40,000', 'Computers and tablets under Rs 40,000.', '{"kind":"matcher","id":"under-40k"}'::jsonb, 200, false, true),
  ('40k-60k', 'Rs 40,000 – 60,000', 'Mid-range computers and tablets.', '{"kind":"matcher","id":"40k-60k"}'::jsonb, 210, false, true),
  ('over-60k', 'Over Rs 60,000', 'Higher-spec computers and tablets.', '{"kind":"matcher","id":"over-60k"}'::jsonb, 220, false, true)
ON CONFLICT (slug) DO UPDATE
SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  rule = EXCLUDED.rule,
  sort_order = EXCLUDED.sort_order,
  featured = EXCLUDED.featured,
  published = EXCLUDED.published,
  updated_at = now();
