import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { SEO_DEFAULTS_KEY, parseTitleSuffix } from "./seo-defaults";

/** Server-only: the merchant's SEO title suffix ("" when unset). Expired by Settings saves (tag `settings`). */
export const getSeoTitleSuffix = unstable_cache(
  async (): Promise<string> => {
    try {
      const { data } = await createServiceClient()
        .from("store_settings")
        .select("value")
        .eq("key", SEO_DEFAULTS_KEY)
        .maybeSingle();
      return parseTitleSuffix(data?.value);
    } catch {
      return "";
    }
  },
  ["seo-title-suffix"],
  { revalidate: 60, tags: ["settings"] },
);
