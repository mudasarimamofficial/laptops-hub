import assert from "node:assert/strict";
import { purchasableAfterPrice } from "../../src/lib/catalog/sellable";

// Price 0 can never be sold.
assert.equal(purchasableAfterPrice(500_000, 0, true), false);
// First real price (was 0) makes the variant sellable.
assert.equal(purchasableAfterPrice(0, 500_000, false), true);
// Otherwise the merchant's Sell switch is kept (G07: a price edit no longer re-enables a variant switched off).
assert.equal(purchasableAfterPrice(500_000, 600_000, false), false);
assert.equal(purchasableAfterPrice(500_000, 600_000, true), true);
console.log("sellable tests passed");
