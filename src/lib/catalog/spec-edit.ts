import { z } from "zod";
import { SPEC_ORDER } from "@/lib/catalog/v5-model";

/**
 * Admin editing of `products.specs` (G04). The JSON column holds:
 * - lowercase "filter" keys read by the V5 model (chips, filters, compare, menu counts, SEO title):
 *   model, config, cpu, gen, ram ("8GB"), storage ("256GB"), size (inches), touch, condition;
 * - the product page spec table rows, a fixed list (`SPEC_ORDER`: Processor, Memory, Storage, Graphics, Display,
 *   Resolution / panel, Touch, Operating system, Condition);
 * - other keys (import references such as "Memory (CRM config)") that the storefront never shows.
 * Only the first two groups are edited; every other key is kept as stored. Values are plain text (React escapes them).
 *
 * Client-safe (no server imports).
 */

export const SPEC_CONDITIONS = ["New", "Used", "Refurbished"] as const;
/** [stored key, storefront label] for each spec table row. */
export const SPEC_TABLE_FIELDS: readonly (readonly [string, string])[] = SPEC_ORDER;
const TABLE_KEYS = SPEC_ORDER.map(([k]) => k);

const text = (max: number) => z.string().trim().max(max);
const whole = (min: number, max: number, what: string) =>
  z.number().min(min).max(max).nullable().refine((v) => v === null || Number.isInteger(v), `${what} must be a whole number`);

export const specEditSchema = z.object({
  model: text(120),
  config: text(200),
  cpu: text(60),
  gen: whole(1, 30, "Generation"),
  ramGb: whole(1, 1024, "RAM"),
  storageGb: whole(1, 65536, "Storage"),
  sizeIn: z.number().min(5).max(40).nullable(),
  touch: z.boolean(),
  condition: z.enum(["", ...SPEC_CONDITIONS]),
  /** Spec table rows by stored key; unknown keys are refused. Empty = row hidden. */
  table: z.record(z.string(), text(300)).refine((t) => Object.keys(t).every((k) => TABLE_KEYS.includes(k)), "Unknown spec table row"),
});

export type SpecEdit = z.infer<typeof specEditSchema>;

const FILTER_KEYS = ["model", "config", "cpu", "gen", "ram", "storage", "sto", "size", "touch", "condition"];

const str = (v: unknown) => (v == null ? "" : String(v).trim());
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}
/** "8GB" → 8, "1TB" → 1024, 256 → 256. */
function gb(v: unknown): number | null {
  if (v == null || v === "") return null;
  const s = String(v).trim().toUpperCase();
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(s.endsWith("TB") ? n * 1024 : n);
}

/** Stored specs → editor values. */
export function specEditFromStored(specs: Record<string, unknown> | null | undefined): SpecEdit {
  const s = specs || {};
  const cond = str(s.condition);
  const table: Record<string, string> = {};
  for (const k of TABLE_KEYS) table[k] = str(s[k]);
  return {
    model: str(s.model),
    config: str(s.config),
    cpu: str(s.cpu),
    gen: num(s.gen),
    ramGb: gb(s.ram),
    storageGb: gb(s.storage ?? s.sto),
    sizeIn: num(s.size),
    touch: s.touch === true || s.touch === "true",
    condition: (SPEC_CONDITIONS as readonly string[]).includes(cond) ? (cond as SpecEdit["condition"]) : "",
    table,
  };
}

/**
 * Editor values → specs to store. Starts from the stored object so other keys survive; replaces the filter keys and
 * the table rows that were sent. Empty values are stored as null (the storefront hides them), never invented.
 */
export function applySpecEdit(stored: Record<string, unknown> | null | undefined, edit: SpecEdit): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(stored || {})) if (!FILTER_KEYS.includes(k)) out[k] = v;
  out.model = edit.model || null;
  out.config = edit.config || null;
  out.cpu = edit.cpu || null;
  out.gen = edit.gen;
  out.ram = edit.ramGb ? `${edit.ramGb}GB` : null;
  out.storage = edit.storageGb ? `${edit.storageGb}GB` : null;
  out.size = edit.sizeIn;
  out.touch = edit.touch ? true : null;
  out.condition = edit.condition || null;
  for (const [k, v] of Object.entries(edit.table)) {
    const value = v.trim();
    if (value) out[k] = value;
    else delete out[k];
  }
  return out;
}
