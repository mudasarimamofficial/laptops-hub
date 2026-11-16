import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import {
  DEFAULT_STOREFRONT_PRESENTATION,
  parseStorefrontPresentation,
  STOREFRONT_PRESENTATION_KEY,
  type StorefrontPresentation,
} from "./storefront-presentation";

/**
 * Server-only read of one non-secret settings key (anon RLS does not expose it). Cached like the catalog (60 s,
 * tag "settings"); any failure falls back to the client-requested defaults (labels hidden).
 */
export const getStorefrontPresentation = unstable_cache(
  async (): Promise<StorefrontPresentation> => {
    try {
      const { data } = await createServiceClient()
        .from("store_settings")
        .select("value")
        .eq("key", STOREFRONT_PRESENTATION_KEY)
        .maybeSingle();
      return parseStorefrontPresentation(data?.value);
    } catch {
      return DEFAULT_STOREFRONT_PRESENTATION;
    }
  },
  ["storefront-presentation"],
  { revalidate: 60, tags: ["settings"] },
);
