import assert from "node:assert/strict";
import { CART_HARD_MAX, clampQty, lineMax } from "../../src/lib/commerce/cart-limits";

assert.equal(CART_HARD_MAX, 20);
assert.equal(lineMax(5), 5, "variant limit used");
assert.equal(lineMax(undefined), 20, "legacy lines without a limit fall back to the DB hard cap");
assert.equal(lineMax(null), 20);
assert.equal(lineMax(0), 20);
assert.equal(lineMax(50), 20, "never above DB hard cap");
assert.equal(lineMax(2.5), 20);

assert.equal(clampQty(3, 5), 3);
assert.equal(clampQty(9, 5), 5, "cannot exceed max_per_order");
assert.equal(clampQty(0, 5), 1);
assert.equal(clampQty(-4, 5), 1);
assert.equal(clampQty(Number.NaN, 5), 1);
assert.equal(clampQty(4.9, 5), 4);

console.log("cart-limits.test.ts ok");
