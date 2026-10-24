import assert from "node:assert/strict";
import { localOnlyProblems, PRODUCTION_REF } from "../../scripts/lib/local-only.mjs";

const jwt = (payload: object) =>
  ["e30", Buffer.from(JSON.stringify(payload)).toString("base64url"), "sig"].join(".");
const hostedKey = jwt({ iss: "supabase", ref: PRODUCTION_REF, role: "service_role" });
const otherHostedKey = jwt({ iss: "supabase", ref: "abcdefghijklmnopqrst", role: "service_role" });
const localKey = jwt({ iss: "supabase-demo", role: "service_role" });

// Local stack with the CLI's demo keys → allowed.
assert.deepEqual(localOnlyProblems("http://127.0.0.1:54321", [localKey]), []);
assert.deepEqual(localOnlyProblems("http://localhost:54321/", [localKey, "sb_secret_localdemo"]), []);
assert.deepEqual(localOnlyProblems("http://[::1]:54321", [localKey]), []);

// Production or any hosted project → refused, whatever else is set.
assert.ok(localOnlyProblems(`https://${PRODUCTION_REF}.supabase.co`, [localKey]).length);
assert.ok(localOnlyProblems("https://example.supabase.co", [localKey]).length);
assert.ok(localOnlyProblems("http://127.0.0.1:54321", [hostedKey]).length, "local URL + production key (tunnel / mixed env)");
assert.ok(localOnlyProblems("http://127.0.0.1:54321", [localKey, otherHostedKey]).length, "any hosted key");
assert.ok(localOnlyProblems(`http://127.0.0.1:54321/?${PRODUCTION_REF}`, [localKey]).length);
assert.ok(localOnlyProblems("", [localKey]).length, "missing URL");
assert.ok(localOnlyProblems("http://127.0.0.1.evil.example:54321", [localKey]).length, "look-alike host");
assert.ok(localOnlyProblems("http://localhost.example.com", [localKey]).length, "look-alike host");

console.log("local-only.test.ts ok");
