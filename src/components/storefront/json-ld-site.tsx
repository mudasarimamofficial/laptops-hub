import { siteUrl } from "@/lib/site-url";
import { getContactSocial } from "@/lib/content/contact-social-server";
import { jsonLdScript, siteJsonLd } from "@/lib/seo/site-jsonld";

/**
 * Business + WebSite JSON-LD on every storefront page, from Admin → Contact & Social (no invented ratings, hours,
 * coordinates or awards). Saving Contact & Social expires the `contact-social` cache, so edits reach this markup.
 */
export async function JsonLdSite() {
  const data = siteJsonLd(siteUrl(), await getContactSocial());
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />;
}
