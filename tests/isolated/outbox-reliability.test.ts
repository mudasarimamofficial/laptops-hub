/**
 * Notification outbox reliability against a LOCAL Supabase and the fake Resend (scripts/test-fixtures/fake-resend.mjs).
 * Covers: concurrent workers, lease-age (not row-age) recovery, an expired worker that resumes, a crash between
 * provider acceptance and the database write, partial delivery, a timeout the provider still accepted, bounded
 * retries, the retry window, manual retry, customer skipped, not configured, and RPC permissions.
 *
 * Requires (see docs/ISOLATED_TESTS.md): local stack with all migrations, seed-isolated.mjs run (.isolated/fixture.json),
 * fake-resend on RESEND_API_URL, and the isolated env (service key, RESEND_API_KEY, STORE_* etc.).
 *   npx tsx tests/isolated/outbox-reliability.test.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { processOutbox, type OutboxRow } from "../../src/lib/notify/outbox";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url)) {
  console.error("Refusing to run: NEXT_PUBLIC_SUPABASE_URL must be a local Supabase.");
  process.exit(2);
}
const fake = process.env.RESEND_API_URL || "";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(fake)) {
  console.error("Refusing to run: RESEND_API_URL must point at the local fake provider.");
  process.exit(2);
}
const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const fixture = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const BUSINESS = process.env.STORE_NOTIFY_EMAIL!;

type Delivered = { id: string; key: string | null; to: string[] };
const provider = {
  reset: () => fetch(`${fake}/_reset`, { method: "POST" }),
  mode: (m: { fail?: boolean; failTo?: string | null; delayMs?: number }) =>
    fetch(`${fake}/_mode`, { method: "POST", body: JSON.stringify(m) }),
  log: async () => (await (await fetch(`${fake}/_log`)).json()) as { delivered: Delivered[]; attempts: number },
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let seq = 0;
async function newOrder(withEmail = true) {
  seq++;
  const email = withEmail ? `buyer-${seq}-${Date.now()}@lh-test.local` : null;
  const { data, error } = await sb.rpc("create_cod_order", {
    payload: {
      idempotency_key: `outbox-test-${randomUUID()}`,
      customer_name: "Outbox Test",
      customer_phone_e164: "+923001234567",
      customer_phone_normalized: "923001234567",
      customer_email: email,
      customer_note: "",
      shipping_zone_id: fixture.zone.id,
      confirmation_version: "cod-v2-terms-returns-privacy",
      ip_hash: null,
      user_agent: "outbox-reliability-test",
      address: { line1: "House 1, Test Street", line2: "", city: fixture.zone.city, province: fixture.zone.province, postcode: "", landmark: "" },
      lines: [{ variant_id: fixture.products[0].variantId, quantity: 1 }],
    },
  });
  if (error) throw new Error(`create_cod_order: ${error.message}`);
  const orderId = (data as { order_id: string }).order_id;
  return { orderId, email };
}
async function row(orderId: string) {
  const { data, error } = await sb.from("notification_outbox").select("*").eq("order_id", orderId).single();
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- row shape asserted field by field below
  return data as Record<string, any>;
}
const patch = async (orderId: string, p: Record<string, unknown>) => {
  const { error } = await sb.from("notification_outbox").update(p).eq("order_id", orderId);
  if (error) throw error;
};
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const deliveredFor = async (orderId: string, outboxId: string) =>
  (await provider.log()).delivered.filter((d) => d.key?.startsWith(`outbox-${outboxId}-`));

const results: string[] = [];
async function scenario(name: string, fn: () => Promise<void>) {
  await provider.reset();
  await fn();
  results.push(name);
  console.log(`ok - ${name}`);
}

async function main() {
await scenario("concurrent workers claim a row once; each recipient delivered once", async () => {
  const { orderId, email } = await newOrder();
  await provider.mode({ delayMs: 300 });
  const runs = await Promise.all(Array.from({ length: 6 }, () => processOutbox({ orderId })));
  assert.equal(runs.reduce((s, r) => s + r.processed, 0), 1, "exactly one worker claimed the row");
  const r = await row(orderId);
  assert.equal(r.status, "accepted");
  assert.equal(r.business_status, "accepted");
  assert.equal(r.customer_status, "accepted");
  assert.ok(r.business_message_id && r.customer_message_id && r.business_accepted_at && r.customer_accepted_at);
  assert.equal(r.claim_token, null);
  const d = await deliveredFor(orderId, r.id);
  assert.deepEqual(d.map((x) => x.to[0]).sort(), [BUSINESS, email].sort());
});

await scenario("stale recovery uses lease age, not row age", async () => {
  // Old row, fresh claim: a worker is still sending — must NOT be taken over (the old created_at rule would).
  const a = await newOrder();
  await patch(a.orderId, { created_at: ago(3_600_000), status: "sending", claim_token: randomUUID(), claimed_at: ago(10_000), attempts: 1, first_attempt_at: ago(10_000) });
  assert.equal((await processOutbox({ orderId: a.orderId })).processed, 0, "live lease is respected");
  assert.equal((await row(a.orderId)).status, "sending");
  // New row, expired claim: the worker died — recovered.
  const b = await newOrder();
  await patch(b.orderId, { status: "sending", claim_token: randomUUID(), claimed_at: ago(600_000), attempts: 1, first_attempt_at: ago(600_000) });
  const res = await processOutbox({ orderId: b.orderId });
  assert.equal(res.processed, 1);
  const r = await row(b.orderId);
  assert.equal(r.status, "accepted");
  assert.equal(r.attempts, 2);
});

await scenario("an expired worker cannot overwrite the result of the worker that took over", async () => {
  const { orderId } = await newOrder();
  let takeover: Awaited<ReturnType<typeof processOutbox>> | null = null;
  const stalled = await processOutbox({ orderId }, {
    afterAccepted: async (r: OutboxRow, recipient) => {
      if (recipient !== "business" || takeover) return;
      // Worker A stalls past its lease; worker B reclaims and completes.
      await sb.from("notification_outbox").update({ claimed_at: ago(600_000) }).eq("id", r.id);
      takeover = await processOutbox({ orderId });
    },
  });
  assert.equal(takeover!.processed, 1);
  assert.equal(takeover!.accepted, 1);
  assert.equal(stalled.lost, 1, "the expired worker detects it lost the lease");
  const r = await row(orderId);
  assert.equal(r.status, "accepted");
  assert.equal(r.claim_token, null);
  const d = await deliveredFor(orderId, r.id);
  assert.equal(d.filter((x) => x.to[0] === BUSINESS).length, 1, "business alert delivered once despite two sends");
});

await scenario("crash after provider acceptance, before the database write, does not duplicate", async () => {
  const { orderId } = await newOrder();
  const crashed = await processOutbox({ orderId }, {
    afterAccepted: (_r, recipient) => {
      if (recipient === "business") throw new Error("simulated crash / database unavailable");
    },
  });
  assert.equal(crashed.lost, 1);
  let r = await row(orderId);
  assert.equal(r.status, "sending");
  assert.equal(r.business_status, "pending", "acceptance was not recorded");
  await patch(orderId, { claimed_at: ago(600_000) }); // lease expires
  const res = await processOutbox({ orderId });
  assert.equal(res.accepted, 1);
  r = await row(orderId);
  const d = await deliveredFor(orderId, r.id);
  assert.equal(d.filter((x) => x.to[0] === BUSINESS).length, 1, "provider de-duplicated by idempotency key");
  assert.equal(r.business_message_id, d.find((x) => x.to[0] === BUSINESS)!.id);
});

await scenario("partial delivery: failed recipient retried alone after backoff", async () => {
  const { orderId, email } = await newOrder();
  await provider.mode({ failTo: email });
  const first = await processOutbox({ orderId });
  assert.equal(first.failed, 1);
  let r = await row(orderId);
  assert.equal(r.status, "failed");
  assert.equal(r.business_status, "accepted");
  assert.equal(r.customer_status, "failed");
  assert.match(r.last_error, /^customer: 500/);
  assert.ok(new Date(r.next_attempt_at).getTime() > Date.now(), "backoff scheduled");
  assert.equal((await processOutbox({ orderId })).processed, 0, "not retried before backoff");
  await provider.mode({});
  await patch(orderId, { next_attempt_at: ago(1000) });
  assert.equal((await processOutbox({ orderId })).accepted, 1);
  r = await row(orderId);
  assert.equal(r.status, "accepted");
  assert.equal(r.last_error, null);
  const d = await deliveredFor(orderId, r.id);
  assert.equal(d.filter((x) => x.to[0] === BUSINESS).length, 1, "business not resent");
  assert.equal(d.filter((x) => x.to[0] === email).length, 1);
});

await scenario("timeout while the provider still accepts: retry does not duplicate", async () => {
  const { orderId } = await newOrder(false);
  process.env.NOTIFY_TIMEOUT_MS = "200";
  await provider.mode({ delayMs: 700 });
  const first = await processOutbox({ orderId });
  assert.equal(first.failed, 1);
  assert.match((await row(orderId)).last_error, /business: .*(abort|timeout)/i);
  await sleep(800); // the provider finishes accepting the first request
  delete process.env.NOTIFY_TIMEOUT_MS;
  await provider.mode({});
  await patch(orderId, { next_attempt_at: ago(1000) });
  assert.equal((await processOutbox({ orderId })).accepted, 1);
  const r = await row(orderId);
  assert.equal((await deliveredFor(orderId, r.id)).length, 1, "one delivery");
});

await scenario("customer without email is skipped; only the store alert is sent", async () => {
  const { orderId } = await newOrder(false);
  await processOutbox({ orderId });
  const r = await row(orderId);
  assert.equal(r.status, "accepted");
  assert.equal(r.customer_status, "skipped");
  assert.deepEqual((await deliveredFor(orderId, r.id)).map((x) => x.to[0]), [BUSINESS]);
});

await scenario("bounded retries: stops after max attempts, stays visible, manual retry works", async () => {
  const { orderId } = await newOrder(false);
  await provider.mode({ fail: true });
  for (let i = 0; i < 5; i++) {
    await patch(orderId, { next_attempt_at: ago(1000) });
    assert.equal((await processOutbox({ orderId })).processed, 1, `attempt ${i + 1}`);
  }
  await patch(orderId, { next_attempt_at: ago(1000) });
  assert.equal((await processOutbox({ orderId })).processed, 0, "no sixth automatic attempt");
  let r = await row(orderId);
  assert.equal(r.status, "failed");
  assert.equal(r.attempts, 5);
  assert.match(r.last_error, /automatic retries stopped$/);
  assert.equal((await provider.log()).attempts, 5, "provider called exactly 5 times");
  await processOutbox({ orderId }); // a second sweep does not append the marker again
  assert.equal((await row(orderId)).last_error.match(/automatic retries stopped/g).length, 1);
  await provider.mode({});
  const manual = await processOutbox({ orderId, manual: true });
  assert.equal(manual.accepted, 1, "staff retry");
  r = await row(orderId);
  assert.equal(r.status, "accepted");
});

await scenario("retry window: no automatic retry outside the provider's 24-hour idempotency retention", async () => {
  const { orderId } = await newOrder(false);
  await patch(orderId, { status: "failed", attempts: 1, first_attempt_at: ago(24 * 3_600_000), next_attempt_at: ago(1000), last_error: "business: 500" });
  assert.equal((await processOutbox({ orderId })).processed, 0);
  const r = await row(orderId);
  assert.equal(r.status, "failed");
  assert.match(r.last_error, /automatic retries stopped$/);
  assert.equal((await provider.log()).attempts, 0);
});

await scenario("not configured: nothing claimed, nothing reported as sent", async () => {
  const { orderId } = await newOrder(false);
  const key = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    const res = await processOutbox({ orderId });
    assert.equal(res.configured, false);
    assert.equal(res.processed, 0);
  } finally {
    process.env.RESEND_API_KEY = key;
  }
  const r = await row(orderId);
  assert.equal(r.status, "pending");
  assert.equal(r.attempts, 0);
});

await scenario("claim_notifications is not callable by anon", async () => {
  const { error } = await anon.rpc("claim_notifications", {});
  assert.ok(error, "anon must be refused");
});

// Leave nothing automatically claimable behind (still visible, clearly labelled as test rows).
const ids = ((await sb.from("orders").select("id").eq("customer_name", "Outbox Test")).data || []).map((o) => o.id);
if (ids.length) {
  await sb.from("notification_outbox")
    .update({ status: "failed", claim_token: null, attempts: 5, last_error: "isolated test row · automatic retries stopped" })
    .in("order_id", ids)
    .neq("status", "accepted");
}
console.log(`\n${results.length} outbox reliability scenarios passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
