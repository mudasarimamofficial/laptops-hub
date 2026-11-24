import { getStaffMembership, type StaffRole } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import type { SectionInstance } from "./site-builder-schema";

export type PreviewMode = "draft" | "published" | "default";
export const PREVIEW_ROLES: StaffRole[] = ["owner", "admin", "editor"];

export const previewMode = (v: unknown): PreviewMode =>
  v === "published" || v === "default" ? v : "draft";

/** True when the live homepage reads published layouts (off only with the emergency THEME_PUBLISHED_DISABLED=1). */
export { publishedThemesLive as publishedThemesEnabled } from "./published-homepage";

export type PreviewSource = {
  mode: PreviewMode;
  /** `null` = the approved V5 default layout. */
  sections: SectionInstance[] | null;
  /** Draft or published version shown (none for the default, or when nothing has been saved/published yet). */
  versionLabel: string | null;
  missing: boolean;
  /** The shown version's theme settings (site-wide copy + template layout); `null` = V5 defaults. */
  themeSettings: Record<string, unknown> | null;
};

const settingsOf = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/**
 * Staff-only (owner/admin/editor) read of a homepage layout for the preview route. Returns `null` for anyone else,
 * so the caller can answer 404 without revealing that the page exists. Drafts are read with the service client only
 * after the staff check; nothing here is cached.
 */
export async function loadHomepagePreview(rawMode: unknown): Promise<PreviewSource | null> {
  const staff = await getStaffMembership();
  if (!staff || !PREVIEW_ROLES.includes(staff.role)) return null;
  const mode = previewMode(rawMode);
  if (mode === "default") return { mode, sections: null, versionLabel: null, missing: false, themeSettings: null };

  const db = createServiceClient();
  const { data: template } = await db.from("theme_templates").select("id").eq("key", "homepage").maybeSingle();
  if (!template) return { mode, sections: null, versionLabel: null, missing: true, themeSettings: null };

  if (mode === "draft") {
    const { data } = await db
      .from("theme_versions")
      .select("label, sections, theme_settings")
      .eq("template_id", template.id)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data
      ? { mode, sections: data.sections as SectionInstance[], versionLabel: data.label, missing: false, themeSettings: settingsOf(data.theme_settings) }
      : { mode, sections: null, versionLabel: null, missing: true, themeSettings: null };
  }

  const { data: pub } = await db
    .from("theme_publications")
    .select("published_version_id")
    .eq("template_key", "homepage")
    .maybeSingle();
  if (!pub?.published_version_id) return { mode, sections: null, versionLabel: null, missing: true, themeSettings: null };
  const { data: ver } = await db
    .from("theme_versions")
    .select("label, sections, status, theme_settings")
    .eq("id", pub.published_version_id)
    .maybeSingle();
  return ver && ver.status === "published"
    ? { mode, sections: ver.sections as SectionInstance[], versionLabel: ver.label, missing: false, themeSettings: settingsOf(ver.theme_settings) }
    : { mode, sections: null, versionLabel: null, missing: true, themeSettings: null };
}
