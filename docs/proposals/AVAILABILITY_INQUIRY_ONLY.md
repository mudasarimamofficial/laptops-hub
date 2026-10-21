# Proposal (NOT APPLIED): inquiry-only availability

Status: **awaiting owner + engineering approval.** This is not a migration file. Do not copy it into `supabase/migrations/` or run `db push` until approved.

## Current behaviour (verified from migrations at `ea652f2`)
- `products_public_select`: anon sees `status = 'active'` rows.
- `variants_public_select`: anon sees a variant only if its product is active **and** `purchasable = true` **and** `price_paisa > 0`.
- `public_catalog_listing`: inner-joins the cheapest purchasable, positive-price variant.
- Import (`scripts/import-catalog.mjs`) set `purchasable = (status = 'active' AND price > 0)` and `inventory_mode = 'untracked'` for every product.

So an active product whose variant is set to `purchasable = false` **disappears** from the public site (404 on the PDP, absent from listings). The app cannot show "Ask about this product" for it today. That is safe (it is never sold), but it is not the V5 behaviour.

The code on `fix/v5-correctness-parity` already handles `available = false` (inquiry button, no cart control). Today every public product arrives with `available = true`, so nothing changes visually until the decision below.

## Owner decision required
1. Should active-but-unavailable products stay visible with an inquiry button (V5), or stay hidden (current)?
2. Who marks a product unavailable (admin role) and on what basis? Stock counts are not used or shown.

## Draft SQL (for review only)
```sql
-- 1. Let the public read non-purchasable variants of ACTIVE products (granted columns only; no quantity_on_hand).
DROP POLICY IF EXISTS variants_public_select ON public.product_variants;
CREATE POLICY variants_public_select ON public.product_variants
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status = 'active')
    AND price_paisa > 0
  );

-- 2. Listing view: prefer a purchasable variant, otherwise expose the product as inquiry-only.
CREATE OR REPLACE VIEW public.public_catalog_listing
WITH (security_invoker = true) AS
SELECT p.id, p.handle, p.title, p.description_safe, p.manufacturer, p.product_type, p.category,
       p.featured, p.tags, p.specs,
       v.id AS variant_id, v.sku, v.price_paisa, v.compare_at_paisa, v.max_per_order,
       v.purchasable AS available
FROM public.products p
INNER JOIN LATERAL (
  SELECT pv.id, pv.sku, pv.price_paisa, pv.compare_at_paisa, pv.max_per_order, pv.purchasable
  FROM public.product_variants pv
  WHERE pv.product_id = p.id AND pv.price_paisa > 0
  ORDER BY pv.purchasable DESC, pv.price_paisa ASC
  LIMIT 1
) v ON true
WHERE p.status = 'active';
```
`create_cod_order` already rejects `NOT purchasable` (`product_not_purchasable`), so checkout stays protected.

## App follow-up after approval
- `mapProduct`: pick a purchasable variant first, else the first positive-price variant; `available = variant.purchasable`.
- `mapListing`: `available: row.available`.
- Run P0 + auth-matrix probes to confirm no new columns are exposed (`quantity_on_hand` stays ungranted).
