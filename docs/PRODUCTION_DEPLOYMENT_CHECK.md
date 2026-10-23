# Production deployment check (read-only)

## Update, re-checked 2026-10-21
- A **second** Production deployment now exists: `dpl_BrACMxR5SfDx317aRs9ExLr7VNBh`. Same source (`feat/v5-storefront-admin` @ `ea652f2`), created by `mudasarimamofficial-2733`. A Preview of the same commit, `dpl_DD5Lk9fhDJSTxQoW2mvomZKe43JA`, was built just before it.
- The live aliases (`laptops-hub.vercel.app`, `laptops-hub-mudasarimamofficial-gmailcoms-projects.vercel.app`, `laptops-hub-git-f-129910-…`) have **moved to `dpl_BrACMxR5…`**.
- `dpl_9YjGweW7…` now has **no aliases**. It is no longer serving any domain.
- `fix/v5-correctness-parity` still does not exist on GitHub.

## Original check: dpl_9YjGweW7HVftomU6A6PuA7pR6Sjc

Checked: 2026-10-21, using Vercel API listings only. Nothing was changed.

| Item | Finding |
|---|---|
| Target | **production**, state READY, rollback candidate |
| Source | `feat/v5-storefront-admin` @ `ea652f2a8d4f7dae7399cce2aa997dbbcf7fdd91` (same code as the last Preview) |
| Created by | `mudasarimamofficial-2733` (the owner account; not this session, which has read-only access) |
| Live aliases on this deployment | `laptops-hub.vercel.app`, `laptops-hub-mudasarimamofficial-gmailcoms-projects.vercel.app`, `laptops-hub-git-f-129910-mudasarimamofficial-gmailcoms-projects.vercel.app` |
| Custom domain | None attached to this deployment |
| Production env vars | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `COD_CHECKOUT_ENABLED` (sensitive, value hidden), `NEXT_PUBLIC_COD_CHECKOUT_ENABLED` (encrypted). None were edited after creation (updatedAt = createdAt, about 07:30 UTC). |

## Is checkout enabled?
**Probably not, but not confirmed.** Two independent switches are both required for an order to be accepted:
1. Env `COD_CHECKOUT_ENABLED` must equal `true` (`src/app/api/checkout/cod/route.ts`). Its production value is hidden. The repo docs record it as `false`, and it has not been edited since it was created.
2. DB `store_settings.cod_checkout.enabled` must be `true`. This is checked in the route and again inside `create_cod_order`. The migration seeds it as `false`. It can't be verified without Supabase access.

**To confirm without changing anything:** `curl -s -X POST https://laptops-hub.vercel.app/api/checkout/cod -H 'content-type: application/json' -d '{}'` should return `403 {"error":"checkout_disabled"}`.

## Decision for the owner
Production at `laptops-hub.vercel.app` is now publicly serving the pre-patch build. This was not authorised by the phase rules. Not rolled back, per instruction.
