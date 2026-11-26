/**
 * G12: the admin page and the storefront share one decision about how a merchant collection chooses products, and
 * rules are checked before they are saved.
 */
import assert from "node:assert/strict";
import { collectionMode, validateRule } from "../../src/lib/collections/rule-eval";

const rule = { match: "all" as const, conditions: [{ field: "manufacturer", op: "eq" as const, value: "Dell" }] };

// Rules + automated type → automated, even with hand-picked products kept.
assert.equal(collectionMode({ collection_type: "automated", rule, pinCount: 3 }), "automated");
// Older rows: rules saved without the type, no picks → automated (unchanged storefront behaviour).
assert.equal(collectionMode({ collection_type: "manual", rule, pinCount: 0 }), "automated");
// Older rows: rules saved without the type, with picks → the picks (what the storefront showed before).
assert.equal(collectionMode({ collection_type: "manual", rule, pinCount: 2 }), "manual");
// No usable rule → hand-picked, whatever the type says (production's seeded rows: automated, no conditions).
assert.equal(collectionMode({ collection_type: "automated", rule: { match: "all", conditions: [] }, pinCount: 0 }), "manual");
assert.equal(collectionMode({ collection_type: "automated", rule: {}, pinCount: 0 }), "manual");
assert.equal(collectionMode({ collection_type: null, rule: null, pinCount: 1 }), "manual");

assert.equal(validateRule(rule), null);
assert.equal(validateRule({ match: "any", conditions: [{ field: "available", op: "exists" }] }), null);
assert.match(validateRule({ match: "all", conditions: [] })!, /at least one condition/);
assert.match(validateRule({ conditions: [{ field: "manufacturer", op: "eq", value: "  " }] })!, /Condition 1: enter a value/);
assert.match(validateRule({ conditions: [rule.conditions[0], { field: "price_pkr", op: "gte", value: "abc" }] })!, /Condition 2: enter a number/);
assert.match(validateRule({ conditions: [{ field: "price_pkr", op: "drop table", value: 1 }] })!, /how to compare/);
assert.match(validateRule({ match: "some", conditions: rule.conditions })!, /all or any/);
assert.match(validateRule({ conditions: Array.from({ length: 21 }, () => rule.conditions[0]) })!, /20 conditions/);
assert.match(validateRule([])!, /could not be read/);

console.log("collection-mode: ok");
