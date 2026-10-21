import assert from "node:assert/strict";
import { canPurchase } from "../../src/lib/catalog/availability";
import { COMPARE_LIMIT, isValidHandle, parseCompareHandles } from "../../src/lib/catalog/handles";

// Availability: only explicit availability + positive integer price + variant
assert.equal(canPurchase({ available: true, pricePaisa: 1_600_000, variantId: "v1" }), true);
assert.equal(canPurchase({ available: false, pricePaisa: 1_600_000, variantId: "v1" }), false);
assert.equal(canPurchase({ available: true, pricePaisa: 0, variantId: "v1" }), false);
assert.equal(canPurchase({ available: true, pricePaisa: -5, variantId: "v1" }), false);
assert.equal(canPurchase({ available: true, pricePaisa: 10.5, variantId: "v1" }), false);
assert.equal(canPurchase({ available: true, pricePaisa: 100, variantId: "" }), false);
// @ts-expect-error missing flag must not be treated as available
assert.equal(canPurchase({ pricePaisa: 100, variantId: "v1" }), false);

// Compare handles
assert.equal(COMPARE_LIMIT, 4);
assert.deepEqual(parseCompareHandles(null), []);
assert.deepEqual(parseCompareHandles(""), []);
assert.deepEqual(parseCompareHandles("a-1,b-2,a-1"), ["a-1", "b-2"], "dedupe, keep order");
assert.deepEqual(parseCompareHandles("a,b,c,d,e,f"), ["a", "b", "c", "d"], "cap at 4");
assert.deepEqual(parseCompareHandles(" a , B ,c--d,e_f,g%20,h"), ["a", "h"], "reject invalid formats");
assert.deepEqual(parseCompareHandles("x," + "y".repeat(201)), ["x"], "reject over-long handles");
assert.equal(isValidHandle("dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage"), true);
assert.equal(isValidHandle("Dell"), false);
assert.equal(isValidHandle(42), false);

console.log("availability-handles.test.ts ok");
