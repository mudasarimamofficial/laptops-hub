/**
 * Preview safety gate: a Preview deployment wired to the Production Supabase project (or any deployment with
 * MERCHANT_MUTATIONS_DISABLED=1) must refuse every public/auth write BEFORE any network call. The real route handlers
 * are invoked; a global fetch trap records and refuses every outbound request, so this test can never reach a real
 * Supabase project even if a guard regressed.
 */
import assert from "node:assert/strict";
import { PRODUCTION_SUPABASE_REF } from "../../src/lib/security/merchant-write-guard";

const outbound: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL) => {
  outbound.push(String(input instanceof Request ? input.url : input));
  throw new Error("network disabled in preview-read-only test");
}) as typeof fetch;

const jwt = (payload: object) => ["e30", Buffer.from(JSON.stringify(payload)).toString("base64url"), "sig"].join(".");
const prodKey = jwt({ iss: "supabase", ref: PRODUCTION_SUPABASE_REF, role: "service_role" });
const localKey = jwt({ iss: "supabase-demo", role: "service_role" });

const BASE = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_REF}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: prodKey,
  SUPABASE_SERVICE_ROLE_KEY: prodKey,
  // Deliberately ON: the read-only guard must win even if COD flags leak into a Preview.
  COD_CHECKOUT_ENABLED: "true",
  NEXT_PUBLIC_COD_CHECKOUT_ENABLED: "true",
  CRON_SECRET: "preview-test-secret",
};
const SCENARIOS: Array<{ name: string; env: Record<string, string> }> = [
  { name: "Vercel Preview + Production Supabase", env: { ...BASE, VERCEL: "1", VERCEL_ENV: "preview" } },
  {
    name: "Vercel Preview + Production Supabase + MERCHANT_MUTATIONS_DISABLED=1",
    env: { ...BASE, VERCEL: "1", VERCEL_ENV: "preview", MERCHANT_MUTATIONS_DISABLED: "1" },
  },
  {
    name: "MERCHANT_MUTATIONS_DISABLED=1 even on a genuine local stack",
    env: {
      ...BASE,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: localKey,
      SUPABASE_SERVICE_ROLE_KEY: localKey,
      MERCHANT_MUTATIONS_DISABLED: "1",
    },
  },
];

function setEnv(env: Record<string, string>) {
  for (const k of ["VERCEL", "VERCEL_ENV", "MERCHANT_MUTATIONS_DISABLED", "MERCHANT_WRITES_ALLOW_REMOTE"]) delete process.env[k];
  Object.assign(process.env, env);
}

const ORIGIN = "https://laptops-hub-preview.vercel.app";
const json = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, host: new URL(ORIGIN).host, "x-forwarded-for": "203.0.113.7", ...headers },
    body: JSON.stringify(body),
  });

async function main() {
  const { publicWritesAllowed } = await import("../../src/lib/security/public-write-guard");
  const { rateLimit } = await import("../../src/lib/security/rate-limit");
  const contact = await import("../../src/app/api/contact/route");
  const reviews = await import("../../src/app/api/reviews/route");
  const cod = await import("../../src/app/api/checkout/cod/route");
  const recover = await import("../../src/app/api/admin/account/recover/route");
  const password = await import("../../src/app/api/admin/account/password/route");
  const cron = await import("../../src/app/api/cron/notifications/route");

  const routes: Array<[string, () => Promise<Response>]> = [
    ["POST /api/contact", () => contact.POST(json("/api/contact", { name: "QA", phone: "03001234567", message: "Preview test" }))],
    ["POST /api/reviews", () => reviews.POST(json("/api/reviews", { handle: "qa", rating: 5, name: "QA", body: "Preview test body text" }))],
    ["POST /api/checkout/cod", () => cod.POST(json("/api/checkout/cod", { items: [] }))],
    ["POST /api/admin/account/recover", () => recover.POST(json("/api/admin/account/recover", { email: "qa@example.invalid" }))],
    ["POST /api/admin/account/password", () => password.POST(json("/api/admin/account/password", { password: "x".repeat(16) }))],
    [
      "GET /api/cron/notifications",
      () => cron.GET(new Request(`${ORIGIN}/api/cron/notifications`, { headers: { authorization: "Bearer preview-test-secret" } })),
    ],
  ];

  let checks = 0;
  for (const s of SCENARIOS) {
    setEnv(s.env);
    assert.equal(publicWritesAllowed(), false, `${s.name}: writes must be refused`);
    for (const [name, call] of routes) {
      outbound.length = 0;
      const res = await call();
      const body = (await res.json()) as { error?: string };
      assert.equal(res.status, 503, `${s.name} → ${name}: status ${res.status}`);
      assert.equal(body.error, "preview_read_only", `${s.name} → ${name}: ${body.error}`);
      assert.equal(res.headers.get("cache-control"), "no-store", `${s.name} → ${name}: no-store`);
      assert.deepEqual(outbound, [], `${s.name} → ${name}: made a network call`);
      checks++;
    }
    // Rate limiting (used by quote + order lookup) stays in memory: no consume_rate_limit RPC.
    outbound.length = 0;
    const r = await rateLimit(`preview-test:${s.name}`, { limit: 2, windowMs: 60_000 });
    assert.equal(r.ok, true);
    await rateLimit(`preview-test:${s.name}`, { limit: 2, windowMs: 60_000 });
    const third = await rateLimit(`preview-test:${s.name}`, { limit: 2, windowMs: 60_000 });
    assert.equal(third.ok, false, `${s.name}: in-memory limiter still enforces`);
    assert.deepEqual(outbound, [], `${s.name}: rate limiter made a network call`);
    checks++;
  }

  // Production and genuine local stacks are unchanged (allowed); routes are not invoked here.
  setEnv({ ...BASE, VERCEL: "1", VERCEL_ENV: "production" });
  assert.equal(publicWritesAllowed(), true, "Vercel production + Production Supabase stays writable");
  setEnv({ ...BASE, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_ANON_KEY: localKey, SUPABASE_SERVICE_ROLE_KEY: localKey });
  assert.equal(publicWritesAllowed(), true, "genuine local stack stays writable");
  checks += 2;

  console.log(`preview-read-only: ${checks} checks passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
