import assert from "node:assert/strict";
import {
  cleanLine,
  fillSubject,
  fingerprint,
  maskEmail,
  normaliseRecipients,
  notificationSettingsSchema,
  parseNotificationSettings,
  toStored,
} from "../../src/lib/notify/settings";
import { businessInquiryAlert, customerOrderConfirmation, testMessage, type NotifyOrder } from "../../src/lib/notify/templates";

// No stored row: the previous environment behaviour, unchanged.
const envOnly = parseNotificationSettings(null, { STORE_NOTIFY_EMAIL: "Shop@Example.com", NOTIFY_CUSTOMER_EMAIL: "1" });
assert.deepEqual(envOnly.recipients, ["shop@example.com"]);
assert.equal(envOnly.customerMode, "on");
assert.equal(envOnly.inquiryAlerts, false);
assert.equal(envOnly.source, "env");
assert.equal(parseNotificationSettings(null, {}).customerMode, "off");
assert.deepEqual(parseNotificationSettings(null, {}).recipients, []);

// Stored settings win; an empty saved list keeps the hosting fallback (alerts are never silenced by accident).
const stored = parseNotificationSettings(
  { recipients: ["a@x.pk", "B@x.pk", "a@x.pk", "not-an-email"], customer_mode: "test", inquiry_alerts: true, order_subject: "Order {order}\r\nBcc: evil@x" },
  { STORE_NOTIFY_EMAIL: "shop@example.com", NOTIFY_CUSTOMER_EMAIL: "1" },
);
assert.deepEqual(stored.recipients, ["a@x.pk", "b@x.pk"]);
assert.equal(stored.source, "settings");
assert.equal(stored.customerMode, "test");
assert.equal(stored.inquiryAlerts, true);
assert.ok(!/[\r\n]/.test(stored.orderSubject), "subjects cannot inject mail headers");
const emptyList = parseNotificationSettings({ recipients: [], customer_mode: "bogus" }, { STORE_NOTIFY_EMAIL: "shop@example.com" });
assert.deepEqual(emptyList.recipients, ["shop@example.com"]);
assert.equal(emptyList.source, "env");
assert.equal(emptyList.customerMode, "off", "unknown mode fails closed to off");

// Recipients: max 5, unique, lower-case.
assert.equal(normaliseRecipients(Array.from({ length: 9 }, (_, i) => `s${i}@x.pk`)).length, 5);

// Validation and stored shape.
assert.equal(notificationSettingsSchema.safeParse({ recipients: ["bad"], customerMode: "off", inquiryAlerts: false, orderSubject: "", customerSubject: "", customerIntro: "" }).success, false);
assert.equal(notificationSettingsSchema.safeParse({ recipients: ["a@x.pk"], customerMode: "everyone", inquiryAlerts: false, orderSubject: "", customerSubject: "", customerIntro: "" }).success, false);
const s = toStored({ recipients: [" A@x.pk "], customerMode: "on", inquiryAlerts: true, orderSubject: "x".repeat(300), customerSubject: "Hi\nthere", customerIntro: "Line 1\r\n\r\n\r\n\r\nLine 2\u0007" });
assert.deepEqual(s.recipients, ["a@x.pk"]);
assert.equal(s.order_subject.length, 150);
assert.equal(s.customer_subject, "Hi there");
assert.equal(s.customer_intro, "Line 1\n\nLine 2");

// Subjects and helpers.
assert.equal(fillSubject("", { order: "LH-1" }), "", "empty = built-in wording");
assert.equal(fillSubject("Order {order} · {total}", { order: "LH-1", total: "Rs 100" }), "Order LH-1 · Rs 100");
assert.equal(cleanLine("a\u0000b\n c", 10), "a b c");
assert.equal(fingerprint("abc"), fingerprint("abc"));
assert.notEqual(fingerprint("abc"), fingerprint("abd"));
assert.equal(maskEmail("owner@shop.pk"), "o***@shop.pk");

// Templates: built-in customer wording is byte-identical to the pre-G24 text; a custom intro replaces only that part.
const o: NotifyOrder = {
  orderNumber: "LH-1", placedAt: "2026-10-23T10:00:00Z", customerName: "Ayesha", phoneNational: "03001234567", city: "Lahore",
  province: "Punjab", items: [{ title: "Dell", variant: "Default", quantity: 1, lineTotalPaisa: 100 }], subtotalPaisa: 100,
  shippingPaisa: 0, codFeePaisa: 0, totalDuePaisa: 100, deliveryOption: null, customerNote: "",
};
const builtIn = customerOrderConfirmation(o, "https://x/o/t");
assert.ok(builtIn.text.includes("We have received your order LH-1. Our team reviews every order and confirms availability with you\nby phone before dispatch."));
assert.equal(builtIn.subject, "Laptops HUB order LH-1 received");
const custom = customerOrderConfirmation(o, "https://x/o/t", { subject: "Thanks — LH-1", intro: "We will call you soon." });
assert.equal(custom.subject, "Thanks — LH-1");
assert.ok(custom.text.includes("We have received your order LH-1.\nWe will call you soon."));
assert.ok(!custom.text.includes("Our team reviews"));
assert.ok(custom.text.includes("https://x/o/t"), "order link always kept");

const inq = businessInquiryAlert({ name: "Ali", phone: "0300", email: null, subject: "Need\r\nhelp", message: "m".repeat(3000), createdAt: "2026-11-26T10:00:00Z" }, "https://x/admin/inquiries");
assert.ok(!/[\r\n]/.test(inq.subject));
assert.ok(inq.text.includes("https://x/admin/inquiries") && inq.text.includes("Phone: 0300") && !inq.text.includes("Email:"));
assert.ok(inq.text.length < 2300, "long messages are trimmed");
assert.ok(testMessage("owner").text.includes("No customer was emailed"));

console.log("notification-settings.test.ts ok");
