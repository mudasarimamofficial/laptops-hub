import assert from "node:assert/strict";

// Pure helper mirrored from staff.ts role allow-list semantics
type StaffRole = "owner" | "admin" | "manager" | "editor" | "fulfillment";

function roleAllowed(actual: StaffRole, allowed?: StaffRole[]): boolean {
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(actual);
}

assert.equal(roleAllowed("owner"), true);
assert.equal(roleAllowed("editor", ["owner", "admin", "manager", "editor"]), true);
assert.equal(roleAllowed("fulfillment", ["owner", "admin", "manager", "fulfillment"]), true);
assert.equal(roleAllowed("editor", ["owner", "admin", "manager", "fulfillment"]), false);
assert.equal(roleAllowed("fulfillment", ["owner", "admin", "manager", "editor"]), false);

console.log("staff-auth.test.ts ok");
