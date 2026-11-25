import type { ContactSocialSettings } from "@/lib/content/contact-social";

/**
 * Site-wide JSON-LD: the business (Organization + ComputerStore, a LocalBusiness type) and the WebSite.
 *
 * Every value comes from Admin → Contact & Social (one source of truth) or from the site origin. Nothing is invented:
 * no opening hours, geo coordinates, ratings, price range or registration numbers. The WebSite `name` and
 * `alternateName` are what Google's site-name system reads (it showed an unrelated name for this domain on
 * 2026-11-25). The old SearchAction is not emitted: Google retired the sitelinks search box and `/search` is
 * disallowed in robots.txt.
 */
export const LOGO_PATH = "/brand/laptops-hub-logo-512.png";
export const SHARE_IMAGE_PATH = "/brand/laptops-hub-share-1200x630.png";

/** "03093372974" → "+923093372974"; other formats are kept only if they are already international (+…). */
export function pkPhoneE164(tel: string): string | null {
  const d = tel.replace(/[^\d+]/g, "");
  if (/^0\d{10}$/.test(d)) return `+92${d.slice(1)}`;
  if (/^\+92\d{10}$/.test(d)) return d;
  if (/^92\d{10}$/.test(d)) return `+${d}`;
  return null;
}

/**
 * Splits "Laptops HUB, 1st Floor, Al Raheem Center Plaza, University Chowk, Bahawalpur, Pakistan" into a postal
 * address when it ends in ", <city>, Pakistan". Anything else is emitted as plain text (never guessed).
 */
export function postalAddress(address: string, businessName: string) {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 3 && /^pakistan$/i.test(parts[parts.length - 1])) {
    const locality = parts[parts.length - 2];
    const street = parts.slice(0, -2).filter((p, i) => !(i === 0 && p.toLowerCase() === businessName.trim().toLowerCase()));
    if (street.length) {
      return { "@type": "PostalAddress", streetAddress: street.join(", "), addressLocality: locality, addressCountry: "PK" };
    }
  }
  return address.trim() || null;
}

const isHttpsUrl = (u: string) => {
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
};

/** Brand names Google may show for the site: the configured name plus spellings people actually search. */
export function siteAlternateNames(businessName: string, host: string): string[] {
  const out = new Set<string>();
  const name = businessName.trim();
  for (const n of [name.replace(/HUB\b/, "Hub"), name.replace(/\s+/g, ""), host.replace(/^www\./, "")]) {
    if (n && n !== name) out.add(n);
  }
  return [...out];
}

export function siteJsonLd(origin: string, c: ContactSocialSettings) {
  const name = c.businessName.trim() || "Laptops HUB";
  const host = new URL(origin).host;
  const phones = c.phones.filter((p) => p.enabled).map((p) => pkPhoneE164(p.tel)).filter((p): p is string => !!p);
  const sameAs = c.social.filter((s) => s.enabled && isHttpsUrl(s.url)).map((s) => s.url);
  const address = postalAddress(c.address, name);
  const email = c.email.trim();

  const business: Record<string, unknown> = {
    "@type": ["Organization", "ComputerStore"],
    "@id": `${origin}/#organization`,
    name,
    url: `${origin}/`,
    logo: { "@type": "ImageObject", url: `${origin}${LOGO_PATH}`, width: 512, height: 512 },
    image: `${origin}${SHARE_IMAGE_PATH}`,
  };
  if (address) business.address = address;
  if (phones.length) business.telephone = phones[0];
  if (email) business.email = email;
  if (phones.length) {
    business.contactPoint = phones.map((telephone) => ({
      "@type": "ContactPoint",
      telephone,
      contactType: "customer service",
    }));
  }
  if (sameAs.length) business.sameAs = sameAs;

  return {
    "@context": "https://schema.org",
    "@graph": [
      business,
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: `${origin}/`,
        name,
        alternateName: siteAlternateNames(name, host),
        inLanguage: "en-PK",
        publisher: { "@id": `${origin}/#organization` },
      },
    ],
  };
}

/** JSON for a <script type="application/ld+json">: "<" escaped so text can never close the script element. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
