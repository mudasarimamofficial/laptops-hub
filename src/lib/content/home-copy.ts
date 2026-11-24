/**
 * Merchant-editable homepage copy (headings, kickers, intros, button labels and button links).
 *
 * Every value has a documented default equal to the approved V5 text, so a layout that never set a copy key renders
 * exactly the original page. Overrides are stored in the section's `settings` (theme_versions.sections) and go live
 * only when the merchant publishes. An empty or invalid override falls back to the default; "Reset" in the editor
 * removes the key. Values are plain text (React escapes them) — no HTML, no scripts.
 *
 * Client-safe: no server imports.
 */
import type { SectionType } from "./site-builder-schema";

export type CopyFieldKind = "text" | "textarea" | "link";

export type CopyField = {
  key: string;
  label: string;
  kind: CopyFieldKind;
  /** Approved V5 text, used whenever the merchant has not set (or has cleared) the field. */
  default: string;
  max: number;
  help?: string;
};

const KICKER_HELP = "Small label above the heading (shown in capitals).";
const LINK_HELP = "A page on this site (/collections/…, /pages/…, #section) or a full https:// link.";

const kicker = (d: string): CopyField => ({ key: "kicker", label: "Kicker", kind: "text", default: d, max: 60, help: KICKER_HELP });
const heading = (d: string, label = "Heading"): CopyField => ({ key: "heading", label, kind: "text", default: d, max: 120 });
const intro = (d: string, label = "Introduction"): CopyField => ({ key: "intro", label, kind: "textarea", default: d, max: 400 });
const label = (key: string, l: string, d: string): CopyField => ({ key, label: l, kind: "text", default: d, max: 60 });
const link = (key: string, l: string, d: string): CopyField => ({ key, label: l, kind: "link", default: d, max: 500, help: LINK_HELP });

export const HOME_COPY: Partial<Record<SectionType, CopyField[]>> = {
  v5_cinematic_hero: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", default: "DELL · HP · LENOVO", max: 60, help: "Small line above the main heading." },
    { key: "headingLine1", label: "Heading — line 1", kind: "text", default: "The future of", max: 60 },
    { key: "headingAccent", label: "Heading — line 2 (blue)", kind: "text", default: "smarter laptop", max: 60 },
    { key: "headingLine3", label: "Heading — line 3", kind: "text", default: "shopping.", max: 60 },
    intro(
      "Laptops from Dell, HP, Lenovo and more, with the processor, memory, storage and display listed on every page. Filter by spec, then compare up to four side by side.",
    ),
    label("primaryLabel", "Main button text", "Shop laptops"),
    link("primaryHref", "Main button link", "/collections/all"),
    label("secondaryLabel", "Second button text", "Explore categories"),
    link("secondaryHref", "Second button link", "#brands"),
  ],
  v5_product_story: [
    { ...kicker("PRODUCT STORY"), help: "Shown only when section numbers are switched on (Settings → Storefront labels)." },
    heading("Find your next machine."),
  ],
  v5_chromebook: [
    kicker("CHROMEBOOKS"),
    label("tag", "Status tag", "NOW LISTED"),
    heading("Chromebooks, made for", "Heading"),
    { key: "headingAccent", label: "Heading — blue ending", kind: "text", default: "everyday speed.", max: 60 },
    label("primaryLabel", "Main button text", "View Chromebook collection"),
    link("primaryHref", "Main button link", "/collections/chromebooks"),
    label("askLabel", "Ask button text", "Ask about Chromebooks"),
  ],
  v5_brand_grid: [kicker("BRANDS"), heading("Shop by brand"), label("cardCta", "Card link text", "View products →")],
  v5_featured_products: [
    kicker("FEATURED"),
    heading("Featured laptops"),
    { ...label("ctaLabel", "Button text", "View all laptops →"), help: "When catalog counts are on and this is unchanged, the button shows the laptop count." },
    link("ctaHref", "Button link", "/collections/laptops"),
  ],
  v5_promo: [kicker("FEATURED CONFIGURATION"), label("ctaLabel", "Button text", "View laptop →")],
  v5_spec_filters: [kicker("SPECIFICATIONS"), heading("Shop by spec")],
  v5_new_gen: [
    kicker("NEWER GENERATIONS"),
    heading("10th gen and newer"),
    intro("Intel Core 10th, 11th, 12th and 13th generation models.", "Supporting line"),
    { ...label("ctaLabel", "Link text", "View all →"), help: "When catalog counts are on and this is unchanged, the link shows the count." },
    link("ctaHref", "Link", "/collections/gen-10-plus"),
  ],
  v5_budget_bands: [kicker("BUDGET"), heading("Shop by budget")],
  v5_compare_demo: [
    kicker("COMPARE"),
    heading("Compare before you buy."),
    intro("Add up to four laptops and line up processor, memory, storage, display and price. Rows that differ are highlighted."),
    label("secondaryLabel", "Second button text", "Pick laptops"),
    link("secondaryHref", "Second button link", "/collections/all"),
  ],
  v5_home_inquiry: [
    kicker("NEED HELP CHOOSING?"),
    heading("Tell us what you're looking for."),
    intro(
      "Looking for a laptop for work, studies, gaming or everyday use? Share your requirements or ask about a model. Our team can review your message and contact you using the details you provide.",
    ),
    label("callLabel", "Phone heading", "Or call Laptops HUB"),
    label("submitLabel", "Send button text", "Send my inquiry"),
  ],
};

/** Copy fields of a section type (empty for types without editable copy). */
export const copyFields = (type: SectionType | string): CopyField[] => HOME_COPY[type as SectionType] ?? [];

/** All copy keys of a type, for quick membership checks. */
const copyKeySet = (type: string) => new Set(copyFields(type).map((f) => f.key));

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Safe link targets: a site path ("/…", never protocol-relative "//"), an in-page anchor ("#…"), or an absolute
 * https:// URL. Also tel: and mailto:. Everything else (javascript:, data:, http:, relative "foo") is rejected.
 */
export function isSafeCopyHref(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!s || s.length > 500 || /\s/.test(s)) return false;
  if (s.startsWith("/")) return !s.startsWith("//") && !s.startsWith("/\\");
  if (s.startsWith("#")) return /^#[A-Za-z][\w-]*$/.test(s);
  if (/^tel:\+?[\d-]{5,20}$/.test(s)) return true;
  if (/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return true;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !!u.hostname;
  } catch {
    return false;
  }
}

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(CONTROL, "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * Effective copy of a section: defaults, overridden by valid merchant values from `settings`. Never throws; unknown
 * keys are ignored, invalid links and empty strings fall back to the default.
 */
export function homeCopy(type: SectionType, settings?: Record<string, unknown> | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of copyFields(type)) {
    const raw = settings?.[f.key];
    if (f.kind === "link") {
      out[f.key] = isSafeCopyHref(raw) ? raw.trim() : f.default;
    } else {
      out[f.key] = cleanText(raw, f.max) ?? f.default;
    }
  }
  return out;
}

/** True when the merchant left this copy value at its default (unset, empty, or equal to the default). */
export function isDefaultCopy(type: SectionType, settings: Record<string, unknown> | null | undefined, key: string): boolean {
  const f = copyFields(type).find((x) => x.key === key);
  if (!f) return true;
  return homeCopy(type, settings)[key] === f.default;
}

/** Validation messages for a draft save (shown to the merchant; nothing is saved while any remain). */
export function homeCopyProblems(sections: { type: string; label?: string; settings: Record<string, unknown> }[]): string[] {
  const out: string[] = [];
  for (const s of sections) {
    const keys = copyKeySet(s.type);
    if (!keys.size) continue;
    for (const f of copyFields(s.type)) {
      const v = s.settings?.[f.key];
      if (v === undefined || v === null || v === "") continue;
      const where = `${s.label || s.type} → ${f.label}`;
      if (typeof v !== "string") {
        out.push(`${where}: must be text.`);
        continue;
      }
      if (v.length > f.max) out.push(`${where}: keep it under ${f.max} characters.`);
      if (f.kind === "link" && !isSafeCopyHref(v))
        out.push(`${where}: use a site path such as /collections/all, a #section, or a full https:// link.`);
    }
  }
  return out;
}
