import assert from "node:assert/strict";
import { publicationEventFromAudit, publishedHistoryOrder } from "../../src/lib/content/theme-history";

// Live first, then versions in the order they were last live, then the rest by first publication.
assert.deepEqual(
  publishedHistoryOrder("b", [{ liveVersionId: "b", previousVersionId: "old" }, { liveVersionId: "old", previousVersionId: "c" }], ["b", "c", "x"]),
  ["b", "old", "c", "x"],
);

// The version rolled back to long ago (outside the newest-20 by published_at) stays restorable.
const recent = Array.from({ length: 25 }, (_, i) => `v${i}`);
const order = publishedHistoryOrder("v0", [{ liveVersionId: "v0", previousVersionId: "ancient" }], recent);
assert.equal(order.length, 20);
assert.equal(order[0], "v0");
assert.equal(order[1], "ancient");

// No audit rows (or unreadable audit): the old behaviour, plus the live version is always listed.
assert.deepEqual(publishedHistoryOrder("z", [], ["a", "b"], 2), ["z", "a"]);
assert.deepEqual(publishedHistoryOrder(null, [], ["a", "b"]), ["a", "b"]);

// Audit parsing tolerates missing or malformed rows.
assert.deepEqual(publicationEventFromAudit({ published_version_id: "a", previous_version_id: "b" }), { liveVersionId: "a", previousVersionId: "b" });
assert.deepEqual(publicationEventFromAudit(null), { liveVersionId: null, previousVersionId: null });
assert.deepEqual(publicationEventFromAudit({ published_version_id: 3 }), { liveVersionId: null, previousVersionId: null });

console.log("theme-history: ok");
