import { HomePageView } from "@/components/storefront/home/home-page-view";
import { getPublishedHomepageSections } from "@/lib/content/published-homepage";

export const revalidate = 60;

/**
 * Public homepage. Renders the published theme layout (section order, visibility, settings) when published themes
 * are switched on (THEME_PUBLISHED_ENABLED=1) and one has been published; otherwise the approved V5 default layout.
 * Drafts are never read here.
 */
export default async function HomePage() {
  return <HomePageView sections={await getPublishedHomepageSections()} />;
}
