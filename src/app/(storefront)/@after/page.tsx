import { StoreMap } from "@/components/storefront/home/store-map";
import { mapSettings } from "@/lib/content/home-sections";
import { getPublishedHomepageSections } from "@/lib/content/published-homepage";

/**
 * Homepage only: the "Visit our store" map, rendered by the storefront layout AFTER the footer (parallel route slot
 * `@after`). Other routes render nothing here ([...rest]/page.tsx on client navigation, default.tsx on a full load).
 * Settings come from the published theme (`v5_store_map`); without a published theme the approved defaults apply.
 */
export default async function HomeAfterFooter() {
  const published = await getPublishedHomepageSections();
  const sec = published?.find((s) => s.type === "v5_store_map");
  if (sec && !sec.enabled) return null;
  return <StoreMap cfg={mapSettings(sec?.settings as Record<string, unknown> | undefined)} />;
}
