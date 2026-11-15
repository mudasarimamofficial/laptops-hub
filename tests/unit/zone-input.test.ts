import assert from "node:assert/strict";
import { zoneInputSchema } from "../../src/lib/commerce/zone-input";

const base = { name: "All Over PK", provinces: ["Punjab"], flatFeePkr: 360, codFeePkr: 50 };

// Existing payloads (no new fields) keep their meaning: no exclusions, no free-delivery threshold.
const plain = zoneInputSchema.parse(base);
assert.deepEqual(plain.excludedCities, []);
assert.equal(plain.freeShippingMinPkr, null);

// 0 fees are valid and deliberate; a blank fee (null) is refused, never turned into 0.
assert.equal(zoneInputSchema.parse({ ...base, flatFeePkr: 0, codFeePkr: 0 }).flatFeePkr, 0);
assert.equal(zoneInputSchema.safeParse({ ...base, flatFeePkr: null }).success, false);

// Free-delivery minimum: optional whole rupees ≥ 0; 0 allowed; negative/fractional refused.
assert.equal(zoneInputSchema.parse({ ...base, freeShippingMinPkr: 150_000 }).freeShippingMinPkr, 150_000);
assert.equal(zoneInputSchema.parse({ ...base, freeShippingMinPkr: 0 }).freeShippingMinPkr, 0);
assert.equal(zoneInputSchema.safeParse({ ...base, freeShippingMinPkr: -1 }).success, false);
assert.equal(zoneInputSchema.safeParse({ ...base, freeShippingMinPkr: 10.5 }).success, false);

// Excluded cities are trimmed; one-letter names refused.
assert.deepEqual(zoneInputSchema.parse({ ...base, excludedCities: ["  Gwadar "] }).excludedCities, ["Gwadar"]);
assert.equal(zoneInputSchema.safeParse({ ...base, excludedCities: ["G"] }).success, false);

console.log("zone-input: ok");
