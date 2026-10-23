# Media inventory and rights

Read-only export of production `product_media`, 2026-10-23. Per-product list: `docs/media-inventory.csv`
(handle, status, image count, approval, host).

| Fact | Value |
|---|---|
| Products | 232 (226 active, 6 draft) |
| Products with images | 228; the 4 without are drafts (`*-crm-*review*` handles) |
| Image records / unique URLs | 964 / 964 |
| Host | **all** `cdn.shopify.com` (Shopify store CDN, outside this app) |
| Approval state | **all 964 `pending`** — none approved |
| Reachability | 948 answered HEAD 200 in a parallel check; the 16 others were network errors, not 404s — a sequential re-check loaded 17 of 21 non-200 HEADs fine via GET and the rest failed with connection resets/timeouts. No missing image was found. |
| V5 hero/story cutouts | not deployed (`V5_CUTOUT_BASE` unset); rights unconfirmed (`docs/MEDIA_RIGHTS_CUTOUTS.md`) |

A filename or folder name (e.g. `approved-assets`) is not evidence of rights. Images loading is not evidence of rights.

## Usage
Product cards, product galleries, compare, cart and the home hero/story fallback use these photos. Restricted
pre-launch mode stops this site from showing or resizing them, but the CDN URLs remain public at Shopify and are
listed by the public catalog API (`docs/PUBLIC_SITE_PLAN.md`).

## Owner decision (blocks launch)
For each source: own photos / supplier photos with permission / manufacturer images under their terms / unknown.
Record the answer per product (or for all) in `product_media.approval` (`approved` / `rejected`) — engineering can
apply a reviewed bulk update once the owner states the rights in writing.

## Replacement workflow (for any photo without rights)
1. Owner supplies replacement photos (own shots of the actual unit are best: they also show condition).
2. Upload to a storage location the store controls (Supabase Storage bucket `product-media`, public read) — requires
   an owner-approved migration/bucket and the `*.supabase.co` image host (already allowed in `next.config.ts`).
3. Replace the `product_media.url` rows for that product (admin tooling or reviewed script), mark `approved`.
4. Until replaced: set the product to `draft` (hidden) rather than showing an unlicensed photo, if the owner prefers.
