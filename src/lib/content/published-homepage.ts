import { createClient } from "@/lib/supabase/server";
import { V5_HOMEPAGE_SECTIONS, type SectionInstance } from "./site-builder-schema";

/**
 * Load published homepage sections when explicitly enabled.
 * Default: return null so callers keep the approved V5 hardcoded composition.
 */
export async function getPublishedHomepageSections(): Promise<SectionInstance[] | null> {
  if (process.env.THEME_PUBLISHED_ENABLED !== "1") return null;

  try {
    const supabase = await createClient();
    const { data: pub } = await supabase
      .from("theme_publications")
      .select("published_version_id")
      .eq("template_key", "homepage")
      .maybeSingle();
    if (!pub?.published_version_id) return null;

    const { data: version } = await supabase
      .from("theme_versions")
      .select("sections, status")
      .eq("id", pub.published_version_id)
      .maybeSingle();
    if (!version || version.status !== "published") return null;
    const sections = version.sections as SectionInstance[];
    if (!Array.isArray(sections) || !sections.length) return null;
    return sections;
  } catch {
    return null;
  }
}

/** Safe defaults if published payload is corrupt. */
export function homepageSectionsOrV5(sections: SectionInstance[] | null): SectionInstance[] {
  return sections && sections.length ? sections : V5_HOMEPAGE_SECTIONS;
}
