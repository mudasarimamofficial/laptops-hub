# 26 — G22 (and G19) production migration plan

**Status: PREPARED — NOT APPLIED TO PRODUCTION. Each migration needs the owner's explicit approval in chat.**
Merging the code is separate from running the database change (same pattern as LH-025, doc 24). The merged code is
built to work **before** the database change: verified locally by hiding the new table and function (§G22-4).

---

## G22 — COD collection financial safety

Migration: `supabase/migrations/20261126140000_cod_collection_adjustments.sql`

### G22-1. What it changes

| # | Change | Kind |
|---|---|---|
| 1 | New table `cod_collection_adjustments` (append-only ledger: reversal / correction, signed amount, reason 5–500 chars, staff, time, idempotency key, before/after collected) | additive |
| 2 | RLS on, no policies; `anon`/`authenticated` nothing; `service_role` SELECT + INSERT only | additive |
| 3 | Trigger `cod_ledger_append_only` on `cod_collections` and the new table: UPDATE refused; DELETE refused unless the order itself is being deleted | new guard on an existing table |
| 4 | `REVOKE TRUNCATE ON cod_collections FROM service_role` (and public/anon/authenticated): TRUNCATE skips row triggers | grant change on an existing table |
| 5 | `record_cod_collection(jsonb)` replaced: identical to 20261023150000 plus `order_closed` for cancelled/returned orders | function replace, same signature and grants |
| 6 | New `adjust_cod_collection(jsonb)`: owner/admin/manager, server-only, row lock, idempotent, keeps 0 ≤ collected ≤ total due, writes ledger + `order_events` + `audit_logs`; collected back to 0 → `refunded_or_adjusted` | additive |

**Not changed:** order totals, subtotal, shipping, COD fee, discount (5% campaign), `create_cod_order`, checkout,
existing rows. No data is migrated.

### G22-2. Production facts (read-only, 2026-11-26)

| Fact | Value |
|---|---|
| Orders | 1 (`placed`, `unpaid_cod`, collected 0) |
| `cod_collections` rows | 0 |
| `cod_collection_adjustments` / `adjust_cod_collection` | absent |
| Triggers on `cod_collections` | 0 |
| `service_role` on `cod_collections` | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| `record_cod_collection` definition md5 | `6c6ca2e59c0db85749b296725e7d9cc5` = exactly the 20261023150000 version (checked locally) |
| Migration ledger | 43/43 aligned (doc 24 §10); this would be the 44th |

### G22-3. Evidence (local isolated stack)

| Test | Result |
|---|---|
| `scripts/db-tests/cod-adjustments-matrix.sql` (rolled back) | **41/41** — roles, reasons, idempotent replay/conflict, double reversal, bounds, `refunded_or_adjusted`, ledger arithmetic, events, audit, totals unchanged incl. a 5%-discount order, append-only UPDATE/DELETE, grants incl. TRUNCATE, Data-API refusal, order delete cascade |
| `scripts/db-tests/shipping-cod-matrix.sql` | 37/37 (test now pauses campaigns inside its rolled-back transaction; it predated the 5% campaign) |
| `scripts/db-tests/reels-reviews-matrix.sql` | 15/15 |
| `tests/e2e-isolated/p1-cod-ledger-g22.spec.ts` | 3/3 — UI collect with its own note, reverse, correct, reload; API replay/conflict/bounds/reason; fulfillment 403; cancelled order refuses cash (UI + API) |
| Order/admin regression (owner acceptance 36 steps, variant order journey, backup/COD gate, isolation/checkout gates, launch journey, prehydration, admin mobile matrix) | 54/54 after updating the acceptance spec to the G13 media form |
| Migration re-applied twice locally | idempotent |

### G22-4. Code behaviour before the migration (what production runs after the merge)

- Collection route refuses cancelled/returned orders itself (409 `order_closed`) — **active immediately**.
- Collection form has its own note (no longer reuses the fulfilment note).
- Cash history shows collections with staff and time; reversal/correction controls are replaced by
  "available after the pending database update".
- `POST /api/admin/cod-collections/adjust` answers 503 `not_available`.
- Verified locally with the table and function renamed away: page OK, adjust 503, normal collection 200.

### G22-5. Execution steps (only after approval)

1. `npx supabase migration list --linked` → exactly one pending: `20261126140000`. If anything else is pending, stop.
2. Pre-checks (read-only): the md5 above unchanged; `to_regclass('public.cod_collection_adjustments')` is null;
   `cod_collections` row count recorded.
3. `npx supabase db push --linked` (applies only that file).
4. Post-checks (read-only):
   - table, 3 indexes, 2 triggers present;
   - `has_function_privilege('anon'|'authenticated', 'public.adjust_cod_collection(jsonb)', 'EXECUTE')` = false;
   - `has_table_privilege('service_role', 'public.cod_collections', 'TRUNCATE')` = false;
   - `has_table_privilege('service_role', 'public.cod_collection_adjustments', 'UPDATE')` = false;
   - order count and totals unchanged.
5. Admin smoke (read-only): open the existing order page; "Cash history" shows the correction form for the owner.
   **No real or fake collection, reversal or correction is recorded in production.**
6. Record the execution in this document.

### G22-6. Rollback

Safe while the ledger is empty; if any adjustment exists, keep the table (it is the financial record) and only roll back
the function changes.

```sql
DROP TRIGGER IF EXISTS cod_collections_append_only ON public.cod_collections;
DROP TRIGGER IF EXISTS cod_collection_adjustments_append_only ON public.cod_collection_adjustments;
DROP FUNCTION IF EXISTS public.adjust_cod_collection(jsonb);
DROP TABLE IF EXISTS public.cod_collection_adjustments;      -- only if it has 0 rows
DROP FUNCTION IF EXISTS public.cod_ledger_append_only();
GRANT TRUNCATE ON TABLE public.cod_collections TO service_role;
-- then re-run the record_cod_collection definition from 20261023150000_cod_collection_idempotency_conflict.sql
```

followed by `npx supabase migration repair --linked --status reverted 20261126140000`. The merged code keeps working
(it falls back to the pre-migration behaviour in G22-4).

### G22-7. Decision needed

`G22-DB`: approve applying `20261126140000` to production as in G22-5.

**Approved by the owner on 2026-11-26 ("Yes, apply G22") and executed. See G22-8.**

### G22-8. Execution record (2026-11-26 08:20 UTC)

| Step | Result |
|---|---|
| 1. `migration list --linked` | exactly one pending: `20261126140000`; no remote-only rows |
| 2. Pre-checks (read-only) | `record_cod_collection` md5 `6c6ca2e59c0db85749b296725e7d9cc5` (unchanged); `cod_collection_adjustments` absent; `cod_collections` 0 rows, 0 triggers; `service_role` TRUNCATE = true; 1 order `LH-261118-77C0F6` (placed, unpaid_cod, total 18,141,000 paisa = subtotal 18,100,000 + shipping 36,000 + COD fee 5,000, collected 0); `db push --dry-run` listed only this file |
| 3. `db push --linked` | applied. The CLI (v2.108.0) printed an error from its own post-push helper (`pg-delta`: a missing local CA certificate file) after the migration ran; the ledger and objects below confirm the migration itself completed. |
| 4. Post-checks (read-only) | ledger row `20261126140000` present (44/44 aligned); table present with RLS on; 4 indexes (pkey + collection_id, order_id, idempotency unique); triggers `cod_collections_append_only` and `cod_collection_adjustments_append_only`; `adjust_cod_collection` EXECUTE for anon/authenticated = false; anon SELECT on the new table = false; `service_role` TRUNCATE on `cod_collections` = false; `service_role` UPDATE on the new table = false (INSERT = true); 0 adjustment rows, 0 collection rows; the order row is **identical** to the pre-check. `record_cod_collection` and `adjust_cod_collection` bodies are identical to the locally rehearsed versions (compared ignoring blank lines; the raw md5 differs only by output whitespace). PostgREST auto-reload event triggers (`pgrst_ddl_watch`, `pgrst_drop_watch`) are enabled, so the API sees the new table. |
| 5. Smoke (read-only) | `/`, `/cart`, `/collections/dell`, a product page and `/sitemap.xml` 200; homepage still shows the 5% campaign; anonymous `POST /api/admin/cod-collections/adjust` → 401. **No collection, reversal or correction was recorded.** The owner should open the order page once while signed in and confirm the "Cash history" section shows the correction controls (engineering does not sign in with the owner's account). |

Rollback: G22-6 (still safe: the adjustment ledger is empty).

---

## G19 — content pages: history, restore, SEO, create, address change

Migration: `supabase/migrations/20261126160000_content_page_revisions.sql` · Code: PR on branch
`feat/g19-content-revisions-2026-11-26`.

**Order matters, opposite to G22:** the migration is backward compatible with the code now in production, but the
G19 code needs the migration (saving pages goes through the new database function). So: **apply the migration first,
then merge the G19 PR.** Until then, keep the PR unmerged.

### G19-1. What it changes

| # | Change | Kind |
|---|---|---|
| 1 | `content_pages` + `seo_title`, `seo_description` (≤120/≤320), `version` (default 1), `created_at`, `published_at` | additive columns, defaults only; no existing value changed |
| 2 | `GRANT SELECT (seo_title, seo_description) ON content_pages TO anon, authenticated` (the table uses column-level grants; the other new columns stay staff-only) | grant |
| 3 | New `content_page_revisions` (append-only: UPDATE/DELETE refused; `service_role` SELECT + INSERT only; no public access) | additive |
| 4 | **Backfill:** one `baseline` revision per existing page = its exact current title, body, status and legal approval | insert into the new table only |
| 5 | New `content_slug_redirects` (public read, staff write) | additive |
| 6 | New `save_content_page(jsonb)` / `create_content_page(jsonb)`: server-only, staff roles, row lock, version check, legal gate (published policy needs approval; only owner/admin/manager approve; editors never publish policies), policy addresses locked, revision + audit on every save | additive |

**Not changed:** existing page text, status or approvals; the public RLS policy `pages_public_select` (legal gate);
blog/articles; checkout. Pages that have history cannot be hard-deleted (by design).

### G19-2. Production facts (read-only, 2026-11-26)

13 pages; none of the new tables, columns or functions exist. Body fingerprints (md5) to verify the baseline after
the migration:

| Page | Status | Legal approved | Body length | md5(body_html) |
|---|---|---|---|---|
| privacy | published | yes | 1763 | `c45f8472d8b556866d57bf7cffcc3594` |
| returns | published | yes | 1640 | `b953dab28f702b44bf514adaacd95dd8` |
| shipping | published | yes | 1880 | `2df15dc8110ee763840beb050a8df768` |
| terms | published | yes | 1949 | `f99c70fbef1afd6c10ff3afdb5fb852c` |
| warranty | published | yes | 1564 | `a749207576f23ec09540d369a7e1ae77` |
| about | published | — | 591 | `977b8723831c267e1530c2dd73da25ae` |
| contact | published | — | 373 | `3b8ed8fe577361341a1465d50a8f52f0` |
| faq | published | — | 708 | `a245ced92b712efe2adef66016dfb154` |
| comparison-guide, condition-guide, how-to-choose, order-inquiries, why-laptops-hub | pending | — | 0 | (empty) |

### G19-3. Evidence (local isolated stack)

| Test | Result |
|---|---|
| `scripts/db-tests/content-revisions-matrix.sql` (rolled back) | **33/33** — first revision per page, create/slug rules, save + SEO, stale version, publish, two renames with redirect chain, taken/policy slugs refused, unpublish, restore as a new version, staff on every revision, legal gate (editor publish/approve refused, approval required, approver stamped), policy address locked, append-only, page delete blocked, grants, Data-API refusal, public policy unchanged |
| `tests/e2e-isolated/p1-content-revisions-g19.spec.ts` | 3/3 — create (bad address refused), write, search fields, publish → page, `<title>`, description, canonical, sitemap; address change → 308 + sitemap; compare; restore; stale save 409; editor/fulfillment limits; policy addresses locked |
| Old code against the migrated database (content pages, SEO, reels/blog, backup/restore) | 21/21 — proves "migration first" is safe |
| New code regression (content pages, SEO, blog, prehydration, backup/COD gate, owner acceptance 36 steps, admin mobile matrix, launch journey) | 54/54 |
| `scripts/security-role-http-isolated.mjs` | 126/126 (helper now sends the page version) |
| `scripts/test-cms-publish-stress.mjs` (20 cycles × 3) | 120/120 consistent views |
| Migration applied 3× locally | idempotent |

### G19-4. Execution steps (only after approval)

1. `npx supabase migration list --linked` → pending must be exactly `20261126160000` (G22 `20261126140000` either
   already applied or explicitly approved in the same session). Otherwise stop.
2. Pre-check (read-only): the md5 table above unchanged; the new objects absent.
3. `npx supabase db push --linked`.
4. Post-checks (read-only):
   - 13 `baseline` revisions; for each page, the baseline md5 equals the table above;
   - `has_table_privilege('anon', 'public.content_page_revisions', 'SELECT')` = false;
   - anon can select `seo_title` but not `version`;
   - the five policies are still public (`/pages/privacy` etc. answer 200 with unchanged text), and the pending pages
     still answer 404.
5. Merge the G19 PR (CI green), wait for the deploy, and run a read-only smoke: the admin content page shows
   "version 1" and "Show history"; the public pages are unchanged. **No page is edited in production as a test.**
6. Record the execution here.

### G19-5. Rollback

Before the code is merged: drop the new objects (data in the new tables is history only).

```sql
DROP FUNCTION IF EXISTS public.save_content_page(jsonb);
DROP FUNCTION IF EXISTS public.create_content_page(jsonb);
DROP TABLE IF EXISTS public.content_slug_redirects;
DROP TABLE IF EXISTS public.content_page_revisions;   -- triggers go with it
DROP FUNCTION IF EXISTS public.content_revisions_append_only();
REVOKE SELECT (seo_title, seo_description) ON public.content_pages FROM anon, authenticated;
ALTER TABLE public.content_pages DROP CONSTRAINT IF EXISTS content_pages_seo_lengths,
  DROP COLUMN IF EXISTS seo_title, DROP COLUMN IF EXISTS seo_description, DROP COLUMN IF EXISTS version,
  DROP COLUMN IF EXISTS created_at, DROP COLUMN IF EXISTS published_at;
```

then `npx supabase migration repair --linked --status reverted 20261126160000`. After the code is merged, revert the
PR first (the old code works with or without the migration), then roll back if still needed. Once merchants have
saved pages with history, prefer keeping the tables: the revisions are the only record of earlier wording.

### G19-6. Decision needed

`G19-DB`: approve applying `20261126160000` to production as in G19-4, then merging the G19 PR.
