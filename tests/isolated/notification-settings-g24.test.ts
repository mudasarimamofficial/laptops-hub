/**
 * G24 notification settings against a LOCAL Supabase and the fake Resend (scripts/test-fixtures/fake-resend.mjs).
 * Covers: saved staff recipients (several), customer-email modes off / test / on, custom subjects and intro, inquiry
 * alerts (staff only), an edited message between a failure and its retry (versioned idempotency key, no permanent
 * 409), and the hosting fallback when the saved list is empty. Restores store_settings afterwards.
 *
 *   set -a && . ./.env.local && set +a && npx tsx tests/isolated/notification-settings-g24.test.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { processOutbox } from "../../src/lib/notify/outbox";
import { NOTIFICATIONS_KEY } from "../../src/lib/notify/settings";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

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
const fixture = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const ENV_BUSINESS = (process.env.STORE_NOTIFY_EMAIL || "").toLowerCase();
const STAFF = ["alerts-a@lh-test.local", "alerts-b@lh-test.local"];

type Delivered = { id: string; key: string | null; to: string[]; subject?: string; text?: string };
const provider = {
  reset: () => fetch(`${fake}/_reset`, { method: "POST" }),
  mode: (m: { fail?: boolean; failTo?: string | null; delayMs?: number }) => fetch(`${fake}/_mode`, { method: "POST", body: JSON.stringify(m) }),
  log: async () => (await (await fetch(`${fake}/_log`)).json()) as { delivered: Delivered[]; attempts: number },
};

async function setNotify(value: Record<string, unknown> | null) {
  if (value === null) assert.ifError((await sb.from("store_settings").delete().eq("key", NOTIFICATIONS_KEY)).error);
  else assert.ifError((await sb.from("store_settings").upsert({ key: NOTIFICATIONS_KEY, value })).error);
}
const base = { recipients: STAFF, customer_mode: "off", inquiry_alerts: true, order_subject: "", customer_subject: "", customer_intro: "" };

async function newOrder() {
  const email = `buyer-g24-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@lh-test.local`;
  const { data, error } = await sb.rpc("create_cod_order", {
    payload: {
      idempotency_key: `g24-test-${randomUUID()}`,
      customer_name: "Outbox Test",
      customer_phone_e164: "+923001234567",
      customer_phone_normalized: "923001234567",
      customer_email: email,
      customer_note: "",
      shipping_zone_id: fixture.zone.id,
      confirmation_version: "cod-v2-terms-returns-privacy",
      ip_hash: null,
      user_agent: "notification-settings-g24-test",
      address: { line1: "House 1, Test Street", line2: "", city: fixture.zone.city, province: fixture.zone.province, postcode: "", landmark: "" },
      lines: [{ variant_id: fixture.products[0].variantId, quantity: 1 }],
    },
  });
  if (error) throw new Error(`create_cod_order: ${error.message}`);
  const orderId = (data as { order_id: string }).order_id;
  const { data: o } = await sb.from("orders").select("order_number").eq("id", orderId).single();
  return { orderId, email, orderNumber: o!.order_number as string };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- row shape asserted field by field
const outboxRow = async (orderId: string) => (await sb.from("notification_outbox").select("*").eq("order_id", orderId).single()).data as Record<string, any>;
const deliveredFor = async (outboxId: string) => (await provider.log()).delivered.filter((d) => d.key?.startsWith(`outbox-${outboxId}-`));

const results: string[] = [];
async function scenario(name: string, fn: () => Promise<void>) {
  await provider.reset();
  await fn();
  results.push(name);
  console.log(`ok - ${name}`);
}

async function main() {
  await assertLocalOnly("notification-settings-g24");
  const prevCod = (await sb.from("store_settings").select("value").eq("key", "cod_checkout").maybeSingle()).data?.value ?? null;
  const prevNotify = (await sb.from("store_settings").select("value").eq("key", NOTIFICATIONS_KEY).maybeSingle()).data?.value ?? null;
  assert.ifError((await sb.from("store_settings").upsert({ key: "cod_checkout", value: { enabled: true } })).error);
  const inquiryIds: string[] = [];
  try {
    await scenario("saved staff recipients get one order alert; customer mode off skips the customer", async () => {
      await setNotify(base);
      const { orderId, email } = await newOrder();
      const run = await processOutbox({ orderId });
      assert.equal(run.configured, true);
      const r = await outboxRow(orderId);
      assert.equal(r.status, "accepted");
      assert.equal(r.business_status, "accepted");
      assert.equal(r.customer_status, "skipped");
      const d = await deliveredFor(r.id);
      assert.equal(d.length, 1, "one message to all staff recipients");
      assert.deepEqual([...d[0].to].sort(), [...STAFF].sort());
      assert.ok(!d.some((x) => x.to.includes(email)), "customer not emailed");
      assert.ok(!d.some((x) => x.to.includes(ENV_BUSINESS)), "hosting fallback not used when staff emails are saved");
      assert.match(d[0].key!, new RegExp(`^outbox-${r.id}-business-[a-z0-9]+$`), "versioned key with merchant settings");
    });

    await scenario("test mode: the customer copy goes to staff only, marked as a test; customer stays skipped", async () => {
      await setNotify({ ...base, customer_mode: "test", customer_subject: "Order {order} received", customer_intro: "Test intro line." });
      const { orderId, email, orderNumber } = await newOrder();
      await processOutbox({ orderId });
      const r = await outboxRow(orderId);
      assert.equal(r.status, "accepted");
      assert.equal(r.customer_status, "skipped");
      assert.ok(r.customer_message_id, "test copy recorded");
      const d = await deliveredFor(r.id);
      assert.equal(d.length, 2);
      assert.ok(!d.some((x) => x.to.includes(email)), "NO customer email in test mode");
      const copy = d.find((x) => x.key?.includes("-customer-test-"))!;
      assert.ok(copy, "customer copy sent under its own key");
      assert.deepEqual([...copy.to].sort(), [...STAFF].sort());
      assert.equal(copy.subject, `[Test — customer copy] Order ${orderNumber} received`);
      assert.ok(copy.text!.includes("Test intro line.") && !copy.text!.includes("Our team reviews every order"));
    });

    await scenario("on: customer receives the custom subject; staff alert uses the custom subject", async () => {
      await setNotify({ ...base, customer_mode: "on", order_subject: "Call customer — {order} ({total})", customer_subject: "Thanks for order {order}" });
      const { orderId, email, orderNumber } = await newOrder();
      await processOutbox({ orderId });
      const r = await outboxRow(orderId);
      assert.equal(r.status, "accepted");
      assert.equal(r.customer_status, "accepted");
      const d = await deliveredFor(r.id);
      const cust = d.find((x) => x.to.includes(email))!;
      assert.equal(cust.subject, `Thanks for order ${orderNumber}`);
      assert.equal(cust.to.length, 1, "customer email goes to the customer only");
      const biz = d.find((x) => x.key?.includes("-business-"))!;
      assert.match(biz.subject!, new RegExp(`^Call customer — ${orderNumber} \\(Rs`));
    });

    await scenario("inquiry alert: staff only, the person who wrote in is never emailed", async () => {
      await setNotify(base);
      const id = randomUUID();
      inquiryIds.push(id);
      assert.ifError((await sb.from("contact_inquiries").insert({ id, name: "G24 Inquiry Test", phone: "03001234567", email: "inquirer@lh-test.local", subject: "Need advice", message: "Which laptop for study?" })).error);
      const { data: ob, error } = await sb.from("notification_outbox").insert({ order_id: null, channel: "email", template: "contact_inquiry", payload: { inquiry_id: id } }).select("id").single();
      assert.ifError(error);
      await processOutbox({ limit: 10 });
      const r = (await sb.from("notification_outbox").select("*").eq("id", ob!.id).single()).data!;
      assert.equal(r.status, "accepted");
      assert.equal(r.business_status, "accepted");
      assert.equal(r.customer_status, "skipped");
      const d = await deliveredFor(ob!.id);
      assert.equal(d.length, 1);
      assert.deepEqual([...d[0].to].sort(), [...STAFF].sort());
      assert.ok(!d[0].to.includes("inquirer@lh-test.local"));
      assert.equal(d[0].subject, "New website inquiry — Need advice");
      assert.ok(d[0].text!.includes("Which laptop for study?") && d[0].text!.includes("/admin/inquiries"));
    });

    await scenario("inquiry alert for a missing inquiry fails visibly instead of sending", async () => {
      const { data: ob } = await sb.from("notification_outbox").insert({ order_id: null, channel: "email", template: "contact_inquiry", payload: { inquiry_id: randomUUID() } }).select("id").single();
      await processOutbox({ limit: 10 });
      const r = (await sb.from("notification_outbox").select("*").eq("id", ob!.id).single()).data!;
      assert.equal(r.status, "failed");
      assert.match(r.last_error, /inquiry_not_found/);
      assert.equal((await deliveredFor(ob!.id)).length, 0);
      await sb.from("notification_outbox").update({ attempts: 5, last_error: "isolated test row · automatic retries stopped" }).eq("id", ob!.id);
    });

    await scenario("message edited between a failure and the retry: delivered once, no permanent 409", async () => {
      await setNotify({ ...base, order_subject: "First wording {order}" });
      const { orderId } = await newOrder();
      await provider.mode({ fail: true });
      await processOutbox({ orderId });
      let r = await outboxRow(orderId);
      assert.equal(r.status, "failed");
      assert.ok(!String(r.last_error).includes("automatic retries stopped"), "temporary failure keeps retrying");
      await provider.mode({ fail: false });
      await setNotify({ ...base, order_subject: "Second wording {order}" });
      await processOutbox({ orderId, manual: true });
      r = await outboxRow(orderId);
      assert.equal(r.status, "accepted");
      const d = await deliveredFor(r.id);
      assert.equal(d.length, 1);
      assert.ok(d[0].subject!.startsWith("Second wording"));
    });

    await scenario("saved list empty: alerts keep going to the hosting fallback address", async () => {
      await setNotify({ ...base, recipients: [] });
      const { orderId } = await newOrder();
      await processOutbox({ orderId });
      const r = await outboxRow(orderId);
      assert.equal(r.status, "accepted");
      const d = await deliveredFor(r.id);
      assert.deepEqual(d.map((x) => x.to), [[ENV_BUSINESS]]);
    });

    console.log(`\n${results.length} G24 notification scenarios passed`);
  } finally {
    if (prevNotify) await sb.from("store_settings").upsert({ key: NOTIFICATIONS_KEY, value: prevNotify });
    else await sb.from("store_settings").delete().eq("key", NOTIFICATIONS_KEY);
    if (prevCod) await sb.from("store_settings").upsert({ key: "cod_checkout", value: prevCod });
    if (inquiryIds.length) await sb.from("contact_inquiries").delete().in("id", inquiryIds);
    const ids = ((await sb.from("orders").select("id").eq("customer_name", "Outbox Test")).data || []).map((o) => o.id);
    if (ids.length) {
      await sb.from("notification_outbox")
        .update({ status: "failed", claim_token: null, attempts: 5, last_error: "isolated test row · automatic retries stopped" })
        .in("order_id", ids)
        .neq("status", "accepted");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
