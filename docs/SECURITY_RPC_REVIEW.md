# Security review — database functions and Data API privileges (2026-10-23)

Sources: read-only catalog queries on production (`supabase db query --linked`, SELECT only; the CLI provisions its
own temporary login role for these queries), migrations in `supabase/migrations/`, and the app's call sites.

**Update 2026-10-23:** Option A applied with owner approval — anon/authenticated no longer have EXECUTE on
`record_cod_collection`, `transition_order_status`, `consume_rate_limit` (verified; see
`docs/MIGRATION_PRODUCTION_APPROVAL.md`). Findings 3–5 and the in-function guard are still pending (Option B).

**Update 2026-10-23 (later):** Option B applied with owner approval — findings 1–6 are fixed on production (privileges,
schema and functions verified identical to the tested build). Residual: #7 (`supabase_admin` defaults) and the
`storage`-schema defaults of `postgres` (platform default; Storage unused).

## Production state before Option A (verified read-only)

Ledger: 6 migrations applied (`20261021120000`–`20261021160000`). RLS enabled on all 22 public tables; anon policies
only allow public catalog/CMS reads and `contact_inquiries` insert.

| Function | SECURITY DEFINER | anon | authenticated | Needs anon? | Caller in app |
|---|---|---|---|---|---|
| `record_cod_collection(jsonb)` | yes | **EXECUTE** | **EXECUTE** | no | `/api/admin/cod-collections` (service role) |
| `transition_order_status(jsonb)` | yes | **EXECUTE** | **EXECUTE** | no | `/api/admin/orders/[n]/status` (service role) |
| `consume_rate_limit(text,int,int)` | yes | **EXECUTE** | **EXECUTE** | no | `src/lib/security/rate-limit.ts` (service role) |
| `create_cod_order(jsonb)` | yes | — | — | no | `/api/checkout/cod` (service role) |
| `get_order_confirmation_by_token(uuid)` | yes | EXECUTE | EXECUTE | yes (token-scoped) | `/order/success/[token]` |
| `quote_cod_shipping(jsonb)` | yes | EXECUTE | EXECUTE | yes (read-only quote) | `/api/checkout/quote` |
| `is_staff()`, `has_staff_role(staff_role[])` | yes | EXECUTE | EXECUTE | yes (RLS policies; use `auth.uid()`) | RLS |
| `norm_place`, `zone_serves_address`, `set_updated_at` | no | EXECUTE | EXECUTE | harmless helpers | RLS/triggers |

Default privileges (`pg_default_acl`) for `postgres` and `supabase_admin` in `public`: ALL on new tables/sequences
and EXECUTE on new functions to anon and authenticated (legacy auto-expose). Any function a future migration
creates would be anon-executable unless it revokes explicitly.

ACL query used:
```sql
select p.oid::regprocedure, p.prosecdef, has_function_privilege('anon', p.oid, 'EXECUTE'),
       has_function_privilege('authenticated', p.oid, 'EXECUTE')
from pg_proc p where p.pronamespace = 'public'::regnamespace order by 1;
```

## Findings

1. **High — staff RPCs callable by anon.** `record_cod_collection` and `transition_order_status` trust
   `payload.actor_user_id`. Fix: `20261023110000` (revoke) + `20261023150000` (in-function guard: any JWT role other
   than `service_role` gets `forbidden`, even if EXECUTE is re-granted by mistake). Verified locally: with EXECUTE
   deliberately re-granted to anon, both return `forbidden`; service role unaffected.
2. **Medium — `consume_rate_limit` callable by anon** (contact-form denial of service). Fix: `20261023110000`.
3. **Medium — legacy default privileges** re-expose every future object. Fix: `20261023140000` (per-schema revokes
   plus a global revoke of the built-in PUBLIC EXECUTE on functions; per-schema defaults cannot remove it).
   Verified locally on production-equivalent grants: new function/table/sequence created as `postgres` → not
   accessible to anon/authenticated, accessible to service_role.
4. **Low — staff UUID becomes public** via `content_pages.legal_approved_by` once a legal page is published.
   Fix: column hidden from anon/authenticated in `20261023120000`.
5. **Low — TRUNCATE/REFERENCES/TRIGGER** granted to anon/authenticated on every table (not reachable through
   PostgREST; TRUNCATE ignores RLS). Fix: `20261023120000`.

Server-side identity: staff routes derive `actor_user_id` from the verified Supabase session
(`createAuthorizedStaffClient` → `getUser()` + active membership + role check) and call RPCs with the service role.
The browser never receives the service-role key (client-chunk scan in `docs/DEPLOYMENT_REPORT.md`).

6. **Functional (found 2026-10-23) — `quote_cod_shipping` broken once any zone exists** (`record` loop variable
   passed to `zone_serves_address(shipping_zones, …)`). Fix: `20261023170000`. Not a privilege issue; listed because it
   is a public RPC.
7. **Residual — `supabase_admin` default privileges** still auto-expose objects that role creates in `public`
   (platform-managed). No project migration creates objects as `supabase_admin`.

## Rule for new migrations

Every new table/view/function must state its grants. Server-only functions: `revoke execute … from public, anon,
authenticated; grant execute … to service_role;` and, if SECURITY DEFINER with a caller-supplied actor, the
`auth.role()` guard used in `20261023150000`.

Approval request for production: `docs/MIGRATION_PRODUCTION_APPROVAL.md`.
