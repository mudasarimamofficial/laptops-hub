# 11 — Customer order E2E report

**Date:** 2026-11-17

## Isolated environment

| Item | Result |
|---|---|
| Stack | Local Supabase + `.next-local` @ `127.0.0.1:3001` |
| Spec | `tests/e2e-isolated/p0-variant-order-journey.spec.ts` |
| Result | **PASS** (this session, after inventory/shortcuts rebuild) |
| Scope | Exact variant → cart → quote → COD place → ledger → cancel/restock |

Production real-order test: **BLOCKED** (COD gates + owner policies — see `20_OWNER_DECISIONS_AND_GO_LIVE_GATES.md`).

## Production storefront (read-only)

| Step | Result |
|---|---|
| Browse / search / PDP | PASS |
| Add to cart / totals | PASS |
| Checkout UI | Shows COD summary; Place order disabled |
| `POST /api/checkout/cod` | 403 `checkout_disabled` |

## Classification

**Isolated transaction verified / production real-order test blocked.**
