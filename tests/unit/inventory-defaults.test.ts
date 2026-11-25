import assert from "node:assert/strict";
import { LOW_STOCK_AT, lowStockAtFrom, newProductTrackedFrom, stockState } from "../../src/lib/commerce/inventory-adjust";

// G16: the saved threshold drives the desk; 0 / missing / junk keep the built-in value (production stores 0).
assert.equal(LOW_STOCK_AT, 2);
assert.equal(lowStockAtFrom({ tracked: false, low_stock_threshold: 0 }), 2);
assert.equal(lowStockAtFrom(null), 2);
assert.equal(lowStockAtFrom({}), 2);
assert.equal(lowStockAtFrom({ low_stock_threshold: 5 }), 5);
assert.equal(lowStockAtFrom({ low_stock_threshold: "3" }), 3);
assert.equal(lowStockAtFrom({ low_stock_threshold: 2.5 }), 2);
assert.equal(lowStockAtFrom({ low_stock_threshold: -1 }), 2);
assert.equal(lowStockAtFrom({ low_stock_threshold: 5000 }), 2);
assert.equal(stockState(5, lowStockAtFrom({ low_stock_threshold: 5 })), "low");
assert.equal(stockState(5, lowStockAtFrom({ low_stock_threshold: 0 })), "ok");

assert.equal(newProductTrackedFrom({ tracked: true }), true);
assert.equal(newProductTrackedFrom({ tracked: false }), false);
assert.equal(newProductTrackedFrom({ tracked: "true" }), false);
assert.equal(newProductTrackedFrom(undefined), false);

console.log("inventory-defaults: ok");
