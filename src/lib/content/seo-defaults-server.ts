import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { SEO_DEFAULTS_KEY, parseSeoDefaults, type SeoDefaults } from "./seo-defaults";

/** Server-only: Admin SEO settings (`seo_defaults`). Expired by Settings/SEO saves (tag `settings`). */
export const getSeoDefaults = unstable_cache(
  async (): Promise<SeoDefaults> => {
    try {
      const { data } = await createServiceClient().from("store_settings").select("value").eq("key", SEO_DEFAULTS_KEY).maybeSingle();
      return parseSeoDefaults(data?.value);
    } catch {
      return parseSeoDefaults(null);
    }
  },
  ["seo-defaults"],
  { revalidate: 60, tags: ["settings"] },
);

/** The merchant's SEO title suffix ("" when unset). */
export async function getSeoTitleSuffix(): Promise<string> {
  return (await getSeoDefaults()).titleSuffix;
}
