import assert from "node:assert/strict";
import {
  evaluateMerchantWritePolicy,
  PRODUCTION_SUPABASE_REF,
} from "../../src/lib/security/merchant-write-guard";

function policy(env: Record<string, string | undefined>) {
  return evaluateMerchantWritePolicy(env as NodeJS.ProcessEnv);
}

assert.equal(
  policy({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }).allowed,
  true,
  "local supabase allowed",
);

assert.equal(
  policy({
    NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_REF}.supabase.co`,
    VERCEL_ENV: "preview",
    VERCEL: "1",
  }).allowed,
  false,
  "Preview must not mutate Production",
);

assert.equal(
  policy({
    NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_REF}.supabase.co`,
    VERCEL_ENV: "production",
    VERCEL: "1",
  }).allowed,
  true,
  "Vercel Production may write Production after release",
);

assert.equal(
  policy({
    NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_REF}.supabase.co`,
    VERCEL_ENV: "preview",
    MERCHANT_MUTATIONS_DISABLED: "1",
  }).allowed,
  false,
  "explicit disable always blocks",
);

assert.equal(
  policy({
    NEXT_PUBLIC_SUPABASE_URL: "https://staging-xyz.supabase.co",
    VERCEL_ENV: "preview",
  }).allowed,
  false,
  "unknown remote fail-closed",
);

assert.equal(
  policy({
    NEXT_PUBLIC_SUPABASE_URL: "https://staging-xyz.supabase.co",
    MERCHANT_WRITES_ALLOW_REMOTE: "1",
  }).allowed,
  true,
  "opt-in remote staging",
);

console.log("merchant-write-guard.test.ts: ok");
