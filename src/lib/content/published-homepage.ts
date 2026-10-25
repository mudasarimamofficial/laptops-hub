import { createClient } from "@/lib/supabase/server";
import { V5_HOMEPAGE_SECTIONS, type SectionInstance } from "./site-builder-schema";

/**
 * Load published homepage sections when explicitly enabled.
 * Uses SECURITY DEFINER RPC `get_published_homepage_sections` so anon/logged-out
 * customers never need SELECT on theme_* tables (drafts stay private).
 * Default: return null so callers keep the approved V5 hardcoded composition.
 */
export async function getPublishedHomepageSections(): Promise<SectionInstance[] | null> {
  if (process.env.THEME_PUBLISHED_ENABLED !== "1") return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_published_homepage_sections");
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
}

/** Safe defaults if published payload is corrupt. */
export function homepageSectionsOrV5(sections: SectionInstance[] | null): SectionInstance[] {
  return sections && sections.length ? sections : V5_HOMEPAGE_SECTIONS;
}
