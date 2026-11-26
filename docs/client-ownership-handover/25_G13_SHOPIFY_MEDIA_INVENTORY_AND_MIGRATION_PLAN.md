# 25 — G13 Shopify-hosted media: inventory and migration plan

**Status: PLAN ONLY — NOT EXECUTED. Needs explicit owner approval (§7).**
Prepared 2026-11-26 after G13 (PR #89, merge `6f6bee4`, deploy `54JcRUTi…`) shipped the merchant media editor.
No production image was downloaded, copied, replaced, deleted or re-pointed while preparing this plan.

## 1. How the inventory was taken (read-only)

| Source | Method |
|---|---|
| `product_media` (production) | `supabase db query --linked`, SELECT only |
| Other references | one SELECT per `public` table: rows whose text contains `cdn.shopify.com` |
| File facts | one `HEAD` request per URL to `cdn.shopify.com` (4 at a time, 150 ms apart); no image bodies downloaded |
| Code | `grep` for `cdn.shopify.com` in `src`, `data`, `public`, `next.config` |

## 2. Inventory (2026-11-26)

| Fact | Value |
|---|---|
| Image rows | **964**, across **228** products (956 rows on active products, 8 on draft products, 0 on deleted products) |
| Images per product | min 1, median 4, max 22 |
| Host | all `cdn.shopify.com` (store files path `s/files/1/0981/4720/5393/`) |
| Reachable | **964 / 964** answered `200` |
| Type | 851 JPEG, 113 PNG |
| Size | **87.2 MB total**; median 55 KB, p95 211 KB, max 4.4 MB; 7 over 1 MB; none over the 5 MB bucket limit |
| Duplicates | 0 duplicate URLs, 0 duplicate file names, 0 duplicate ETags (no shared files between products) |
| Rights (`approval`) | 964 `pending` (Rights not confirmed) |
| `origin` | 964 `remote` |
| Width/height/content type in DB | not recorded (null on all 964) |
| Primary flag | 0 rows flagged; the storefront uses position 1. G13 sets `is_primary` on the next save for each product. |
| Variant links | 0 variants point at an image (`media_id`) |
| Alt text | 964 are imported placeholders (e.g. "… view 6", "SKU-00209 product image"); the storefront shows its own generated description instead (G13) |

### Other dependencies on the Shopify CDN

| Where | What | Count |
|---|---|---|
| Database | only `product_media` | 964 |
| `src/lib/content/homepage-image-presets.ts` | homepage hero/feature preset images (code, not DB) | 14 URLs |
| `next.config` `images.remotePatterns` | allows `cdn.shopify.com` and `**.myshopify.com` | config |
| `src/lib/catalog/shopify-import-commit.ts` | CSV importer writes Shopify URLs as-is | code path |
| `src/lib/catalog/image-url.ts` | **responsive sizes come from Shopify's CDN** (`?width=84…1280` in every `srcset`); other hosts get no `srcset` (Supabase image transforms are a paid feature) | every storefront image |
| Supabase Storage today | bucket `cms-media` (public, 5 MB, JPEG/PNG/WebP/GIF), 1 object (8 KB); `cms_media_assets` 0 rows | — |

## 3. The risk this plan addresses

The catalog's photos are hot-linked from the old Shopify store's CDN (doc 09 §3). If that Shopify store is closed,
paused or its files deleted, **every product photo and 14 homepage images could disappear at once**. Nothing about
that changes while the Shopify store stays as it is. This is a continuity risk, not a current defect.

## 4. Rights

All 964 images are "Rights not confirmed". Moving a file does not change who owns it. Before or during migration the
owner should confirm, per source, that the business may use them (own photos, supplier/manufacturer images with
permission, etc.). G13 lets the owner record this per image (Admin → Products → Images → Image rights). Images whose
rights cannot be confirmed should be replaced, not copied.

## 5. Cost and quotas (verify in dashboards before approving)

| Item | Estimate | Note |
|---|---|---|
| Supabase Storage used | ~87 MB of the Free plan's 1 GB (doc 09) | leaves room for growth; re-confirm the plan in the dashboard |
| Responsive sizes | **today Shopify resizes for free** (`?width=`); the storefront does not use Next.js image optimisation (verified on the live product page: 0 `/_next/image` requests) | after a plain copy, phones would download full originals (p95 211 KB, max 4.4 MB): a performance regression. Phase 1 therefore stores fixed-width WebP copies (§7) |
| Storage with sized copies | estimate ~150–250 MB (originals + 5–7 widths); **measured in Phase 1 on a 10-product sample before the full run** | still within 1 GB Free storage |
| Supabase egress | storefront image traffic moves from Shopify's CDN to Supabase | sized copies keep bytes per view close to today; **watch the egress meter for the first weeks**; Free-plan egress limit to be re-confirmed in the dashboard |
| Shopify | $0 change | the Shopify store can stay as the fallback until the owner decides |

No paid upgrade is needed for the copy itself. If egress approaches the Free limit, that is an owner decision
(Supabase paid plan or another image host).

## 6. Options

| Option | What happens | Pros | Cons |
|---|---|---|---|
| **A. Keep hot-linking (status quo)** | nothing | $0, no risk of breakage now | all photos depend on the Shopify store staying open |
| **B. Back up only** | copy files to Storage (or client-controlled storage) without re-pointing the site | protects against loss; storefront untouched | storage used; site still depends on Shopify until a later switch |
| **C. Copy and switch (recommended, in phases)** | copy to Storage, verify byte-for-byte, then re-point `product_media.url` in batches | removes the dependency; reversible per batch | needs a production data change (approval), egress moves to Supabase |

## 7. Recommended plan (Option C), for approval

Each phase is a separate approval. Nothing runs until the owner approves that phase in chat.

1. **Phase 0 — rights decision (owner).** Confirm rights for the image sources, or list products whose photos must
   be replaced instead of copied.
2. **Phase 1 — copy (no site change).** A script run by the operator, from a local machine, with a small batch size:
   download each of the 964 files once, upload to `cms-media/catalog/<product-handle>/<position>-<sha256-8>.<ext>`,
   record SHA-256, bytes and dimensions in a manifest (kept in client-controlled storage, not git). Also store
   fixed-width WebP copies next to each original (the widths `image-url.ts` asks for: 84, 168, 320, 480, 640, 800,
   1200/1280), so the storefront keeps phone-sized downloads without paid transforms. Shopify URLs are not touched.
   Re-runnable: skips files already present with the same hash. Run on 10 products first and report real bytes.
3. **Phase 2 — verify.** Every manifest row: Storage object exists, size and SHA-256 match the source, public URL
   answers 200 with the right type.
   **Code PR before Phase 3:** teach `image-url.ts` to build `srcset` from the stored widths for `cms-media/catalog/`
   URLs, with isolated tests and an LCP check against the p0-perf baseline.
4. **Phase 3 — re-point in batches (production data change).** For one batch (e.g. 10 products, then 50, then the
   rest): save a before-image of each `product_media` row (`id, url, origin`), update `url` to the Storage URL and
   `origin` to `uploaded`, fill width/height/content type, then smoke-check those product pages. G13's per-image
   editor keeps working on the new rows.
5. **Phase 4 — homepage presets.** Code PR replacing the 14 preset URLs with copied files (normal PR + tests).
6. **Phase 5 — importer.** Code PR so future Shopify CSV imports copy images into Storage instead of hot-linking.
7. **Keep Shopify** open and its files untouched for at least 30 days after Phase 3; remove `cdn.shopify.com` from
   `remotePatterns` only after that, and only with approval.

## 8. Rollback

| Phase | Rollback |
|---|---|
| 1–2 | delete the copied objects under `cms-media/catalog/`; site unaffected |
| 3 | restore `url`/`origin` from the saved before-image for that batch (single UPDATE from the saved rows); Shopify files are still there |
| 4–5 | revert the PR |

## 9. What this plan will not do

- Not download, replace, delete or migrate anything without approval of the phase.
- Not delete any Shopify file or close the Shopify store.
- Not change alt text, order or primary images (merchant-owned; edited in G13).
- Not commit downloaded images or the manifest to git.

## 10. Decision needed

`G13-M1`: choose A, B or C (and approve Phase 0/1 if C). Recorded in doc 23.
