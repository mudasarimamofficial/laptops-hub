import type { SupabaseClient } from "@supabase/supabase-js";
import { isLinkPublic, type Visibility } from "@/lib/content/links";
import { createServiceClient } from "@/lib/supabase/server";

export {
  DEFAULT_FOOTER_COLUMNS,
  DEFAULT_HEADER_NAV,
  DEFAULT_NAVIGATION_CONFIG,
  NAV_LIMITS,
  destinationProblem,
  isSafeDestinationUrl,
  navigationProblems,
} from "@/lib/content/navigation-rules";
export type { FooterNavColumn, NavigationConfig, NavigationHistoryEntry, NavigationItem } from "@/lib/content/navigation-rules";
import {
  DEFAULT_NAVIGATION_CONFIG,
  isSafeDestinationUrl,
  type FooterNavColumn,
  type NavigationConfig,
  type NavigationHistoryEntry,
  type NavigationItem,
} from "@/lib/content/navigation-rules";

/**
 * Clean and filter navigation links for public customer display:
 * 1. Removes unsafe destinations.
 * 2. Filters out unpublished policy pages via `isLinkPublic`.
 */
export function sanitizePublicNavLinks(links: NavigationItem[], vis: Visibility): NavigationItem[] {
  return links
    .filter((item) => isSafeDestinationUrl(item.href))
    .filter((item) => isLinkPublic(item.href, vis));
}

export function sanitizePublicFooterColumns(columns: FooterNavColumn[], vis: Visibility): FooterNavColumn[] {
  return columns
    .map((col) => ({
      ...col,
      links: sanitizePublicNavLinks(col.links, vis),
    }))
    .filter((col) => col.links.length > 0);
}

/**
 * Fetch published navigation configuration from store_settings.
 * Falls back safely to DEFAULT_NAVIGATION_CONFIG if missing or corrupt.
 */
export async function getPublishedNavigation(client?: SupabaseClient): Promise<NavigationConfig> {
  try {
    const supabase = client || createServiceClient();
    const { data } = await supabase
      .from("store_settings")
      .select("value")
      .eq("key", "navigation")
      .maybeSingle();

    if (data?.value && typeof data.value === "object") {
      const val = data.value as Partial<NavigationConfig>;
      if (Array.isArray(val.headerNav) && Array.isArray(val.footerColumns)) {
        return {
          headerNav: val.headerNav.filter((item) => isSafeDestinationUrl(item.href)),
          footerColumns: val.footerColumns.map((col) => ({
            ...col,
            links: (col.links || []).filter((item) => isSafeDestinationUrl(item.href)),
          })),
          version: typeof val.version === "number" ? val.version : 1,
          updatedAt: typeof val.updatedAt === "string" ? val.updatedAt : new Date().toISOString(),
        };
      }
    }
  } catch {
    // Fail closed to approved V5 defaults
  }
  return DEFAULT_NAVIGATION_CONFIG;
}

export const NAVIGATION_KEY = "navigation";
export const NAVIGATION_HISTORY_KEY = "navigation_history";

/** Published versions kept for restore, newest first (Admin → Navigation → Version history). Staff only. */
export async function getNavigationHistory(client: SupabaseClient): Promise<NavigationHistoryEntry[]> {
  const { data } = await client.from("store_settings").select("value").eq("key", NAVIGATION_HISTORY_KEY).maybeSingle();
  const list = (data?.value as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (e): e is NavigationHistoryEntry =>
      !!e && typeof e === "object" && typeof (e as NavigationHistoryEntry).version === "number" &&
      Array.isArray((e as NavigationHistoryEntry).headerNav) && Array.isArray((e as NavigationHistoryEntry).footerColumns),
  );
}
