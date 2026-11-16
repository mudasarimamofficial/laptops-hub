/**
 * Staff management rules (pure; used by /api/admin/staff and the Staff page).
 *
 *  - Only an owner or admin manages staff.
 *  - Owner may grant admin, manager, editor, fulfillment. Admin may grant manager, editor, fulfillment.
 *  - Nobody grants or changes "owner" here: ownership changes are an owner decision done with the database
 *    administrator (runbook), never from a web form.
 *  - Nobody changes their own membership (no self-demotion lock-out, no self-elevation).
 *  - An admin cannot change another admin; only the owner can.
 */
import type { StaffRole } from "@/lib/auth/staff";

export const STAFF_MANAGER_ROLES: StaffRole[] = ["owner", "admin"];
export const ASSIGNABLE_ROLES = ["admin", "manager", "editor", "fulfillment"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function grantableRoles(actor: StaffRole): AssignableRole[] {
  if (actor === "owner") return ["admin", "manager", "editor", "fulfillment"];
  if (actor === "admin") return ["manager", "editor", "fulfillment"];
  return [];
}

export type StaffChangeProblem =
  | "not_allowed"
  | "self"
  | "owner_protected"
  | "role_not_grantable"
  | "peer_admin";

/**
 * Can `actor` change a member currently holding `targetRole` (null = new invite) to `nextRole` (undefined = role
 * unchanged, e.g. activate/deactivate)? Returns null when allowed.
 */
export function staffChangeProblem(input: {
  actorId: string;
  actorRole: StaffRole;
  targetId?: string | null;
  targetRole?: StaffRole | null;
  nextRole?: string;
}): StaffChangeProblem | null {
  const { actorId, actorRole, targetId, targetRole, nextRole } = input;
  if (!STAFF_MANAGER_ROLES.includes(actorRole)) return "not_allowed";
  if (targetId && targetId === actorId) return "self";
  if (targetRole === "owner") return "owner_protected";
  if (targetRole === "admin" && actorRole !== "owner") return "peer_admin";
  if (nextRole !== undefined && !(grantableRoles(actorRole) as string[]).includes(nextRole)) return "role_not_grantable";
  return null;
}

export const STAFF_PROBLEM_MESSAGE: Record<StaffChangeProblem, string> = {
  not_allowed: "Only an owner or admin can manage staff.",
  self: "You cannot change your own access. Ask another owner or admin.",
  owner_protected: "The owner account cannot be changed here.",
  role_not_grantable: "You cannot give that role.",
  peer_admin: "Only the owner can change an admin.",
};

/** Normalised invite email or null. */
export function staffEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/** Ban long enough to be permanent until reactivated; revokes refresh tokens so no session can be renewed. */
export const DEACTIVATED_BAN = "876000h";
