# External media policy (Shopify CDN & HTTPS refs)

**Status:** Engineering policy — merchant rights confirmation still required.  
**Default behavior:** Store **URL references**, do not bulk-download or rehost.

## Rules

1. **Public URL ≠ permission.** A reachable `cdn.shopify.com` (or other) URL must stay `approval=pending` until the owner confirms ownership, supplier license, or manufacturer authorization.
2. **Do not auto-approve** the existing ~964 catalog images.
3. **Preserve full URLs** including meaningful query strings; do not rewrite Shopify CDN paths.
4. **SSRF guards:** HTTPS only; reject credentials in URL, localhost, and private IP/host ranges (`src/app/api/admin/products/[handle]/media/route.ts`).
5. **Durability:** Remote hosts may delete or restrict files. Admin surfaces should show external dependency; offer replace/rehost only after rights + cost approval.
6. **Shopify re-import:** When exporting for Shopify, Shopify may copy images into its own Files storage. We do not control that.
7. **Next/Image:** Use allowlisted remote patterns already configured for the storefront; avoid proxying arbitrary user URLs.

## Origins (migration)

| origin | Meaning |
|---|---|
| `remote` | HTTPS reference |
| `source_shopify` | Known Shopify CDN host |
| `uploaded` | Merchant upload to controlled storage (future) |
| `rehosted` | Explicitly copied with approval (future) |

## Owner decision required

Confirm whether Laptops HUB is authorized to display the current remote product photographs before marking any media `approved` or enabling Production marketing that depends on those assets.
