import { HomePageView } from "@/components/storefront/home/home-page-view";
import { getPublishedHomepageSections } from "@/lib/content/published-homepage";

export const revalidate = 60;

/**
 * Public homepage. Renders the published theme layout (section order, visibility, settings) once the merchant has
 * published one in Admin → Online Store; otherwise the approved V5 default layout. THEME_PUBLISHED_DISABLED=1 is a
 * developer emergency switch back to the V5 default.
 * Drafts are never read here.
 */
export default async function HomePage() {
  return <HomePageView sections={await getPublishedHomepageSections()} />;
}
