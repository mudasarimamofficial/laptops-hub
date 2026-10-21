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

// Matrix: product edit roles
for (const role of ["owner", "admin", "manager", "editor"] as StaffRole[]) {
  assert.equal(roleAllowed(role, ["owner", "admin", "manager", "editor"]), true);
}
assert.equal(roleAllowed("fulfillment", ["owner", "admin", "manager", "editor"]), false);

// Matrix: order/COD roles
for (const role of ["owner", "admin", "manager", "fulfillment"] as StaffRole[]) {
  assert.equal(roleAllowed(role, ["owner", "admin", "manager", "fulfillment"]), true);
}
assert.equal(roleAllowed("editor", ["owner", "admin", "manager", "fulfillment"]), false);

// Matrix: settings roles
for (const role of ["owner", "admin", "manager"] as StaffRole[]) {
  assert.equal(roleAllowed(role, ["owner", "admin", "manager"]), true);
}
assert.equal(roleAllowed("editor", ["owner", "admin", "manager"]), false);
assert.equal(roleAllowed("fulfillment", ["owner", "admin", "manager"]), false);

console.log("staff-auth.test.ts ok");
