import assert from "node:assert/strict";
import { orderAnalytics } from "../../src/lib/orders/analytics";

// Zero orders → zeros (the honest baseline).
assert.deepEqual(orderAnalytics([], []), {
  placed: 0, placedValuePaisa: 0, delivered: 0, cancelled: 0, returned: 0, deliveryFailed: 0, open: 0,
  cashCollectedPaisa: 0, outstandingPaisa: 0, expectedOnOpenPaisa: 0,
});

const orders = [
  { id: "a", status: "delivered", total_due_paisa: 100_000 }, // fully collected
  { id: "b", status: "delivered", total_due_paisa: 50_000 }, // partly collected (20k) → 30k outstanding
  { id: "c", status: "delivered", total_due_paisa: 70_000 }, // nothing collected → 70k outstanding
  { id: "d", status: "placed", total_due_paisa: 10_000 },
  { id: "e", status: "shipped", total_due_paisa: 20_000 },
  { id: "f", status: "cancelled", total_due_paisa: 5_000 },
  { id: "g", status: "returned", total_due_paisa: 6_000 },
  { id: "h", status: "delivery_failed", total_due_paisa: 7_000 },
];
const cols = [
  { order_id: "a", amount_paisa: 100_000 },
  { order_id: "b", amount_paisa: 20_000 },
  { order_id: "zz-outside-window", amount_paisa: 999_999 }, // not one of these orders → not counted
];
const a = orderAnalytics(orders, cols);
assert.equal(a.placed, 8);
assert.equal(a.placedValuePaisa, 268_000);
assert.equal(a.delivered, 3);
assert.equal(a.cancelled, 1);
assert.equal(a.returned, 1);
assert.equal(a.deliveryFailed, 1);
assert.equal(a.open, 2);
assert.equal(a.expectedOnOpenPaisa, 30_000);
assert.equal(a.cashCollectedPaisa, 120_000);
assert.equal(a.outstandingPaisa, 100_000);
// Placing an order is never cash collected.
assert.equal(orderAnalytics([{ id: "x", status: "placed", total_due_paisa: 1 }], []).cashCollectedPaisa, 0);

console.log("order-analytics: ok");
