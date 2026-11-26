import assert from "node:assert/strict";
import { RESTORE_PROTECTED_SETTING_KEYS, restorablePayload } from "../../src/lib/admin/merchant-snapshots";

// G17: a CMS restore never sends the COD go-live gate to the restore RPC; every other row passes through unchanged.
// G24: nor the notification settings (customer-email mode, staff recipients).
assert.deepEqual([...RESTORE_PROTECTED_SETTING_KEYS], ["cod_checkout", "notifications"]);
const payload = {
  schemaVersion: 2,
  store_settings: [
    { key: "cod_checkout", value: { enabled: true } },
    { key: "contact_social", value: { businessName: "X" } },
    { key: "navigation", value: { items: [] } },
    { key: "notifications", value: { customer_mode: "on", recipients: ["former@x.pk"] } },
  ],
  articles: [{ id: "a" }],
};
const { payload: out, keptLive } = restorablePayload(payload);
assert.deepEqual(keptLive, ["cod_checkout", "notifications"]);
assert.deepEqual(
  out.store_settings.map((r) => (r as { key: string }).key),
  ["contact_social", "navigation"],
);
assert.equal(out.articles, payload.articles);
assert.equal(payload.store_settings.length, 4, "input is not mutated");
assert.deepEqual(restorablePayload({ store_settings: [{ key: "seo_defaults" }] }).keptLive, []);

console.log("restore-protected: ok");
