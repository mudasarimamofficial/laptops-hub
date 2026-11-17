import { StoreMap } from "@/components/storefront/home/store-map";
import { mapSettings } from "@/lib/content/home-sections";
import { normalizeHomepageLayout } from "@/lib/content/homepage-layout";
import { loadHomepagePreview } from "@/lib/content/homepage-preview-server";

/** The previewed layout's map, after the footer as on the homepage (staff only; nothing for anyone else). */
export default async function PreviewAfterFooter({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const src = await loadHomepagePreview((await searchParams).v);
  if (!src) return null;
  const sec = normalizeHomepageLayout(src.sections).find((s) => s.type === "v5_store_map");
  if (!sec?.enabled) return null;
  return <StoreMap cfg={mapSettings(src.sections ? (sec.settings as Record<string, unknown>) : undefined)} />;
}
