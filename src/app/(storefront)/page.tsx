import type { Metadata } from "next";
import { HomePageView } from "@/components/storefront/home/home-page-view";
import { getPublishedHomepageSections } from "@/lib/content/published-homepage";
import { getSeoDefaults } from "@/lib/content/seo-defaults-server";
import { getContactSocial } from "@/lib/content/contact-social-server";
import { homeSearchAppearance } from "@/lib/content/seo-defaults";
import { SHARE_IMAGE_PATH } from "@/lib/seo/site-jsonld";

export const revalidate = 60;

/** Homepage search appearance: Admin → SEO (homepage title/description), else brand + city defaults. */
export async function generateMetadata(): Promise<Metadata> {
  const [seo, contact] = await Promise.all([getSeoDefaults(), getContactSocial()]);
  const { title, description } = homeSearchAppearance(seo);
  const siteName = contact.businessName.trim() || "Laptops HUB";
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      url: "/",
      siteName,
      locale: "en_PK",
      title,
      description,
      images: [{ url: SHARE_IMAGE_PATH, width: 1200, height: 630, alt: siteName }],
    },
    twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE_PATH] },
  };
}

/**
 * Public homepage. Renders the published theme layout (section order, visibility, settings) once the merchant has
 * published one in Admin → Online Store; otherwise the approved V5 default layout. THEME_PUBLISHED_DISABLED=1 is a
 * developer emergency switch back to the V5 default.
 * Drafts are never read here.
 */
export default async function HomePage() {
  return <HomePageView sections={await getPublishedHomepageSections()} />;
}
