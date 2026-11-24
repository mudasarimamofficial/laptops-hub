import { unstable_cache } from "next/cache";
import { createPublicClient, createServiceClient } from "@/lib/supabase/server";
import { globalsFromThemeSettings, themeGlobals, type ThemeGlobals } from "./theme-globals";
import { layoutFromThemeSettings, themeLayout, type ThemeLayout } from "./theme-layout";
import { V5_HOMEPAGE_SECTIONS, type SectionInstance } from "./site-builder-schema";

/** Cache tag expired by theme publish and rollback (api/admin/theme/homepage/publish|rollback). */
export const HOMEPAGE_THEME_TAG = "homepage-theme";

/**
 * Published homepage sections via the SECURITY DEFINER RPC `get_published_homepage_sections`, read with the anon key
 * (no cookies), so logged-out customers never need SELECT on theme_* tables (drafts stay private) and the homepage
 * stays statically cached. Cached 60 s under `homepage-theme`, which every publish/rollback expires.
 */
const readPublishedSections = unstable_cache(
  async (): Promise<SectionInstance[] | null> => {
    try {
      const { data, error } = await createPublicClient().rpc("get_published_homepage_sections");
      if (error || data == null) return null;
      const sections = data as SectionInstance[];
      if (!Array.isArray(sections) || !sections.length) return null;
      // Defense in depth: only accept known section shapes (no scriptable payload execution)
      return sections.filter(
        (s) =>
          s &&
          typeof s === "object" &&
          typeof s.id === "string" &&
          typeof s.type === "string" &&
          typeof s.enabled === "boolean" &&
          s.settings &&
          typeof s.settings === "object",
      );
    } catch {
      return null;
    }
  },
  ["published-homepage-sections"],
  { revalidate: 60, tags: [HOMEPAGE_THEME_TAG] },
);

/**
 * True unless the developer emergency switch `THEME_PUBLISHED_DISABLED=1` is set. Publishing in the admin is the
 * merchant's own switch: with no publication the homepage renders the approved V5 default layout, so nothing changes
 * for customers until the merchant presses Publish.
 */
export const publishedThemesLive = () => process.env.THEME_PUBLISHED_DISABLED !== "1";

/**
 * Load the published homepage sections. `null` (nothing published, a read error, or the emergency switch) makes
 * callers render the approved V5 default layout.
 */
export async function getPublishedHomepageSections(): Promise<SectionInstance[] | null> {
  if (!publishedThemesLive()) return null;
  return readPublishedSections();
}

/** Safe defaults if published payload is corrupt. */
export function homepageSectionsOrV5(sections: SectionInstance[] | null): SectionInstance[] {
  return sections && sections.length ? sections : V5_HOMEPAGE_SECTIONS;
}

/**
 * Published theme settings (site-wide copy in `globals`, template layout in `layout`) from the live snapshot.
 * theme_* tables are not anon-readable, so this reads with the service role on the server only (never sent to the
 * browser except as the resolved text). Same cache tag as the homepage: publish and restore expire both together.
 */
const readPublishedThemeSettings = unstable_cache(
  async (): Promise<Record<string, unknown>> => {
    try {
      const db = createServiceClient();
      const { data: pub } = await db
        .from("theme_publications")
        .select("published_version_id")
        .eq("template_key", "homepage")
        .maybeSingle();
      if (!pub?.published_version_id) return {};
      const { data: v } = await db
        .from("theme_versions")
        .select("theme_settings")
        .eq("id", pub.published_version_id)
        .eq("status", "published")
        .maybeSingle();
      const ts = v?.theme_settings;
      return ts && typeof ts === "object" && !Array.isArray(ts) ? (ts as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  },
  ["published-theme-settings"],
  { revalidate: 60, tags: [HOMEPAGE_THEME_TAG] },
);

/** Effective site-wide copy for the storefront chrome; V5 defaults when nothing is published or on any error. */
export async function getPublishedThemeGlobals(): Promise<ThemeGlobals> {
  if (!publishedThemesLive()) return themeGlobals();
  return themeGlobals(globalsFromThemeSettings(await readPublishedThemeSettings()));
}

/** Effective product/collection layout controls; the V5 layout when nothing is published or on any error. */
export async function getPublishedThemeLayout(): Promise<ThemeLayout> {
  if (!publishedThemesLive()) return themeLayout();
  return themeLayout(layoutFromThemeSettings(await readPublishedThemeSettings()));
}
