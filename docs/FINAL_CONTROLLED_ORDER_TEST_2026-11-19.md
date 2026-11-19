# Controlled / isolated COD order test — 2026-11-19

## Scope
Isolated local Supabase only (`127.0.0.1:54321`). **No production order created.**

## Command
```bash
node scripts/test-cod-checkout-isolated.mjs http://127.0.0.1:3001
```

## Result
**32/32 PASS** at `2026-11-19` (see `docs/COD_CHECKOUT_ISOLATED_RESULTS.json`).

Includes:
- Server-authoritative pricing (forged client totals ignored)
- Idempotent same-key submit → one order
- Idempotency conflict on cart/zone change
- Tracked inventory oversell race (requires global `inventory_tracking.enabled=true` for the race window; restored after)
- Draft / zone / quantity limit refusals
- Anon RPC denial
- HTTP double-submit, quote, confirmation token, contact insert

## Fixture note
After migration `20261118074859`, stock gates apply only when merchant global inventory tracking is ON. The isolated script now enables that setting for the oversell case and restores the prior value in `finally`.

## Production gate
Live COD place-order remains **NOT ENABLED / NOT TESTED** on www (business go-live decision). Preserved engineering order `LH-261118-77C0F6` untouched.
