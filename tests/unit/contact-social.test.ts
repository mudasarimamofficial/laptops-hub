import assert from "node:assert/strict";
import {
  DEFAULT_CONTACT_SOCIAL,
  enabledPhones,
  enabledSocial,
  fillWhatsAppTemplate,
  parseContactSocial,
  waMeOrderUrl,
  mailtoHref,
  telHref,
} from "../../src/lib/content/contact-social";
import { priceWithCampaign } from "../../src/lib/commerce/pricing";
import { fmtPkr } from "../../src/lib/catalog/v5-model";
import type { DiscountCampaign } from "../../src/lib/commerce/pricing";

assert.equal(DEFAULT_CONTACT_SOCIAL.email, "infolaptopshub@gmail.com");
assert.equal(DEFAULT_CONTACT_SOCIAL.whatsapp.generalUrl, "https://api.whatsapp.com/message/NT5WBBX234POA1");
assert.equal(DEFAULT_CONTACT_SOCIAL.phones.length, 3);
assert.deepEqual(
  enabledSocial(DEFAULT_CONTACT_SOCIAL).map((s) => s.url),
  [
    "https://www.facebook.com/LaptopshubII.pk",
    "https://www.instagram.com/laptopshub.pk",
    "https://www.tiktok.com/@laptopshub.pk",
    "https://www.youtube.com/@Laptopshub",
  ],
);

const parsed = parseContactSocial(null);
assert.equal(parsed.businessName, "Laptops HUB");
assert.equal(enabledPhones(parsed).length, 3);
assert.equal(telHref("03093372974"), "tel:03093372974");
assert.equal(mailtoHref("infolaptopshub@gmail.com"), "mailto:infolaptopshub@gmail.com");

const disabled = parseContactSocial({
  social: [
    { id: "facebook", label: "Facebook", url: "https://www.facebook.com/LaptopshubII.pk", enabled: false },
    { id: "instagram", label: "Instagram", url: "https://www.instagram.com/laptopshub.pk", enabled: true },
  ],
});
assert.equal(enabledSocial(disabled).length, 3); // other platforms keep defaults enabled
assert.ok(!enabledSocial(disabled).some((s) => s.id === "facebook"));

// Intentionally empty phone list must not resurrect merchant defaults.
const emptyPhones = parseContactSocial({ phones: [] });
assert.equal(emptyPhones.phones.length, 0);
assert.equal(enabledPhones(emptyPhones).length, 0);

// All disabled phones stay disabled (not reset to enabled defaults).
const allDisabled = parseContactSocial({
  phones: DEFAULT_CONTACT_SOCIAL.phones.map((p) => ({ ...p, enabled: false })),
});
assert.equal(allDisabled.phones.length, 3);
assert.equal(enabledPhones(allDisabled).length, 0);
assert.ok(allDisabled.phones.every((p) => p.enabled === false));

// Custom order is preserved.
const reordered = parseContactSocial({
  phones: [
    { id: "p3", display: "0339 9100199", tel: "03399100199", enabled: true },
    { id: "p1", display: "0309 3372974", tel: "03093372974", enabled: true },
  ],
});
assert.deepEqual(
  reordered.phones.map((p) => p.id),
  ["p3", "p1"],
);

assert.equal(waMeOrderUrl("", "hi"), null);
assert.equal(waMeOrderUrl("923001234567", "Hello world"), "https://wa.me/923001234567?text=Hello%20world");

const campaign: DiscountCampaign = {
  id: "c1",
  name: "5% storewide",
  description: "",
  kind: "percent",
  value: 5,
  scope: "storewide",
  status: "active",
  codeRequired: false,
  startsAt: "2020-01-01T00:00:00.000Z",
  endsAt: null,
  announcement: "",
  showAnnouncement: false,
};
const listPaisa = 5_000_000; // Rs 50,000
const priced = priceWithCampaign(listPaisa, campaign);
assert.equal(priced.sellingPaisa, 4_750_000); // 5% off
const qty = 2;
const msg = fillWhatsAppTemplate(DEFAULT_CONTACT_SOCIAL.whatsapp.messageTemplate, {
  business_name: "Laptops HUB",
  product_name: "Dell 5400",
  variant_label: "16GB / 512GB",
  configuration: "16GB / 512GB",
  sku: "SKU-16-512",
  quantity: String(qty),
  unit_price: fmtPkr(priced.sellingPaisa),
  subtotal: fmtPkr(priced.sellingPaisa * qty),
  product_url: "https://www.laptopshub.pk/products/x",
});
assert.match(msg, /SKU: SKU-16-512/);
assert.match(msg, /Quantity: 2/);
assert.match(msg, /Current unit price: Rs 47,500/);
assert.match(msg, /Estimated item subtotal: Rs 95,000/);
assert.match(msg, /Variant: 16GB \/ 512GB/);

const inactive = priceWithCampaign(listPaisa, { ...campaign, status: "disabled" });
assert.equal(inactive.sellingPaisa, listPaisa);

const prefilled = waMeOrderUrl("923001112233", msg);
assert.ok(prefilled);
assert.ok(prefilled!.startsWith("https://wa.me/923001112233?text="));
assert.equal(decodeURIComponent(prefilled!.split("?text=")[1]), msg);

const badScheme = parseContactSocial({
  social: [{ id: "facebook", label: "Facebook", url: "javascript:alert(1)", enabled: true }],
});
assert.equal(badScheme.social.find((s) => s.id === "facebook")?.url, DEFAULT_CONTACT_SOCIAL.social[0].url);

console.log("contact-social.test.ts: ok");
