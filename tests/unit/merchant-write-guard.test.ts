import assert from "node:assert/strict";
import {
  evaluateMerchantWritePolicy,
  localOnlyIdentityProblems,
  jwtProjectRef,
  PRODUCTION_SUPABASE_REF,
} from "../../src/lib/security/merchant-write-guard";

function policy(env: Record<string, string | undefined>) {
  return evaluateMerchantWritePolicy(env as NodeJS.ProcessEnv);
}

const jwt = (payload: object) =>
  ["e30", Buffer.from(JSON.stringify(payload)).toString("base64url"), "sig"].join(".");
const localKey = jwt({ iss: "supabase-demo", role: "service_role" });
const hostedKey = jwt({ iss: "supabase", ref: PRODUCTION_SUPABASE_REF, role: "service_role" });
const otherHostedKey = jwt({ iss: "supabase", ref: "abcdefghijklmnopqrst", role: "service_role" });

assert.equal(jwtProjectRef(localKey), null);
assert.equal(jwtProjectRef(hostedKey), PRODUCTION_SUPABASE_REF);

assert.deepEqual(localOnlyIdentityProblems("http://127.0.0.1:54321", [localKey]), []);
assert.ok(localOnlyIdentityProblems("http://127.0.0.1:54321", [hostedKey]).length, "tunnel keys");
assert.ok(localOnlyIdentityProblems(`https://${PRODUCTION_SUPABASE_REF}.supabase.co`, [localKey]).length);

assert.equal(
  policy({
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: localKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: localKey,
  }).allowed,
  true,
  "genuine local",
);

assert.equal(
  policy({
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: hostedKey,
  }).allowed,
  false,
  "localhost forwarding Production keys",
);

assert.equal(
  policy({
    NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_REF}.supabase.co`,
    VERCEL_ENV: "preview",
    VERCEL: "1",
    SUPABASE_SERVICE_ROLE_KEY: hostedKey,
  }).allowed,
  false,
  "Preview must not mutate Production",
);

assert.equal(
  policy({
    NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_REF}.supabase.co`,
    VERCEL_ENV: "production",
    VERCEL: "1",
    SUPABASE_SERVICE_ROLE_KEY: hostedKey,
  }).allowed,
  true,
  "Vercel Production may write Production",
);

assert.equal(
  policy({
    NEXT_PUBLIC_SUPABASE_URL: "https://staging-xyz.supabase.co",
    MERCHANT_WRITES_ALLOW_REMOTE: "1",
    SUPABASE_SERVICE_ROLE_KEY: otherHostedKey,
  }).allowed,
  true,
  "approved isolated staging",
);

assert.equal(
  policy({
    NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_REF}.supabase.co`,
    MERCHANT_WRITES_ALLOW_REMOTE: "1",
    SUPABASE_SERVICE_ROLE_KEY: hostedKey,
  }).allowed,
  false,
  "ALLOW_REMOTE cannot target Production",
);

assert.equal(
  policy({
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: localKey,
    MERCHANT_MUTATIONS_DISABLED: "1",
  }).allowed,
  false,
  "explicit disable",
);

assert.equal(policy({}).allowed, false, "missing env");

console.log("merchant-write-guard.test.ts: ok");
