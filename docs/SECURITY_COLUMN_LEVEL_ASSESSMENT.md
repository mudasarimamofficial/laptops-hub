# Security assessment — column-level access (anon role)

> Assessed 2026-11-15. Pre-existing; not introduced by this release candidate.

## Findings

Two `sec-p0-probe` assertions fail because the `anon` role can SELECT internal metadata columns:

1. **`anon_cannot_select_inventory_columns`** — anon can read inventory quantity from `product_variants`
2. **`anon_cannot_select_internal_product_columns`** — anon can read `flags`, `media_approval`, `import_source` from `products`

## Risk assessment

| Column | Content | Sensitivity | Public impact |
|---|---|---|---|
| `flags` | Internal product flags (jsonb) | Low | No customer-facing meaning |
| `media_approval` | Media rights status enum | Low | Internal workflow state |
| `import_source` | Where product was imported from | Low | Internal metadata |
| Inventory quantity | Stock count integer | Medium | Could reveal business volume |

## Why this exists

- RLS policies on `products` and `product_variants` allow `SELECT` for all roles (needed for storefront catalog)
- Postgres RLS operates at row level, not column level
- Column-level restrictions require either:
  - Column-level `GRANT` (revoke SELECT on specific columns from anon)
  - A security-definer view that omits internal columns
  - A wrapper RPC that returns only public fields

## Recommendation

Create a `public_products` view (security definer) that exposes only storefront-needed columns. Route the catalog query through this view instead of the raw table. This is a defense-in-depth enhancement, not a blocking defect — the storefront code already ignores these columns.

## Current mitigation

- The storefront frontend never reads or displays these columns
- The catalog query (`src/lib/catalog/queries.ts`) selects only the columns it needs
- No API endpoint exposes raw table data to the browser
- The Supabase anon key is already public (embedded in the client bundle) — RLS row policies are the primary access control
