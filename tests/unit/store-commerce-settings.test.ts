import assert from "node:assert/strict";
import {
  parseInventoryTracking,
  parseStorefrontCheckout,
} from "../../src/lib/commerce/store-commerce-settings";

assert.equal(parseInventoryTracking(undefined).enabled, false);
assert.equal(parseInventoryTracking(null).enabled, false);
assert.equal(parseInventoryTracking({}).enabled, false);
assert.equal(parseInventoryTracking({ enabled: false }).enabled, false);
assert.equal(parseInventoryTracking({ enabled: true }).enabled, true);
assert.equal(parseInventoryTracking({ enabled: "true" }).enabled, true);
assert.equal(parseInventoryTracking({ enabled: "false" }).enabled, false);

assert.equal(parseStorefrontCheckout(undefined).pdpCta, "add_to_cart");
assert.equal(parseStorefrontCheckout({ pdp_cta: "add_to_cart" }).pdpCta, "add_to_cart");
assert.equal(parseStorefrontCheckout({ pdp_cta: "buy_now" }).pdpCta, "buy_now");
assert.equal(parseStorefrontCheckout({ pdp_cta: "nope" }).pdpCta, "add_to_cart");

console.log("store-commerce-settings.test.ts: ok");
