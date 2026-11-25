import { getContactSocial } from "@/lib/content/contact-social-server";
import { SHARE_IMAGE_PATH } from "@/lib/seo/site-jsonld";

/**
 * Shared Open Graph fields. Next.js replaces a parent's whole `openGraph` when a page sets its own, so every page that
 * sets openGraph spreads these first (site name from Contact & Social, locale, and the brand share image).
 */
export async function ogDefaults() {
  const c = await getContactSocial().catch(() => null);
  const siteName = c?.businessName.trim() || "Laptops HUB";
  return {
    siteName,
    locale: "en_PK",
    images: [{ url: SHARE_IMAGE_PATH, width: 1200, height: 630, alt: siteName }],
  };
}
