/**
 * Site-wide (every storefront page) merchant-editable copy: header, mega menu, footer and the promotion bar link.
 *
 * Stored in `theme_versions.theme_settings.globals` of the homepage theme, so it shares the editor's draft → preview →
 * publish → restore workflow (the publish RPC copies theme_settings into the immutable snapshot). Every value has a
 * default equal to the approved V5 text, so with nothing published the storefront renders exactly as before.
 * Values are plain text (React escapes them); links are validated with the same rules as homepage buttons.
 *
 * Client-safe: no server imports.
 */
import { copyValueProblems, resolveCopy, type CopyField } from "./home-copy";

export type GlobalCopyGroup = "header" | "footer" | "announcement";

export type GlobalCopyField = CopyField & { group: GlobalCopyGroup };

const LINK_HELP = "A page on this site (/collections/…, /pages/…) or a full https:// link.";

export const GLOBAL_COPY: GlobalCopyField[] = [
  // Header + mega menu
  { group: "header", key: "laptopsMenuLabel", label: "Menu button", kind: "text", default: "Laptops", max: 20, help: "Opens the laptops menu (desktop)." },
  { group: "header", key: "searchLabel", label: "Search box text", kind: "text", default: "Search model, processor, RAM", max: 40 },
  { group: "header", key: "searchShortLabel", label: "Search box text (narrow screens)", kind: "text", default: "Search laptops", max: 24 },
  { group: "header", key: "menuAllLabel", label: "Menu: all products link", kind: "text", default: "View all products", max: 40, help: "An arrow is added automatically." },
  { group: "header", key: "menuSecondLabel", label: "Menu: second link", kind: "text", default: "Chromebooks", max: 30, help: "Shown in the laptops menu and the phone menu." },
  { group: "header", key: "menuSecondHref", label: "Menu: second link goes to", kind: "link", default: "/collections/chromebooks", max: 500, help: LINK_HELP },
  // Footer
  { group: "footer", key: "footerTagline", label: "Footer description", kind: "textarea", default: "Used Dell, HP and Lenovo laptops. Prices in PKR. Visit us in Bahawalpur or shop online.", max: 220 },
  { group: "footer", key: "footerContactHeading", label: "Contact column heading", kind: "text", default: "Visit & contact", max: 40 },
  { group: "footer", key: "footerWhatsappLabel", label: "WhatsApp button", kind: "text", default: "Chat on WhatsApp", max: 40 },
  // Promotion bar (the promotion text itself comes from the active automatic discount)
  { group: "announcement", key: "announcementCtaLabel", label: "Promotion bar button", kind: "text", default: "Shop now", max: 30, help: "Shown after the promotion text when a discount has its announcement turned on." },
  { group: "announcement", key: "announcementHref", label: "Promotion bar link", kind: "link", default: "/collections/all", max: 500, help: LINK_HELP },
];

export const GLOBAL_COPY_GROUPS: { id: GlobalCopyGroup; title: string }[] = [
  { id: "header", title: "Header & menu" },
  { id: "footer", title: "Footer" },
  { id: "announcement", title: "Promotion bar" },
];

export type ThemeGlobals = Record<string, string>;

/** Raw stored overrides (`theme_settings.globals`), or {} when absent/malformed. */
export function globalsFromThemeSettings(themeSettings: unknown): Record<string, unknown> {
  if (!themeSettings || typeof themeSettings !== "object" || Array.isArray(themeSettings)) return {};
  const g = (themeSettings as Record<string, unknown>).globals;
  return g && typeof g === "object" && !Array.isArray(g) ? (g as Record<string, unknown>) : {};
}

/** Effective site-wide copy: V5 defaults overridden by valid merchant values. Never throws. */
export function themeGlobals(overrides?: Record<string, unknown> | null): ThemeGlobals {
  return resolveCopy(GLOBAL_COPY, overrides);
}

export const DEFAULT_THEME_GLOBALS: ThemeGlobals = themeGlobals();

/** True when `key` is at its V5 default (drives count-bearing variants such as "View all 42 products →"). */
export const isDefaultGlobal = (g: ThemeGlobals, key: string) => g[key] === DEFAULT_THEME_GLOBALS[key];

/** Save-time validation messages for the draft's site-wide copy. */
export function themeGlobalsProblems(overrides: Record<string, unknown> | null | undefined): string[] {
  return copyValueProblems(GLOBAL_COPY, overrides, "Header & footer");
}

/**
 * Only known keys with string values survive (unknown keys and non-strings are dropped), so theme_settings never
 * accumulates arbitrary payloads.
 */
export function cleanGlobalsForSave(overrides: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of GLOBAL_COPY) {
    const v = overrides?.[f.key];
    if (typeof v === "string" && v.trim()) out[f.key] = v.trim();
  }
  return out;
}
