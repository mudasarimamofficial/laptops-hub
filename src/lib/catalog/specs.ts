import type { PublicProduct } from "@/types/catalog";

export type SpecRow = { label: string; value: string };

type SpecSource = Pick<PublicProduct, "manufacturer" | "specs" | "sku">;

/** Trim and reject empty / placeholder values. Only strings and finite numbers are displayable. */
export function cleanSpecValue(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  if (!s || /^(null|undefined|n\/a|-|—)$/i.test(s)) return null;
  return s;
}

function first(specs: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = cleanSpecValue(specs[k]);
    if (v) return v;
  }
  return null;
}

export function ordinal(n: number): string {
  const s = n % 100;
  if (s >= 11 && s <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] || "th"}`;
}

/** "i5" → "Core i5" (same rule as the V5 prototype's cpuFmt). Other values unchanged. */
export function formatCpu(v: string): string {
  return /^i\d$/i.test(v) ? `Core ${v.toLowerCase()}` : v;
}

export function isMerchantVendor(m: string | null | undefined): boolean {
  return !!m && /laptops\s*hub/i.test(m);
}

export function modelName(title: string, specs: Record<string, unknown> | null | undefined): string {
  return cleanSpecValue(specs?.model) || cleanSpecValue(title.split(" - ")[0]) || title;
}

/**
 * Customer-facing specification rows, in V5 order.
 * Reads source keys as imported (verbatim source labels first, parsed short keys as fallback).
 * Never fills a value the source does not contain; raw `specs` is left untouched.
 */
export function curateSpecs(p: SpecSource): SpecRow[] {
  const s = p.specs || {};
  const rows: SpecRow[] = [];
  const push = (label: string, value: string | null) => {
    if (value) rows.push({ label, value });
  };

  push("Brand", isMerchantVendor(p.manufacturer) ? null : cleanSpecValue(p.manufacturer));
  push("Model", first(s, ["model"]));

  let processor = first(s, ["Processor", "processor"]);
  if (!processor) {
    const cpu = first(s, ["cpu"]);
    const gen = first(s, ["gen"]);
    if (cpu) processor = formatCpu(cpu) + (gen && /^\d{1,2}$/.test(gen) ? `, ${ordinal(Number(gen))} gen` : "");
  }
  push("Processor", processor);

  push("RAM", first(s, ["Memory", "Memory (CRM config)", "ram", "memory"]));
  push("Storage", first(s, ["Storage", "Storage (CRM config)", "storage", "sto"]));

  let display = first(s, ["Display", "display", "screen"]);
  if (!display) {
    const size = first(s, ["size"]);
    if (size && /^\d{1,2}(\.\d{1,2})?$/.test(size)) display = `${size}"`;
  }
  push("Display", display);
  push("Resolution", first(s, ["Resolution / panel", "resolution"]));
  push("Touchscreen", first(s, ["Touch"]) || (s.touch === true ? "Yes" : null));
  push("Graphics", first(s, ["Graphics", "graphics", "gpu"]));
  push("Operating system", first(s, ["Operating system", "Operating system (source reference)", "os", "operating_system"]));
  push("Condition", first(s, ["Condition", "condition", "cond"]));
  push("SKU", cleanSpecValue(p.sku));
  return rows;
}

/**
 * Server-side boundary for public objects: renames internally-labelled source keys and drops
 * source-conflict notes, so serialized props / API JSON never carry "CRM" or "source reference" labels.
 * Values are not changed. The database row is not changed.
 */
const SPEC_KEY_RENAMES: Record<string, string> = {
  "Memory (CRM config)": "Memory",
  "Storage (CRM config)": "Storage",
  "Operating system (source reference)": "Operating system",
};
const SPEC_KEYS_DROPPED = new Set(["Memory (source reference)", "Storage (source reference)", "Note"]);

export function toPublicSpecs(raw: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (SPEC_KEYS_DROPPED.has(k) || (/crm|source reference|internal/i.test(k) && !(k in SPEC_KEY_RENAMES))) continue;
    const key = SPEC_KEY_RENAMES[k] || k;
    if (key in out && cleanSpecValue(out[key])) continue;
    out[key] = v;
  }
  return out;
}

/** Import QA flags (UPPER_SNAKE, e.g. CONFIG_REVIEW) are internal; ordinary tags pass through. */
export function publicTags(tags: string[] | null | undefined): string[] {
  return (tags || []).filter((t) => typeof t === "string" && !/^[A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(t));
}

/**
 * Keys the import writes into the generated "key: value · key: value" paragraph of description_safe
 * (all keys present in the catalog snapshot's specs objects).
 */
export const GENERATED_SPEC_KEYS = new Set([
  "Processor",
  "Memory (CRM config)",
  "Memory (source reference)",
  "Storage (CRM config)",
  "Storage (source reference)",
  "Graphics",
  "Display",
  "Resolution / panel",
  "Touch",
  "Operating system (source reference)",
  "Condition",
]);

const KEY_SPLIT = / · (?=[A-Z][\w ()/.-]{0,60}: )/;

/**
 * The import appends an auto-generated "key: value · key: value" paragraph (internal labels such as
 * "Memory (CRM config)") to description_safe. A paragraph counts as generated only when every
 * segment starts with a known generated key. Values may themselves contain " · " ("Core i5 · 11th gen").
 */
export function isSpecDumpParagraph(paragraph: string): boolean {
  const parts = paragraph.trim().split(KEY_SPLIT);
  if (!parts.length || !parts[0]) return false;
  return parts.every((part) => {
    const i = part.indexOf(": ");
    return i > 0 && GENERATED_SPEC_KEYS.has(part.slice(0, i)) && part.slice(i + 2).trim() !== "";
  });
}

export function publicDescription(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && !isSpecDumpParagraph(p))
    .join("\n\n");
}
