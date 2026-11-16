# Laptops HUB — Security Review (engineering closeout, 2026-11-16)

Scope: branch `feat/merchant-operating-system`, verified on the **local isolated stack only** (local Supabase from all 28
migrations, app built with `THEME_PUBLISHED_ENABLED=1` on `127.0.0.1:3001`, fake email provider). Production was not
read or changed. Earlier reviews remain valid where not superseded: `SECURITY_P0_REVIEW.md`, `SECURITY_RPC_REVIEW.md`,
`SECURITY_COLUMN_LEVEL_ASSESSMENT.md`, `API_ERROR_SANITIZATION_AUDIT.md`.

## Findings fixed in this pass

| # | Severity | Finding | Fix | Evidence |
|---|---|---|---|---|
| S1 | **High** (pre-existing; also in the production schema) | Any active staff account (incl. fulfillment/editor) could use its own access token against the Data API to write merchant tables directly — prices, stock, shipping fees, `store_settings` (COD switch), legal-page approval, COD cash records, articles — and read every order and address. Cause: `*_staff_all` RLS policies allow `FOR ALL` for `is_staff()` and `authenticated` held table-level write grants. The app's own role checks were bypassed entirely. Latent in production only because a single active owner exists there | Migration 28 `20261117150000_staff_direct_access_least_privilege.sql` revokes direct writes on 21 tables and direct reads on 11 PII/operational tables from anon/authenticated. The app already performs every merchant write and private read with the service role after `requireStaff(roles)` | `scripts/security-direct-staff-access.mjs`: 133/193 before, **193/193** after (8 roles × write attempts with per-attempt restore, private reads, internal columns, positive controls for the public catalog and contact form). `docs/SECURITY_DIRECT_ACCESS_RESULTS.json` |
| S2 | Medium | `product_media` rights/provenance metadata (approval, rights note, source provider, origin, health checks) readable by anonymous visitors | Column-level SELECT (public columns only) in migration 28 | Same script, "internal columns" group |
| S3 | Medium | Grants drift: an earlier session fixed a 500 on the PDP with a manual broad `GRANT SELECT` on the local DB (re-exposing internal columns); not reproducible from migrations | Migration 27 states the column grants explicitly (incl. the variant-picker columns); a fresh `db reset` reproduces the intended state | `has_column_privilege` checks after reset; migration rehearsal: clean == upgrade == local (schema sha256 `66a6e5f7…`, grants identical) |
| S4 | Low | `catalog_products_public` failed with 42501 for anon (filters on `deleted_at`, not granted) | `GRANT SELECT (deleted_at)` (NULL on every publicly visible row) | `sec-auth-matrix` 24/24 (was 23/24), `sec-p0-probe` 9/9 (was 7/9) |
| S5 | Low | COD route could return raw database error text | Stable code → status/message map (`src/lib/commerce/checkout-errors.ts`); unknown errors logged server-side, generic message to the shopper | `p0-variant-order-journey.spec.ts` (forged / sold-out / over-limit / draft variants) |
| S6 | Low | Admin order/product list search interpolated free text into PostgREST `or=(…)` filters (`a,status.eq.draft` changed the filter; `(` or `,` broke the query and the raw DB message was shown) | `adminSearchTerm()` strips list/grouping syntax and LIKE wildcards; generic error text on the orders list | `tests/unit/admin-search-term.test.ts`; `p0-admin-search.spec.ts` (filter-syntax input returns 200 and matches nothing) |
| S7 | Medium (contract) | No way to sign out of the admin | `POST /api/admin/account/sign-out` (form post, works without JS) ends the session server-side and clears cookies; cross-site posts refused | `p0-admin-sign-out.spec.ts`: replayed old cookies are refused; cross-site 403 |

## New public surface added in this pass

| Object | Exposure | Controls |
|---|---|---|
| `storefront_variant_availability(uuid[])` | anon/authenticated EXECUTE | SECURITY DEFINER, `search_path = ''`, returns only `(product_id, variant_id, boolean)` for purchasable variants of active, non-deleted products; first 200 ids only; never quantities. Mirrors `create_cod_order`'s stock rule |
| `GET /api/admin/search` | Staff only (401 anon) | Groups searched only for roles allowed to open that section (products: owner/admin/manager/editor; orders: owner/admin/manager/fulfillment). Returns identifiers and statuses only; a phone number finds orders but is never echoed. Uses the service role after `requireStaff()` |
| `POST /api/admin/account/sign-out` | Any signed-in staff | Same-origin check; no data returned |

## Verified unchanged

- Role HTTP matrix, role matrix, theme RLS matrix, COD concurrency/checkout, inventory ledger suites: see
  `docs/evidence/final-run/summary.json` for this run's exit codes.
- No secrets in tracked files: `.env.local` is git-ignored and holds only local demo keys; dumps (`*.dump`, `*.sql.gz`) are
  now git-ignored too. The four untracked root/agent files were deliberately not committed (public repository).

## Open (owner / production)

1. **Apply migration 28 to production** with the owner's approval — it closes S1, which exists in production today.
   It has no code dependency (see the compatibility matrix).
2. Supabase Auth → leaked-password protection (dashboard toggle).
3. Re-read the production security/performance advisors after migrations (not possible from this machine: CLI not linked).
4. Pre-hydration typing in other *controlled* admin forms: the staff invite form had a real defect (fixed). Probed with
   delayed scripts: admin login and order tracking read the form's values on submit (sign-in after early typing works);
   the checkout fields are not in the server HTML at all (the cart lives in the browser), so they cannot be typed into
   before hydration. Other admin editors were not individually probed (staff-only; their submit buttons stay disabled
   until hydration).
