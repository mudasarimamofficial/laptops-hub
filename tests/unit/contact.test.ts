import assert from "node:assert/strict";
import { isCrossSite, processContact, type ContactDeps, type ContactRow } from "../../src/lib/validation/contact";

const URL_ = "https://laptops-hub.example/api/contact";
function deps(opts: { limited?: boolean; insertError?: string } = {}) {
  const rows: ContactRow[] = [];
  const d: ContactDeps = {
    rateLimit: async () => (opts.limited ? { ok: false, retryAfterSec: 900 } : { ok: true }),
    insert: async (row) => {
      if (opts.insertError) return { error: opts.insertError };
      rows.push(row);
      return { error: null };
    },
  };
  return { d, rows };
}
const valid = { name: "Ayesha", email: "a@example.com", subject: "Product question", message: "Is the T490 still available?" };
const run = (body: unknown, d: ContactDeps, origin: string | null = "https://laptops-hub.example") => processContact({ origin, url: URL_, ip: "1.2.3.4", body }, d);

(async () => {
  // Success only after a stored row.
  {
    const { d, rows } = deps();
    const r = await run(valid, d);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ok: true });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].email, "a@example.com");
    assert.equal(rows[0].phone, null);
  }
  // Storage failure is reported, never a fake success.
  {
    const { d } = deps({ insertError: "db down" });
    const r = await run(valid, d);
    assert.equal(r.status, 500);
    assert.equal(r.body.error, "submit_failed");
  }
  // Honeypot: nothing stored.
  {
    const { d, rows } = deps();
    const r = await run({ ...valid, company: "spam inc" }, d);
    assert.equal(r.status, 200);
    assert.equal(rows.length, 0);
  }
  // Rate limit.
  {
    const { d, rows } = deps({ limited: true });
    const r = await run(valid, d);
    assert.equal(r.status, 429);
    assert.equal(r.headers?.["Retry-After"], "900");
    assert.equal(rows.length, 0);
  }
  // Validation: no contact route, bad phone, bad email, short message, missing name.
  for (const bad of [
    { name: "Ayesha", message: "Hello there friend" },
    { ...valid, phone: "12ab" },
    { ...valid, email: "not-an-email" },
    { ...valid, message: "hi" },
    { ...valid, name: "" },
  ]) {
    const { d, rows } = deps();
    const r = await run(bad, d);
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.equal(rows.length, 0);
  }
  // Phone-only inquiry (product dialog) is accepted.
  {
    const { d, rows } = deps();
    const r = await run({ name: "Bilal", phone: "0300 1234567", message: "Availability inquiry: Dell 5400" }, d);
    assert.equal(r.status, 200);
    assert.equal(rows[0].phone, "0300 1234567");
  }
  // Cross-site browser POST rejected; same-origin and no-Origin (server/tests) allowed.
  {
    const { d, rows } = deps();
    assert.equal((await run(valid, d, "https://evil.example")).status, 403);
    assert.equal(rows.length, 0);
    assert.equal((await run(valid, d, null)).status, 200);
  }
  // Same site addressed by another name than request.url (server bound to 127.0.0.1, URL built as localhost; or
  // the proxy's forwarded host): allowed. A Host header never makes a different site acceptable.
  {
    const { d, rows } = deps();
    const viaHost = (origin: string, host: string | null) => processContact({ origin, url: "http://localhost:3001/api/contact", host, ip: "1.2.3.4", body: valid }, d);
    assert.equal((await viaHost("http://127.0.0.1:3001", "127.0.0.1:3001")).status, 200);
    assert.equal((await viaHost("https://laptops-hub.vercel.app", "laptops-hub.vercel.app")).status, 200);
    assert.equal((await viaHost("https://evil.example", "laptops-hub.vercel.app")).status, 403);
    assert.equal((await viaHost("https://evil.example", null)).status, 403);
    assert.equal(isCrossSite("not a url", "http://localhost:3001/", "localhost:3001"), true);
    assert.equal(rows.length, 2);
  }
  console.log("contact.test.ts ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
