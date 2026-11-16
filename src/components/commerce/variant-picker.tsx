"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import type { PublicVariant } from "@/types/catalog";

/**
 * PDP variant picker. Controlled: the parent owns the selected VARIANT (never a loose option map), so whatever the
 * shopper sees is always one real variant id — the only thing the cart and create_cod_order receive.
 *
 * "options" mode needs every variant to carry a value for every option name and every combination to be unique.
 * Otherwise (missing option_names, partial option_values, duplicates) the picker lists the variants themselves, so
 * each one stays reachable and nothing silently collapses onto the first variant.
 */
export type PickerModel = { mode: "options"; names: string[] } | { mode: "list"; label: string };

const val = (v: PublicVariant, name: string) => {
  const x = v.optionValues?.[name];
  return typeof x === "string" && x.trim() !== "" ? x.trim() : null;
};

export function pickerModel(optionNames: string[] | undefined, variants: PublicVariant[]): PickerModel {
  const declared = (optionNames || []).map((n) => n.trim()).filter(Boolean);
  const names = declared.length
    ? declared
    : Array.from(new Set(variants.flatMap((v) => Object.keys(v.optionValues || {})))).filter(Boolean);
  if (names.length) {
    const complete = variants.every((v) => names.every((n) => val(v, n) !== null));
    const tuples = new Set(variants.map((v) => names.map((n) => val(v, n)).join("\u0000")));
    if (complete && tuples.size === variants.length) return { mode: "options", names };
  }
  return { mode: "list", label: declared.length === 1 ? declared[0] : "Option" };
}

/** Human label for one variant ("16GB / 512GB", or its title, disambiguated when titles repeat). */
export function variantLabel(v: PublicVariant, model: PickerModel, variants: PublicVariant[]): string {
  if (model.mode === "options") return model.names.map((n) => val(v, n)).join(" / ");
  const title = (v.title || "").trim();
  const usable = title && title.toLowerCase() !== "default" && variants.filter((o) => (o.title || "").trim() === title).length === 1;
  if (usable) return title;
  const base = title && title.toLowerCase() !== "default" ? title : `Option ${variants.indexOf(v) + 1}`;
  return v.sku ? `${base} (${v.sku})` : base;
}

export function optionValues(name: string, variants: PublicVariant[]): string[] {
  return Array.from(new Set(variants.map((v) => val(v, name)).filter((x): x is string => x !== null)));
}

/**
 * Variant reached by choosing `value` for `name` from `current`: the exact combination when it exists, otherwise the
 * variant with that value that keeps most of the other current choices, preferring one that is in stock.
 */
export function resolveChoice(variants: PublicVariant[], names: string[], current: PublicVariant, name: string, value: string): PublicVariant {
  const want = (n: string) => (n === name ? value : val(current, n));
  const exact = variants.find((v) => names.every((n) => val(v, n) === want(n)));
  if (exact) return exact;
  let best: PublicVariant | null = null;
  let bestScore = -1;
  for (const v of variants) {
    if (val(v, name) !== value) continue;
    const score = (v.available ? 100 : 0) + names.filter((n) => n !== name && val(v, n) === val(current, n)).length;
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best ?? current;
}

export type ValueState = "selected" | "available" | "soldout" | "unavailable";

export function valueState(variants: PublicVariant[], names: string[], current: PublicVariant, name: string, value: string): ValueState {
  if (val(current, name) === value) return "selected";
  const combo = variants.find((v) => names.every((n) => val(v, n) === (n === name ? value : val(current, n))));
  if (!combo) return "unavailable";
  return combo.available ? "available" : "soldout";
}

type Props = {
  optionNames: string[];
  variants: PublicVariant[];
  selected: PublicVariant;
  onSelect: (v: PublicVariant) => void;
};

const chip = (state: ValueState) =>
  ({
    minWidth: 56,
    minHeight: 44,
    padding: "0 16px",
    borderRadius: 999,
    border: state === "selected" ? "2px solid var(--lh-action)" : state === "unavailable" ? "1px dashed var(--lh-border)" : "1px solid var(--lh-border)",
    background: state === "selected" ? "var(--lh-ice)" : "#FFFFFF",
    color: state === "available" || state === "selected" ? "var(--lh-ink)" : "var(--lh-ink-2)",
    fontWeight: state === "selected" ? 700 : 500,
    fontSize: 14,
    cursor: "pointer",
    textDecoration: state === "soldout" ? "line-through" : "none",
    transition: "border-color .15s ease, background .15s ease",
  }) as const;

function Group({ label, current, items, onPick }: { label: string; current: string; items: { key: string; text: string; state: ValueState; pick: () => void; ariaNote: string }[]; onPick?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + items.length) % items.length;
    items[next].pick();
    onPick?.();
    ref.current?.querySelectorAll<HTMLButtonElement>("button[role=radio]")[next]?.focus();
  };
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      <legend style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--lh-ink-2)", marginBottom: 8 }}>
        {label}: <span style={{ fontWeight: 700, color: "var(--lh-ink)" }}>{current}</span>
      </legend>
      <div ref={ref} role="radiogroup" aria-label={label} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {items.map((it, i) => (
          <button
            key={it.key}
            type="button"
            role="radio"
            aria-checked={it.state === "selected"}
            aria-label={it.ariaNote ? `${it.text}, ${it.ariaNote}` : it.text}
            tabIndex={it.state === "selected" ? 0 : -1}
            data-state={it.state}
            onClick={it.pick}
            onKeyDown={(e) => onKey(e, i)}
            style={chip(it.state)}
          >
            {it.text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const NOTE: Record<ValueState, string> = { selected: "", available: "", soldout: "sold out", unavailable: "not available with the current selection" };

export function VariantPicker({ optionNames, variants, selected, onSelect }: Props) {
  const baseId = useId();
  const model = pickerModel(optionNames, variants);

  if (model.mode === "list") {
    return (
      <div id={baseId} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Group
          label={model.label}
          current={variantLabel(selected, model, variants)}
          items={variants.map((v) => {
            const state: ValueState = v.id === selected.id ? "selected" : v.available ? "available" : "soldout";
            return { key: v.id, text: variantLabel(v, model, variants), state, pick: () => onSelect(v), ariaNote: v.available ? NOTE[state] : "sold out" };
          })}
        />
      </div>
    );
  }

  return (
    <div id={baseId} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {model.names.map((name) => {
        const values = optionValues(name, variants);
        if (values.length < 2) return null; // a single fixed value is not a choice
        return (
          <Group
            key={name}
            label={name}
            current={val(selected, name) ?? ""}
            items={values.map((value) => {
              const state = valueState(variants, model.names, selected, name, value);
              // The selected value keeps saying "sold out" when the selected variant cannot be bought.
              const ariaNote = state === "selected" && !selected.available ? "sold out" : NOTE[state];
              return { key: value, text: value, state, pick: () => onSelect(resolveChoice(variants, model.names, selected, name, value)), ariaNote };
            })}
          />
        );
      })}
    </div>
  );
}
