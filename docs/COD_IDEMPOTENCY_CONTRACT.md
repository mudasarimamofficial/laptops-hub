# COD idempotency contract

## Cash collection — `record_cod_collection(payload jsonb)` (from migration `20261023150000`)

One idempotency key identifies **one** collection operation: `(order_number, amount_paisa)`.
`collector_ref` and `note` are descriptive and do not make two calls different operations.

| Call | Result | Writes |
|---|---|---|
| new key, amount fits | `{ok, idempotent_replay:false, collection_id, amount_collected_paisa, payment_status}` | 1 `cod_collections` row, order totals, 1 `order_events` (`cod_collected`), 1 `audit_logs` (`cod.collect`) |
| same key, same order, same amount (concurrent or later) | `{ok, idempotent_replay:true, collection_id: <original>, …current order totals}` | nothing |
| same key, other order **or** other amount | `P0001 idempotency_conflict` | nothing |
| new key, would exceed total due | `P0001 over_collection` | nothing |
| caller JWT role not `service_role` | `P0001 forbidden` | nothing |
| actor not an active owner/admin/manager/fulfillment | `P0001 forbidden` | nothing |

Mechanics: key lookup → `SELECT … FOR UPDATE` on the order (serializes same-order calls) → key re-check (sees a
committed winner under READ COMMITTED) → insert. A `unique_violation` is treated as a key race **only** when
`GET STACKED DIAGNOSTICS CONSTRAINT_NAME` is `cod_collections_idempotency_uidx` (same key used concurrently for
another order); the existing row is then compared like any other replay. Other unique violations re-raise.

API (`POST /api/admin/cod-collections`): 200 `{idempotentReplay}` · 409 `idempotency_conflict` ("already used for a
different order or amount. Nothing was recorded.") · 409 `over_collection` · 403 `forbidden` · 404 `not_found`.
Messages never include constraint names.

Admin UI (`src/components/admin/order-actions.tsx`): one key per logical collection, kept across retries and
cleared only after a 200. A retry after a lost response therefore replays instead of recording twice; changing the
amount after a lost-but-committed request yields the conflict message instead of a second collection.

## Checkout — `create_cod_order(payload jsonb)` + `/api/checkout/cod`

Unique `orders_idempotency_key_uidx`. Concurrent same-key submits: the losing insert raises 23505; the route retries
the RPC once, which returns the existing order (`duplicate: true`). Prices, totals and shipping are recomputed in
the database from variants and zones; forged client totals are ignored.

From `20261023160000`: a replayed key must describe the same checkout — same lines (variant → total quantity) and
shipping zone. Otherwise `idempotency_conflict` (route: 409 "already submitted with a different cart", no order
number or access token) and nothing is written. Customer/address fields are not compared. The checkout page keeps
one key per page load, so a lost response followed by a cart change can no longer show the old order as success.

## Test matrix (local Supabase only — `scripts/test-cod-concurrency.mjs`, `security-role-http-isolated.mjs`)

| Case | Assertion (persisted rows, not flags) |
|---|---|
| same key, 2/8/16/32 concurrent, 3 keys each | 1 fresh + rest replays with one collection id; rows = events = audit = keys; collected = keys × amount |
| replay after completion | same collection id, 1 row |
| same key, different amount, after completion | conflict; order total unchanged; 1 row |
| same key, other order, after completion | conflict; other order collected = 0 |
| same key across two orders, concurrent, both arrival orders × 10 | exactly 1 fresh + 1 conflict; 1 row per key |
| same key, same order, different amounts concurrent × 10 | exactly 1 recorded + 1 conflict |
| 16 distinct keys concurrent over the total | 5 recorded, 11 `over_collection`, collected = total, status `collected` |
| route: record / retry / different amount / editor | 200 / 200 replay / 409 conflict without constraint text / 403 |
| checkout: same key, different cart / zone / same cart | conflict / conflict / duplicate replay; RPC and HTTP (409, no order number) |

Before the fix (`20261023130000` behaviour) the conflict cases returned **success** with nothing recorded (12/16).
After: 16/16 on 8 consecutive runs. Finite runs are evidence, not a proof of concurrency safety.
