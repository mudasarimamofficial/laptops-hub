# Laptops HUB — Final Forensic Audit (2026-11-14)

**Scope:** branch `feat/merchant-operating-system`, from HEAD `cb638b7` at the start to `a534b18` plus docs at the end, audited against the
2026-11-14 live audit and the master prompt. **Verdict:** READY FOR OWNER APPROVAL — NOT YET LIVE-COMMERCE CERTIFIED.

## 1. Starting state

- The working tree held uncommitted edits whose content matched `main` (`2b43236`). Those edits would have silently reverted branch work, so they were saved to `stash@{0}`, not discarded, and HEAD was restored.
- Live checks:
  - Vercel deployments: listed read-only.
  - Supabase production: **not re-verified**, because MCP access was denied in this session. Production facts below come from the 2026-10-23 records (14 migrations applied, COD off).
- No production write, migration, deploy, merge, env change or notification happened in this pass.

## 2. Findings and resolutions

| Severity | Finding | Root cause | Resolution | Commit |
|---|---|---|---|---|
| P0 | Admin rendered inside storefront chrome | Admin lived under the storefront root layout | Route groups with a single minimal root layout; admin layout imports its own CSS; admin catch-all 404 | `2e19797` |
| P0 | Checkout gate was client-only (a build-time public flag) | No server evaluation | `evaluateCheckoutReadiness` (pure) plus `loadCheckoutReadiness` (server, fails closed); checkout page is a server component | `2e19797` |
| P0 | Admin "pending" block contradicted the real readiness state | Static copy | Live gate matrix with fix links | `2e19797` |
| P0 | A blank fee field saved as Rs 0, i.e. accidental free delivery | `Number(x) \|\| 0` | Blank sends `null` and Zod rejects it with a clear message; a deliberate 0 renders "Free delivery" | `2e19797` |
| P0 | Quote API echoed raw DB errors | Error passthrough | Mapped to generic codes | `2e19797` |
| P0 | Fresh `next build` failed | `next/font/google` received extension-less font URLs (`/l/font?kit=`); Turbopack "queries have exactly one entry" | Self-hosted OFL variable fonts via `next/font/local` | `2e19797` |
| P1 | Three functions had a mutable `search_path` (advisor) | Missing `SET search_path` | Migration `20261114100000` (local only) | `2e19797` |
| P1 | Settings/navigation forms posted via GET before hydration | No `method` attribute | `method="post"` | `2e19797` |
| P1 | 360 px overflow in the readiness panel and fee grid | Long tokens; fixed two-column grid | `overflow-wrap:anywhere`; responsive grid | `2e19797` |
| P1 | Counts, angle counters, section numbers and alt text shown as captions on the storefront | Hard-coded V5 parity copy | Presentation switches, hidden by default and owner-toggleable | `a534b18` |
| P2 | Recovery E2E asserted a cumulative audit count | Test not idempotent | Count scoped to this run | `a534b18` |

## 3. Security review notes

- `is_staff` / `has_staff_role` stay executable by anon. RLS policies depend on them, and they reveal only the caller's own state.
- `get_order_confirmation_by_token` takes an unguessable UUID token and returns 4 non-PII fields.
- `quote_cod_shipping` is public by design and returns fees only.
- Anon can read only these `store_settings` keys: `brand`, `announcement`, `cod_checkout`, `seo`. The new `storefront_presentation` key is read server-side with the service client and is not exposed to anon.
- The readiness panel renders gate names and states, never env values. The spec asserts that the service-role key is absent from the HTML.
- Owner action: turn on leaked-password protection (Supabase dashboard).

## 4. Open risks

1. Production DB state was not re-verified this pass.
2. `create_cod_order` writes no `inventory_ledger` row on stock decrement, so stock-movement audits will be incomplete.
3. The staff-only media API returns raw error text.
4. `notFound()` inside dynamic PDPs shows the Next error shell. This already happens in production.
5. Reels, reviews, blog and real-data badges are not built (see the acceptance matrix). Nothing fabricated is shown in their place.
6. All six pending migrations need approval in order. Down-scripts are not written yet.
