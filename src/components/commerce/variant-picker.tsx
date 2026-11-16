"use client";

import { useId, useState } from "react";
import type { PublicVariant } from "@/types/catalog";

type Props = {
  optionNames: string[];
  variants: PublicVariant[];
  selected: PublicVariant | null;
  onSelect: (v: PublicVariant | null) => void;
};

export function deriveOptionNames(optionNames: string[] | undefined, variants: PublicVariant[]): string[] {
  if (optionNames && optionNames.length > 0) return optionNames;
  const fromValues = Array.from(new Set(variants.flatMap((v) => Object.keys(v.optionValues || {}))));
  if (fromValues.length > 0) return fromValues;
  if (variants.length > 1) return ["Option"];
  return [];
}

function valuesFor(optionName: string, variants: PublicVariant[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of variants) {
    const val =
      v.optionValues?.[optionName] ??
      (optionName === "Option" || optionName === "Variant" ? v.title : undefined);
    if (val && !seen.has(val)) {
      seen.add(val);
      out.push(val);
    }
  }
  return out;
}

function findVariant(
  variants: PublicVariant[],
  selection: Record<string, string>,
  optionNames: string[],
): PublicVariant | undefined {
  if (optionNames.length === 1 && (optionNames[0] === "Option" || optionNames[0] === "Variant")) {
    const targetTitle = selection[optionNames[0]];
    return variants.find((v) => (v.title || v.sku) === targetTitle);
  }
  return variants.find((v) =>
    optionNames.every((opt) => v.optionValues?.[opt] === selection[opt]),
  );
}

function isComboAvailable(
  variants: PublicVariant[],
  optionName: string,
  value: string,
  current: Record<string, string>,
  optionNames: string[],
): boolean {
  if (optionNames.length === 1 && (optionNames[0] === "Option" || optionNames[0] === "Variant")) {
    const v = variants.find((v) => (v.title || v.sku) === value);
    return Boolean(v && v.available);
  }
  const test = { ...current, [optionName]: value };
  return variants.some(
    (v) =>
      v.available &&
      Object.entries(test).every(([k, val]) => v.optionValues?.[k] === val),
  );
}

export function VariantPicker({ optionNames, variants, selected, onSelect }: Props) {
  const baseId = useId();
  const effectiveOptionNames = deriveOptionNames(optionNames, variants);

  const initialSelection = (): Record<string, string> => {
    if (!selected) return {};
    if (effectiveOptionNames.length === 1 && (effectiveOptionNames[0] === "Option" || effectiveOptionNames[0] === "Variant")) {
      return { [effectiveOptionNames[0]]: selected.title || selected.sku || "" };
    }
    return { ...selected.optionValues };
  };

  const [prevSelected, setPrevSelected] = useState<PublicVariant | null>(selected);
  const [selection, setSelection] = useState<Record<string, string>>(initialSelection);

  if (selected !== prevSelected) {
    setPrevSelected(selected);
    setSelection(initialSelection());
  }

  const handleChange = (optionName: string, value: string) => {
    const next = { ...selection, [optionName]: value };
    let match = findVariant(variants, next, effectiveOptionNames);

    if (!match) {
      // Auto-reconcile other dimensions to the first available variant matching this option
      match = variants.find((v) => {
        if (effectiveOptionNames.length === 1 && (effectiveOptionNames[0] === "Option" || effectiveOptionNames[0] === "Variant")) {
          return (v.title || v.sku) === value;
        }
        return v.optionValues?.[optionName] === value && v.available;
      }) || variants.find((v) => {
        if (effectiveOptionNames.length === 1 && (effectiveOptionNames[0] === "Option" || effectiveOptionNames[0] === "Variant")) {
          return (v.title || v.sku) === value;
        }
        return v.optionValues?.[optionName] === value;
      });

      if (match) {
        const reconciled =
          effectiveOptionNames.length === 1 && (effectiveOptionNames[0] === "Option" || effectiveOptionNames[0] === "Variant")
            ? { [effectiveOptionNames[0]]: match.title || match.sku || "" }
            : { ...match.optionValues };
        setSelection(reconciled);
        onSelect(match);
        return;
      }
    }

    setSelection(next);
    onSelect(match || null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {effectiveOptionNames.map((name, oi) => {
        const values = valuesFor(name, variants);
        if (values.length < 2) return null;
        const id = `${baseId}-opt-${oi}`;
        return (
          <fieldset key={name} style={{ border: 0, margin: 0, padding: 0 }}>
            <legend style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--lh-ink-2)", marginBottom: 8 }}>
              {name}: <span style={{ fontWeight: 700, color: "var(--lh-ink)" }}>{selection[name] || "None"}</span>
            </legend>
            <div id={id} role="radiogroup" aria-label={name} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {values.map((val) => {
                const active = selection[name] === val;
                const avail = isComboAvailable(variants, name, val, selection, effectiveOptionNames);
                return (
                  <button
                    key={val}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-disabled={!avail}
                    disabled={!avail}
                    onClick={() => handleChange(name, val)}
                    style={{
                      minWidth: 56,
                      height: 42,
                      padding: "0 16px",
                      borderRadius: 999,
                      border: active ? "2px solid var(--lh-action)" : "1px solid var(--lh-border)",
                      background: active ? "var(--lh-ice)" : "#FFFFFF",
                      color: avail ? "var(--lh-ink)" : "var(--lh-ink-2)",
                      fontWeight: active ? 700 : 500,
                      fontSize: 14,
                      cursor: avail ? "pointer" : "not-allowed",
                      opacity: avail ? 1 : 0.5,
                      textDecoration: avail ? "none" : "line-through",
                      transition: "all .15s ease",
                    }}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
