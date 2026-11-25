/**
 * Admin → Settings → "SEO title suffix" (store_settings key `seo_defaults`, `{ title_suffix }`).
 * Client-safe parsing; the server read lives in seo-defaults-server.ts.
 */
export const SEO_DEFAULTS_KEY = "seo_defaults";

/** Approved title template used whenever no suffix is set. */
export const DEFAULT_TITLE_TEMPLATE = "%s · Laptops HUB";

const CONTROL = /[\u0000-\u001F\u007F]/g;

/** Clean suffix (plain text, ≤ 80 chars) or "" when unset/invalid. */
export function parseTitleSuffix(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const raw = (value as Record<string, unknown>).title_suffix;
  if (typeof raw !== "string") return "";
  const s = raw.replace(CONTROL, "").replace(/\s+/g, " ").trim();
  return s.length > 80 ? s.slice(0, 80).trim() : s;
}

/** Title template for page titles: "%s | Laptops HUB" for suffix "| Laptops HUB"; the V5 template when unset. */
export function titleTemplate(suffix: string): string {
  return suffix ? `%s ${suffix}` : DEFAULT_TITLE_TEMPLATE;
}

/**
 * Homepage search appearance (same `seo_defaults` row): `home_title`, `home_description`. Empty → the defaults below,
 * which use only verified business facts (name, city, catalog brands; address from Contact & Social settings).
 * The homepage title is used as-is (no suffix): it already carries the brand.
 */
export const DEFAULT_HOME_TITLE = "Laptops HUB — Laptop Shop in Bahawalpur, Pakistan";
export const DEFAULT_HOME_DESCRIPTION =
  "Laptops HUB, University Chowk, Bahawalpur: Dell, HP, Lenovo and more, with the processor, memory, storage and display listed on every laptop. Compare up to four side by side.";
export const HOME_TITLE_MAX = 120;
export const HOME_DESCRIPTION_MAX = 320;

/** Plain text only: control characters removed, whitespace collapsed, length capped. */
export function cleanSeoText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const s = value.replace(CONTROL, " ").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max).trim() : s;
}

export type SeoDefaults = { titleSuffix: string; homeTitle: string; homeDescription: string };

/** Stored values (empty = use the default). */
export function parseSeoDefaults(value: unknown): SeoDefaults {
  const v = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    titleSuffix: parseTitleSuffix(value),
    homeTitle: cleanSeoText(v.home_title, HOME_TITLE_MAX),
    homeDescription: cleanSeoText(v.home_description, HOME_DESCRIPTION_MAX),
  };
}

/** What the homepage actually uses. */
export function homeSearchAppearance(d: SeoDefaults): { title: string; description: string } {
  return { title: d.homeTitle || DEFAULT_HOME_TITLE, description: d.homeDescription || DEFAULT_HOME_DESCRIPTION };
}
