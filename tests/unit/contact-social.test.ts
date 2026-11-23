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

assert.equal(waMeOrderUrl("", "hi"), null);
assert.equal(waMeOrderUrl("923001234567", "Hello world"), "https://wa.me/923001234567?text=Hello%20world");

const msg = fillWhatsAppTemplate("Buy {{product_name}} x{{quantity}} for {{subtotal}}", {
  business_name: "Laptops HUB",
  product_name: "Dell 5400",
  variant_label: "8GB",
  configuration: "i5",
  sku: "SKU1",
  quantity: "2",
  unit_price: "Rs 49,000",
  subtotal: "Rs 98,000",
  product_url: "https://www.laptopshub.pk/products/x",
});
assert.equal(msg, "Buy Dell 5400 x2 for Rs 98,000");

const badScheme = parseContactSocial({
  social: [{ id: "facebook", label: "Facebook", url: "javascript:alert(1)", enabled: true }],
});
assert.equal(badScheme.social.find((s) => s.id === "facebook")?.url, DEFAULT_CONTACT_SOCIAL.social[0].url);

console.log("contact-social.test.ts: ok");
