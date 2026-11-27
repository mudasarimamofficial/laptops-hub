import assert from "node:assert/strict";
import { deliveryFeeLabel, evaluateCheckoutReadiness, type ReadinessInput } from "../../src/lib/commerce/checkout-readiness";
import { formatPkr } from "../../src/lib/money";

const allPolicies = { shipping: true, returns: true, warranty: true, privacy: true, terms: true };
const nationwide = {
  name: "All Over PK",
  isActive: true,
  provinces: ["Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan", "Islamabad Capital Territory", "Gilgit-Baltistan", "Azad Jammu and Kashmir"],
};
const ready: ReadinessInput = {
  env: { clientFlag: "true", serverFlag: "true" },
  dbSetting: { enabled: true, reason: null },
  zones: [nationwide],
  policies: allPolicies,
  purchasableVariants: 226,
  trackedVariants: 10,
  notifications: { transportConfigured: true },
  activeOwnersOrAdmins: 1,
};

// All gates pass -> open.
assert.equal(evaluateCheckoutReadiness(ready).open, true);

// The November 2026 production snapshot: flags unknown/off, DB off, policies pending, zone exists, all untracked.
const prod = evaluateCheckoutReadiness({
  ...ready,
  env: { clientFlag: undefined, serverFlag: undefined },
  dbSetting: { enabled: false, reason: "Owner shipping/policies pending" },
  policies: { shipping: false, returns: false, warranty: false, privacy: false, terms: false },
  trackedVariants: 0,
  notifications: { transportConfigured: false },
});
assert.equal(prod.open, false);
assert.deepEqual(prod.blockingFailures.sort(), ["client_flag", "db_setting", "policies", "server_flag"].sort());
// A configured nationwide zone is NOT reported as the blocker.
assert.equal(prod.gates.find((g) => g.id === "shipping_zones")!.state, "pass");
// Untracked inventory is a warning, not silently "pass".
assert.equal(prod.gates.find((g) => g.id === "purchasable_catalog")!.state, "warn");
assert.match(prod.gates.find((g) => g.id === "db_setting")!.detail, /Owner shipping\/policies pending/);
// G41: the COD store switch has no Admin control, so no "fix" link may point to Settings; the detail says who decides.
assert.equal(prod.gates.find((g) => g.id === "db_setting")!.fixHref, null);
assert.match(prod.gates.find((g) => g.id === "db_setting")!.detail, /owner decision/);

// Each single blocking failure closes ordering on its own.
for (const [patch, id] of [
  [{ env: { clientFlag: "false", serverFlag: "true" } }, "client_flag"],
  [{ env: { clientFlag: "true", serverFlag: "TRUE" } }, "server_flag"], // only the exact string "true" opens
  [{ dbSetting: null }, "db_setting"],
  [{ zones: [] }, "shipping_zones"],
  [{ zones: [{ ...nationwide, isActive: false }] }, "shipping_zones"],
  [{ zones: [{ ...nationwide, provinces: [] }] }, "shipping_zones"],
  [{ policies: { ...allPolicies, warranty: false } }, "policies"],
  [{ purchasableVariants: 0 }, "purchasable_catalog"],
] as [Partial<ReadinessInput>, string][]) {
  const r = evaluateCheckoutReadiness({ ...ready, ...patch });
  assert.equal(r.open, false, `expected closed for ${id}`);
  assert.deepEqual(r.blockingFailures, [id]);
}

// Advisory gates never block.
assert.equal(evaluateCheckoutReadiness({ ...ready, notifications: { transportConfigured: false }, activeOwnersOrAdmins: 0 }).open, true);

// Reports flag names only — never env values.
const json = JSON.stringify(evaluateCheckoutReadiness(ready));
assert.ok(!json.includes("SUPABASE_SERVICE_ROLE_KEY"));

// PKR 0 is a valid deliberate fee (no falsy substitution); 360 + 50 configured rate renders as money.
assert.equal(deliveryFeeLabel(0, formatPkr), "Free delivery");
assert.equal(deliveryFeeLabel(36000, formatPkr), `Delivery ${formatPkr(36000)}`);
assert.match(formatPkr(36000), /360/);
assert.match(formatPkr(5000), /50/);
assert.throws(() => deliveryFeeLabel(-1, formatPkr));
assert.throws(() => deliveryFeeLabel(Number.NaN, formatPkr));

console.log("checkout-readiness.test.ts: ok");
