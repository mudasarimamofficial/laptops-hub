import assert from "node:assert/strict";
import { grantableRoles, staffChangeProblem, staffEmail } from "../../src/lib/auth/staff-admin";
import { staffInviteEmail } from "../../src/lib/auth/staff-invite-email";

const OWNER = "00000000-0000-4000-8000-000000000001";
const ADMIN = "00000000-0000-4000-8000-000000000002";
const OTHER = "00000000-0000-4000-8000-000000000003";

// Who may grant what.
assert.deepEqual(grantableRoles("owner"), ["admin", "manager", "editor", "fulfillment"]);
assert.deepEqual(grantableRoles("admin"), ["manager", "editor", "fulfillment"]);
for (const r of ["manager", "editor", "fulfillment"] as const) assert.deepEqual(grantableRoles(r), []);

// Invites.
assert.equal(staffChangeProblem({ actorId: OWNER, actorRole: "owner", nextRole: "admin" }), null);
assert.equal(staffChangeProblem({ actorId: ADMIN, actorRole: "admin", nextRole: "manager" }), null);
assert.equal(staffChangeProblem({ actorId: ADMIN, actorRole: "admin", nextRole: "admin" }), "role_not_grantable");
assert.equal(staffChangeProblem({ actorId: OWNER, actorRole: "owner", nextRole: "owner" }), "role_not_grantable");
assert.equal(staffChangeProblem({ actorId: OTHER, actorRole: "manager", nextRole: "editor" }), "not_allowed");
assert.equal(staffChangeProblem({ actorId: OTHER, actorRole: "editor", nextRole: "editor" }), "not_allowed");
assert.equal(staffChangeProblem({ actorId: OTHER, actorRole: "fulfillment", nextRole: "editor" }), "not_allowed");
assert.equal(staffChangeProblem({ actorId: OWNER, actorRole: "owner", nextRole: "superuser" }), "role_not_grantable");

// Changes to existing members.
assert.equal(staffChangeProblem({ actorId: OWNER, actorRole: "owner", targetId: OWNER, targetRole: "owner" }), "self");
assert.equal(staffChangeProblem({ actorId: ADMIN, actorRole: "admin", targetId: ADMIN, targetRole: "admin", nextRole: "manager" }), "self");
assert.equal(staffChangeProblem({ actorId: ADMIN, actorRole: "admin", targetId: OWNER, targetRole: "owner" }), "owner_protected");
assert.equal(staffChangeProblem({ actorId: ADMIN, actorRole: "admin", targetId: OTHER, targetRole: "admin" }), "peer_admin");
assert.equal(staffChangeProblem({ actorId: OWNER, actorRole: "owner", targetId: OTHER, targetRole: "admin", nextRole: "editor" }), null);
assert.equal(staffChangeProblem({ actorId: ADMIN, actorRole: "admin", targetId: OTHER, targetRole: "editor", nextRole: "fulfillment" }), null);
assert.equal(staffChangeProblem({ actorId: ADMIN, actorRole: "admin", targetId: OTHER, targetRole: "editor", nextRole: "admin" }), "role_not_grantable");
assert.equal(staffChangeProblem({ actorId: ADMIN, actorRole: "admin", targetId: OTHER, targetRole: "editor" }), null); // deactivate

// Email normalisation.
assert.equal(staffEmail("  New.Person@Example.COM "), "new.person@example.com");
assert.equal(staffEmail("not-an-email"), null);
assert.equal(staffEmail(42), null);
assert.equal(staffEmail(`${"a".repeat(250)}@x.pk`), null);

// Invitation text: link present, no password in the email.
const msg = staffInviteEmail("fulfillment", "https://example.test/admin/auth/confirm?token_hash=abc&type=invite", "owner@example.test");
assert.match(msg.text, /Fulfillment access/);
assert.match(msg.text, /token_hash=abc&type=invite/);
assert.doesNotMatch(msg.text, /password:/i);

console.log("staff-admin: ok");
