import assert from "node:assert/strict";
import { isFreshRecoverySession, newPasswordProblem, recoveryEmail, RECOVERY_WINDOW_SECONDS } from "../../src/lib/auth/recovery";

const now = 1_800_000_000;
const token = (amr: unknown) => ["e30", Buffer.from(JSON.stringify({ sub: "u", amr })).toString("base64url"), "sig"].join(".");

// Recovery session: only a recent recovery/OTP sign-in counts; a password sign-in never does.
assert.equal(isFreshRecoverySession(token([{ method: "recovery", timestamp: now - 60 }]), now), true);
assert.equal(isFreshRecoverySession(token([{ method: "otp", timestamp: now - 60 }]), now), true);
assert.equal(isFreshRecoverySession(token([{ method: "password", timestamp: now - 60 }]), now), false);
assert.equal(isFreshRecoverySession(token([{ method: "recovery", timestamp: now - RECOVERY_WINDOW_SECONDS - 1 }]), now), false, "stale");
assert.equal(isFreshRecoverySession(token([{ method: "password", timestamp: now }, { method: "otp", timestamp: now - 30 }]), now), true);
assert.equal(isFreshRecoverySession(token("recovery"), now), false);
assert.equal(isFreshRecoverySession(undefined, now), false);
assert.equal(isFreshRecoverySession("not-a-jwt", now), false);

// Password rules.
assert.equal(newPasswordProblem("Correct-Horse-91", "Correct-Horse-91", "owner@example.com"), null);
assert.match(newPasswordProblem("Correct-Horse-91", "Correct-Horse-92")!, /do not match/);
assert.match(newPasswordProblem("short-1A", "short-1A")!, /at least 12/);
assert.match(newPasswordProblem("x".repeat(129), "x".repeat(129))!, /at most 128/);
assert.match(newPasswordProblem(" leading-space-1", " leading-space-1")!, /space/);
assert.match(newPasswordProblem("mudasar-2026-xyz", "mudasar-2026-xyz", "mudasar@example.com")!, /email name/);
assert.match(newPasswordProblem("aaaaaaaaaaaaab", "aaaaaaaaaaaaab")!, /repetitive/);
assert.match(newPasswordProblem(undefined, undefined)!, /twice/);

// Email normalisation.
assert.equal(recoveryEmail("  Owner@Example.COM "), "owner@example.com");
assert.equal(recoveryEmail("not-an-email"), null);
assert.equal(recoveryEmail(42), null);
assert.equal(recoveryEmail(`${"a".repeat(250)}@x.io`), null);

console.log("recovery.test.ts ok");
