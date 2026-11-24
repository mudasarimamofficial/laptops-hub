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
