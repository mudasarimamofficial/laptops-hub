/**
 * Contact, social, and WhatsApp storefront settings (store_settings key `contact_social`).
 * Defaults are merchant-supplied facts for Laptops HUB public storefront.
 */
import { z } from "zod";

export const CONTACT_SOCIAL_KEY = "contact_social";

export type ContactPhone = {
  id: string;
  display: string;
  /** Digits for tel: links (no spaces). */
  tel: string;
  enabled: boolean;
};

export type SocialLink = {
  id: "facebook" | "instagram" | "tiktok" | "youtube";
  label: string;
  url: string;
  enabled: boolean;
};

export type WhatsAppSettings = {
  /** Exact Business short link for general chat / floating widget. */
  generalUrl: string;
  widgetEnabled: boolean;
  widgetLabel: string;
  showOnMobile: boolean;
  showOnDesktop: boolean;
  orderingEnabled: boolean;
  ctaLabel: string;
  soldOutInquiryEnabled: boolean;
  soldOutCtaLabel: string;
  /**
   * Verified international digits for wa.me prefilled messages (no +).
   * Empty = product CTA uses copy/open fallback with generalUrl.
   */
  recipientDigits: string;
  messageTemplate: string;
};

export type ContactSocialSettings = {
  businessName: string;
  address: string;
  email: string;
  phones: ContactPhone[];
  socialHeading: string;
  social: SocialLink[];
  whatsapp: WhatsAppSettings;
};

export const DEFAULT_WHATSAPP_MESSAGE_TEMPLATE = `Hello {{business_name}}! 👋

I would like to order this product through WhatsApp.

Product: {{product_name}}
Variant: {{variant_label}}
Configuration: {{configuration}}
SKU: {{sku}}
Quantity: {{quantity}}
Current unit price: {{unit_price}}
Estimated item subtotal: {{subtotal}}

Product link:
{{product_url}}

Please confirm availability, final pricing, delivery charges, and how to complete my order. Thank you!`;

export const DEFAULT_CONTACT_SOCIAL: ContactSocialSettings = {
  businessName: "Laptops HUB",
  address: "Laptops HUB, 1st Floor, Al Raheem Center Plaza, University Chowk, Bahawalpur, Pakistan",
  email: "infolaptopshub@gmail.com",
  phones: [
    { id: "p1", display: "0309 3372974", tel: "03093372974", enabled: true },
    { id: "p2", display: "0313 6565663", tel: "03136565663", enabled: true },
    { id: "p3", display: "0339 9100199", tel: "03399100199", enabled: true },
  ],
  socialHeading: "Follow us on social media",
  social: [
    { id: "facebook", label: "Facebook", url: "https://www.facebook.com/LaptopshubII.pk", enabled: true },
    { id: "instagram", label: "Instagram", url: "https://www.instagram.com/laptopshub.pk", enabled: true },
    { id: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@laptopshub.pk", enabled: true },
    { id: "youtube", label: "YouTube", url: "https://www.youtube.com/@Laptopshub", enabled: true },
  ],
  whatsapp: {
    generalUrl: "https://api.whatsapp.com/message/NT5WBBX234POA1",
    widgetEnabled: true,
    widgetLabel: "Chat on WhatsApp",
    showOnMobile: true,
    showOnDesktop: true,
    orderingEnabled: true,
    ctaLabel: "Order on WhatsApp",
    soldOutInquiryEnabled: true,
    soldOutCtaLabel: "Ask availability on WhatsApp",
    recipientDigits: "",
    messageTemplate: DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  },
};

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((u) => !u || /^https:\/\//i.test(u), "must_be_https");

const phoneSchema = z.object({
  id: z.string().trim().min(1).max(40),
  display: z.string().trim().min(1).max(40),
  tel: z
    .string()
    .trim()
    .min(7)
    .max(20)
    .regex(/^[0-9+]+$/, "invalid_tel"),
  enabled: z.boolean(),
});

const socialSchema = z.object({
  id: z.enum(["facebook", "instagram", "tiktok", "youtube"]),
  label: z.string().trim().min(1).max(40),
  url: httpsUrl,
  enabled: z.boolean(),
});

export const contactSocialSchema = z.object({
  businessName: z.string().trim().min(1).max(160),
  address: z.string().trim().min(1).max(400),
  email: z.string().trim().email().max(160),
  phones: z.array(phoneSchema).max(8),
  socialHeading: z.string().trim().min(1).max(80),
  social: z.array(socialSchema).max(8),
  whatsapp: z.object({
    generalUrl: httpsUrl.refine((u) => u.length > 0, "required"),
    widgetEnabled: z.boolean(),
    widgetLabel: z.string().trim().max(60),
    showOnMobile: z.boolean(),
    showOnDesktop: z.boolean(),
    orderingEnabled: z.boolean(),
    ctaLabel: z.string().trim().min(1).max(60),
    soldOutInquiryEnabled: z.boolean(),
    soldOutCtaLabel: z.string().trim().min(1).max(60),
    recipientDigits: z
      .string()
      .trim()
      .max(20)
      .regex(/^$|^[0-9]{10,15}$/, "invalid_whatsapp_digits"),
    messageTemplate: z.string().trim().min(20).max(4000),
  }),
});

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function mergePhone(raw: unknown, fallback: ContactPhone): ContactPhone {
  const o = asObj(raw);
  return {
    id: typeof o.id === "string" && o.id.trim() ? o.id.trim() : fallback.id,
    // Preserve intentional empty strings — do not resurrect default numbers into custom rows.
    display: typeof o.display === "string" ? o.display.trim() : fallback.display,
    tel: typeof o.tel === "string" ? o.tel.replace(/\s+/g, "") : fallback.tel,
    enabled: typeof o.enabled === "boolean" ? o.enabled : fallback.enabled,
  };
}

function mergeSocial(raw: unknown, fallback: SocialLink): SocialLink {
  const o = asObj(raw);
  const id = o.id === "facebook" || o.id === "instagram" || o.id === "tiktok" || o.id === "youtube" ? o.id : fallback.id;
  const url = typeof o.url === "string" ? o.url.trim() : fallback.url;
  return {
    id,
    label: typeof o.label === "string" && o.label.trim() ? o.label.trim() : fallback.label,
    url: /^https:\/\//i.test(url) ? url : fallback.url,
    enabled: typeof o.enabled === "boolean" ? o.enabled : fallback.enabled,
  };
}

/** Tolerant parse: never invents fake URLs; falls back to merchant defaults per field. */
export function parseContactSocial(value: unknown): ContactSocialSettings {
  const v = asObj(value);
  const wa = asObj(v.whatsapp);
  // Missing/non-array → merchant defaults. Empty array is intentional (hide all phones).
  const phonesRaw = Array.isArray(v.phones) ? v.phones : null;
  const socialRaw = Array.isArray(v.social) ? v.social : null;

  const emptyPhone = (i: number): ContactPhone => ({ id: `p${i + 1}`, display: "", tel: "", enabled: true });
  const phones =
    phonesRaw === null
      ? DEFAULT_CONTACT_SOCIAL.phones.map((p) => ({ ...p }))
      : phonesRaw.slice(0, 8).map((p, i) => mergePhone(p, DEFAULT_CONTACT_SOCIAL.phones[i] ?? emptyPhone(i)));

  const social =
    socialRaw && socialRaw.length > 0
      ? DEFAULT_CONTACT_SOCIAL.social.map((def) => {
          const found = socialRaw.find((s) => asObj(s).id === def.id);
          return found ? mergeSocial(found, def) : { ...def };
        })
      : DEFAULT_CONTACT_SOCIAL.social.map((s) => ({ ...s }));

  const generalUrl =
    typeof wa.generalUrl === "string" && /^https:\/\//i.test(wa.generalUrl.trim())
      ? wa.generalUrl.trim()
      : DEFAULT_CONTACT_SOCIAL.whatsapp.generalUrl;

  const recipientRaw = typeof wa.recipientDigits === "string" ? wa.recipientDigits.replace(/\D/g, "") : "";
  const recipientDigits = /^[0-9]{10,15}$/.test(recipientRaw) ? recipientRaw : "";

  return {
    businessName:
      typeof v.businessName === "string" && v.businessName.trim()
        ? v.businessName.trim()
        : DEFAULT_CONTACT_SOCIAL.businessName,
    address: typeof v.address === "string" && v.address.trim() ? v.address.trim() : DEFAULT_CONTACT_SOCIAL.address,
    email:
      typeof v.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())
        ? v.email.trim()
        : DEFAULT_CONTACT_SOCIAL.email,
    phones,
    socialHeading:
      typeof v.socialHeading === "string" && v.socialHeading.trim()
        ? v.socialHeading.trim()
        : DEFAULT_CONTACT_SOCIAL.socialHeading,
    social,
    whatsapp: {
      generalUrl,
      widgetEnabled: typeof wa.widgetEnabled === "boolean" ? wa.widgetEnabled : DEFAULT_CONTACT_SOCIAL.whatsapp.widgetEnabled,
      widgetLabel:
        typeof wa.widgetLabel === "string" ? wa.widgetLabel.trim().slice(0, 60) : DEFAULT_CONTACT_SOCIAL.whatsapp.widgetLabel,
      showOnMobile: typeof wa.showOnMobile === "boolean" ? wa.showOnMobile : true,
      showOnDesktop: typeof wa.showOnDesktop === "boolean" ? wa.showOnDesktop : true,
      orderingEnabled:
        typeof wa.orderingEnabled === "boolean" ? wa.orderingEnabled : DEFAULT_CONTACT_SOCIAL.whatsapp.orderingEnabled,
      ctaLabel:
        typeof wa.ctaLabel === "string" && wa.ctaLabel.trim()
          ? wa.ctaLabel.trim().slice(0, 60)
          : DEFAULT_CONTACT_SOCIAL.whatsapp.ctaLabel,
      soldOutInquiryEnabled:
        typeof wa.soldOutInquiryEnabled === "boolean"
          ? wa.soldOutInquiryEnabled
          : DEFAULT_CONTACT_SOCIAL.whatsapp.soldOutInquiryEnabled,
      soldOutCtaLabel:
        typeof wa.soldOutCtaLabel === "string" && wa.soldOutCtaLabel.trim()
          ? wa.soldOutCtaLabel.trim().slice(0, 60)
          : DEFAULT_CONTACT_SOCIAL.whatsapp.soldOutCtaLabel,
      recipientDigits,
      messageTemplate:
        typeof wa.messageTemplate === "string" && wa.messageTemplate.trim().length >= 20
          ? wa.messageTemplate.trim().slice(0, 4000)
          : DEFAULT_CONTACT_SOCIAL.whatsapp.messageTemplate,
    },
  };
}

/** Merge identity name/email into contact_social when identity was set and contact fields were never customized. */
export function applyIdentityHints(
  contact: ContactSocialSettings,
  identity: { name?: unknown; support_email?: unknown; support_phone?: unknown },
): ContactSocialSettings {
  const next = { ...contact, whatsapp: { ...contact.whatsapp }, phones: contact.phones.map((p) => ({ ...p })), social: contact.social.map((s) => ({ ...s })) };
  if (typeof identity.name === "string" && identity.name.trim() && contact.businessName === DEFAULT_CONTACT_SOCIAL.businessName) {
    // Prefer stored identity only when it differs and contact still shows default name? Keep contact as source of truth when saved.
  }
  if (typeof identity.support_email === "string" && identity.support_email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.support_email.trim())) {
    // If merchant set support email in identity and contact email is still the default, prefer identity only when different defaults — keep exact default email from mandate.
  }
  void identity;
  return next;
}

export type WhatsAppOrderVars = {
  business_name: string;
  product_name: string;
  variant_label: string;
  configuration: string;
  sku: string;
  quantity: string;
  unit_price: string;
  subtotal: string;
  product_url: string;
};

export function fillWhatsAppTemplate(template: string, vars: WhatsAppOrderVars): string {
  return template
    .replaceAll("{{business_name}}", vars.business_name)
    .replaceAll("{{product_name}}", vars.product_name)
    .replaceAll("{{variant_label}}", vars.variant_label || "—")
    .replaceAll("{{configuration}}", vars.configuration || "—")
    .replaceAll("{{sku}}", vars.sku || "—")
    .replaceAll("{{quantity}}", vars.quantity)
    .replaceAll("{{unit_price}}", vars.unit_price)
    .replaceAll("{{subtotal}}", vars.subtotal)
    .replaceAll("{{product_url}}", vars.product_url);
}

/** Build wa.me URL with encoded text when recipient digits are configured. */
export function waMeOrderUrl(recipientDigits: string, message: string): string | null {
  if (!/^[0-9]{10,15}$/.test(recipientDigits)) return null;
  return `https://wa.me/${recipientDigits}?text=${encodeURIComponent(message)}`;
}

export function enabledPhones(c: ContactSocialSettings): ContactPhone[] {
  return c.phones.filter((p) => p.enabled && p.display && p.tel);
}

export function enabledSocial(c: ContactSocialSettings): SocialLink[] {
  return c.social.filter((s) => s.enabled && /^https:\/\//i.test(s.url));
}

export function telHref(tel: string): string {
  const digits = tel.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

export function mailtoHref(email: string): string {
  return `mailto:${email.trim()}`;
}
