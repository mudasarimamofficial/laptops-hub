import assert from "node:assert/strict";
import { businessOrderAlert, customerOrderConfirmation, type NotifyOrder } from "../../src/lib/notify/templates";
import { emailConfigured, retryableStatus, safeError, sendEmail } from "../../src/lib/notify/send-email";

const o: NotifyOrder = {
  orderNumber: "LH-261023-A1B2C3", placedAt: "2026-10-23T10:00:00Z", customerName: "Ayesha", phoneNational: "03001234567",
  city: "Lahore", province: "Punjab", items: [{ title: "Dell Latitude 7420", variant: "Default", quantity: 1, lineTotalPaisa: 7_000_000 }],
  subtotalPaisa: 7_000_000, shippingPaisa: 30_000, codFeePaisa: 15_000, totalDuePaisa: 7_045_000, deliveryOption: "Lahore", customerNote: "",
};
const biz = businessOrderAlert(o, "https://x/admin/orders/LH-261023-A1B2C3");
assert.ok(biz.subject.includes("LH-261023-A1B2C3"));
assert.ok(biz.text.includes("03001234567") && biz.text.includes("Lahore, Punjab"), "staff need phone + city");
assert.ok(biz.text.includes("Confirm availability"));
const cust = customerOrderConfirmation(o, "https://x/order/success/tok");
assert.ok(cust.text.includes("https://x/order/success/tok"));
assert.ok(!cust.text.includes("03001234567"), "customer email does not repeat the phone");
assert.ok(!cust.text.includes("Model Town"));

// Errors are stripped of addresses and bounded.
assert.equal(safeError("Invalid `to` field: buyer@example.com is not allowed"), "Invalid `to` field: <email> is not allowed");
assert.ok(safeError("x".repeat(500)).length <= 200);

// Without provider settings nothing is sent and nothing is reported as sent.
delete process.env.RESEND_API_KEY;
delete process.env.STORE_FROM_EMAIL;
assert.equal(emailConfigured(), false);
(async () => {
  const r = await sendEmail({ to: "a@b.c", subject: "s", text: "t", idempotencyKey: "k" });
  assert.deepEqual(r, { ok: false, error: "not_configured", retryable: true });
  console.log("notify.test.ts ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Provider errors: temporary vs permanent (Resend error reference).
assert.equal(retryableStatus(409, "concurrent_idempotent_requests"), true);
assert.equal(retryableStatus(409, "resource_locked"), true);
assert.equal(retryableStatus(409, "invalid_idempotent_request"), false, "same key, different body: never fixed by retrying");
assert.equal(retryableStatus(409, undefined), false);
assert.equal(retryableStatus(429), true);
assert.equal(retryableStatus(503), true);
assert.equal(retryableStatus(422), false);
assert.equal(retryableStatus(401), false);
