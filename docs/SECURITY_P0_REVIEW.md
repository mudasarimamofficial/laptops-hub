# P0 Security Review — Admin authorization & public data exposure

**Date:** 2026-10-21  
**Commit scope:** Admin `requireStaff` hard gate, column grants, order-token RPC, contact rate limit  
**Status:** **FIXED and verified** (runtime probes 9/9 pass)

---

## 1. Vulnerability (confirmed in prior HEAD)

| Issue | Location | Impact |
|-------|----------|--------|
| Middleware only checked `user` presence | `src/lib/supabase/middleware.ts` | Any signed-in non-staff user reached `/admin/*` |
| Admin pages called `createServiceClient()` with **no** staff check | `orders`, `products`, `settings`, `inquiries` | Customer PII, drafts, settings exposed to any authenticated visitor hitting those routes |
| Overview called `adminProductCounts()` even when `staff === false` | `src/app/admin/page.tsx` | Aggregate privileged metrics leaked to non-staff |
| `product_variants` RLS SELECT exposed all columns | init migration | Anon Data API could request `quantity_on_hand` / `inventory_mode` |
| Order success used unrestricted service-role table select | `order/success/[token]` | Broader than needed for opaque-token confirmation |

---

## 2. Remediation

### Application
- Added `src/lib/auth/staff.ts`:
  - `requireStaff(allowedRoles?)` — throws 401/403
  - `requireStaffPage()` — redirects to `/admin/login` or `/admin/forbidden`
  - Exact role allow-lists (no rank escalation shortcuts)
- **Every** privileged admin page now calls `requireStaffPage(...)` **before** any elevated query
- Service role used only **after** that gate
- Removed shared `adminProductCounts()` helper that could be called without auth
- Middleware now also checks `admin_memberships.is_active` (defense in depth; pages remain source of truth)
- `/admin/forbidden` for authenticated non-staff
- Contact API: rate limit (5 / 15 min / IP), honeypot, safe error messages, `Cache-Control: no-store`
- Order success: UUID validation, `get_order_confirmation_by_token` RPC (minimal columns), no customer PII, noindex/no-store headers

### Database (`20261021130000_p0_security_hardening.sql`)
- Column-level `REVOKE`/`GRANT` so `anon`/`authenticated` cannot select inventory or internal product ops columns
- Service role retains full access for authorized staff ops
- Deny self INSERT/UPDATE/DELETE on `admin_memberships` for authenticated
- RPC `get_order_confirmation_by_token(uuid)` SECURITY DEFINER, execute granted to anon/authenticated

---

## 3. Verified test evidence

### Unit
```
npm run test:unit
→ money.test.ts ok
→ phone.test.ts ok
→ staff-auth.test.ts ok
```

### Runtime Data API probes (`npm run test:security:p0`)
Evidence file: `docs/SECURITY_P0_PROBE_RESULTS.json`

| Probe | Result |
|-------|--------|
| anon cannot read orders | PASS |
| anon cannot read inquiries | PASS |
| anon cannot select inventory columns | PASS (`permission denied`) |
| anon cannot select flags/media_approval/import_source | PASS (`permission denied`) |
| anon cannot list drafts | PASS (0 rows) |
| anon cannot insert admin_memberships | PASS (RLS) |
| anon can still read public prices | PASS |
| service role can read inventory (staff path) | PASS |
| order token RPC empty for unknown UUID | PASS |
| **Total** | **9/9** |

### Public catalog regression (manual)
Anon nested select of products + variants + media still returns active products (spot-check 2 rows OK).

### Build
`npm run build` succeeds with admin routes force-dynamic.

### Auth matrix (anonymous HTTP + RLS) — executed
`npm run test:security:auth-matrix` → **24/24** (`docs/SECURITY_AUTH_MATRIX_RESULTS.json`).
Admin mutation APIs return 401 without session; admin pages redirect to `/admin/login`; no sensitive payload leak in responses; anon RLS still blocks orders/inquiries/drafts/inventory.

### Not yet automated (documented follow-up)
- Full browser E2E per staff role (owner/admin/manager/editor/fulfillment/inactive) — requires owner `admin_memberships` bootstrap.
- Signed-in non-staff Auth user → `/admin/forbidden` with no customer PII in HTML.

---

## 4. Residual risk / owner actions

1. **Bootstrap first owner** with audited SQL (service role / dashboard), never via public signup:
   ```sql
   insert into public.admin_memberships (user_id, role, is_active)
   values ('<auth.users.id>', 'owner', true);
   ```
2. Rate limit uses Postgres `consume_rate_limit` with in-memory fallback; keep edge WAF in mind for launch traffic.
3. Keep `COD_CHECKOUT_ENABLED=false` until shipping/policy gates clear.
4. Do not promote production without explicit approval.

---

## 5. Conclusion

P0 authorization hole is closed and re-verified (9/9 Data API + 24/24 auth matrix). Storefront/admin feature work continues on `feat/v5-storefront-admin` while COD remains gated.
