import assert from "node:assert/strict";
import { processContact, type ContactDeps, type ContactRow } from "../../src/lib/validation/contact";

const URL_ = "https://laptops-hub.example/api/contact";
function deps() {
  const rows: ContactRow[] = [];
  const d: ContactDeps = { rateLimit: async () => ({ ok: true }), insert: async (row) => (rows.push(row), { error: null }) };
  return { d, rows };
}
const run = (body: unknown, d: ContactDeps) => processContact({ origin: "https://laptops-hub.example", url: URL_, ip: "1.2.3.4", body }, d);
const base = { source: "home", name: "Bilal", message: "Need a laptop for coding, around 16GB RAM." };

(async () => {
  // Phone only is enough; the server writes the subject and appends the options as labelled lines.
  {
    const { d, rows } = deps();
    const r = await run({ ...base, phone: "0300 1234567", topic: "Laptop recommendation", budget: "Rs 40,000 – 60,000", useCase: "Programming", preferred: "call" }, d);
    assert.equal(r.status, 200);
    assert.equal(rows[0].subject, "Homepage inquiry · Laptop recommendation");
    assert.equal(rows[0].email, null);
    assert.equal(rows[0].message, `${base.message}\n\nBudget: Rs 40,000 – 60,000\nUse: Programming\nPreferred contact: phone call`);
  }
  // Email only, no options: no detail lines; default topic.
  {
    const { d, rows } = deps();
    assert.equal((await run({ ...base, email: "b@example.com" }, d)).status, 200);
    assert.equal(rows[0].subject, "Homepage inquiry · General inquiry");
    assert.equal(rows[0].message, base.message);
  }
  // Client cannot set the subject of a homepage inquiry.
  {
    const { d, rows } = deps();
    await run({ ...base, email: "b@example.com", subject: "URGENT REFUND" }, d);
    assert.equal(rows[0].subject, "Homepage inquiry · General inquiry");
  }
  // Refused: no contact method; preferred method not supplied; unknown option values; over-long fields.
  for (const bad of [
    { ...base },
    { ...base, email: "b@example.com", preferred: "call" },
    { ...base, phone: "03001234567", preferred: "email" },
    { ...base, phone: "03001234567", preferred: "whatsapp" },
    { ...base, phone: "03001234567", topic: "Refund" },
    { ...base, phone: "03001234567", budget: "Rs 1" },
    { ...base, phone: "03001234567", useCase: "x".repeat(121) },
    { ...base, phone: "03001234567", message: "x".repeat(4001) },
    { ...base, phone: "12" },
  ]) {
    const { d, rows } = deps();
    const r = await run(bad, d);
    assert.equal(r.status, 400, JSON.stringify(bad).slice(0, 80));
    assert.equal(rows.length, 0);
  }
  // Contact page submissions keep their own subject.
  {
    const { d, rows } = deps();
    await run({ name: "Sara", email: "s@example.com", subject: "Existing order", message: "Where is my order?" }, d);
    assert.equal(rows[0].subject, "Existing order");
  }
  console.log("home-inquiry.test.ts ok");
})();
