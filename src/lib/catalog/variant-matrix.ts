/**
 * Shopify-style product option → variant matrix helpers (max 3 option dimensions).
 */

export type ProductOptionDef = {
  name: string;
  values: string[];
};

export type OptionValuesMap = Record<string, string>;

export type GeneratedVariantRow = {
  key: string;
  title: string;
  optionValues: OptionValuesMap;
};

const MAX_OPTIONS = 3;
const MAX_VALUES_PER_OPTION = 40;
const MAX_VARIANTS = 250;

export function normalizeOptionName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, 60);
}

export function normalizeOptionValue(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

/** Cartesian product of option values → variant rows. */
export function generateVariantMatrix(options: ProductOptionDef[]): {
  rows: GeneratedVariantRow[];
  errors: string[];
} {
  const errors: string[] = [];
  const cleaned: ProductOptionDef[] = [];

  for (const opt of options.slice(0, MAX_OPTIONS)) {
    const name = normalizeOptionName(opt.name);
    if (!name) continue;
    const values = [...new Set((opt.values || []).map(normalizeOptionValue).filter(Boolean))];
    if (!values.length) {
      errors.push(`Option "${name}" needs at least one value.`);
      continue;
    }
    if (values.length > MAX_VALUES_PER_OPTION) {
      errors.push(`Option "${name}" exceeds ${MAX_VALUES_PER_OPTION} values.`);
    }
    cleaned.push({ name, values: values.slice(0, MAX_VALUES_PER_OPTION) });
  }

  if (!cleaned.length) {
    return {
      rows: [{ key: "Default", title: "Default", optionValues: {} }],
      errors,
    };
  }

  let combos: OptionValuesMap[] = [{}];
  for (const opt of cleaned) {
    const next: OptionValuesMap[] = [];
    for (const base of combos) {
      for (const v of opt.values) {
        next.push({ ...base, [opt.name]: v });
      }
    }
    combos = next;
  }

  if (combos.length > MAX_VARIANTS) {
    errors.push(`Combination would create ${combos.length} variants (max ${MAX_VARIANTS}). Reduce option values.`);
    combos = combos.slice(0, MAX_VARIANTS);
  }

  const rows = combos.map((optionValues) => {
    const parts = cleaned.map((o) => optionValues[o.name]).filter(Boolean);
    const title = parts.join(" / ") || "Default";
    const key = cleaned.map((o) => `${o.name}=${optionValues[o.name]}`).join("|");
    return { key, title, optionValues };
  });

  return { rows, errors };
}

export function optionValuesEqual(a: OptionValuesMap, b: OptionValuesMap): boolean {
  const ak = Object.keys(a).sort();
  const bk = Object.keys(b).sort();
  if (ak.length !== bk.length) return false;
  return ak.every((k, i) => k === bk[i] && a[k] === b[k]);
}

export function parseOptionValuesCsv(text: string): string[] {
  return text
    .split(/[,|\n]/)
    .map(normalizeOptionValue)
    .filter(Boolean);
}

export function inferOptionsFromVariants(
  optionNames: string[],
  variants: { optionValues: OptionValuesMap }[],
): ProductOptionDef[] {
  const names =
    optionNames.length > 0
      ? optionNames.map(normalizeOptionName).filter(Boolean).slice(0, MAX_OPTIONS)
      : (() => {
          const set = new Set<string>();
          for (const v of variants) {
            Object.keys(v.optionValues || {}).forEach((k) => set.add(k));
          }
          return [...set].slice(0, MAX_OPTIONS);
        })();

  return names.map((name) => {
    const values = [
      ...new Set(
        variants
          .map((v) => normalizeOptionValue(String(v.optionValues?.[name] || "")))
          .filter(Boolean),
      ),
    ];
    return { name, values };
  });
}

export const VARIANT_MATRIX_LIMITS = {
  MAX_OPTIONS,
  MAX_VALUES_PER_OPTION,
  MAX_VARIANTS,
} as const;
