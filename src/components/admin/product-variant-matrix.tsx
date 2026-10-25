"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { paisaToMajor } from "@/lib/money";
import {
  generateVariantMatrix,
  inferOptionsFromVariants,
  parseOptionValuesCsv,
  type OptionValuesMap,
  type ProductOptionDef,
} from "@/lib/catalog/variant-matrix";

export type MatrixVariant = {
  id: string;
  title: string;
  sku: string | null;
  barcode?: string | null;
  pricePaisa: number;
  compareAtPaisa?: number | null;
  inventoryMode: "tracked" | "untracked";
  quantityOnHand: number | null;
  purchasable: boolean;
  optionValues: OptionValuesMap;
  position?: number;
};

type EditableRow = {
  id?: string;
  key: string;
  title: string;
  sku: string;
  barcode: string;
  pricePkr: string;
  compareAtPkr: string;
  inventoryMode: "tracked" | "untracked";
  quantityOnHand: string;
  purchasable: boolean;
  optionValues: OptionValuesMap;
};

type Props = {
  handle: string;
  optionNames: string[];
  variants: MatrixVariant[];
};

function toEditable(v: MatrixVariant): EditableRow {
  return {
    id: v.id,
    key: Object.entries(v.optionValues || {})
      .map(([k, val]) => `${k}=${val}`)
      .join("|") || v.id,
    title: v.title,
    sku: v.sku || "",
    barcode: v.barcode || "",
    pricePkr: String(paisaToMajor(v.pricePaisa)),
    compareAtPkr: v.compareAtPaisa != null ? String(paisaToMajor(v.compareAtPaisa)) : "",
    inventoryMode: v.inventoryMode === "tracked" ? "tracked" : "untracked",
    quantityOnHand: String(v.quantityOnHand ?? 0),
    purchasable: v.purchasable !== false,
    optionValues: v.optionValues || {},
  };
}

export function ProductVariantMatrix({ handle, optionNames, variants }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const inferred = inferOptionsFromVariants(
    optionNames,
    variants.map((v) => ({ optionValues: v.optionValues || {} })),
  );
  const [options, setOptions] = useState<ProductOptionDef[]>(
    inferred.length
      ? inferred
      : [
          { name: "Title", values: ["Default"] },
        ],
  );
  const [rows, setRows] = useState<EditableRow[]>(() => variants.map(toEditable));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const preview = useMemo(() => generateVariantMatrix(options), [options]);

  function updateOption(index: number, patch: Partial<ProductOptionDef>) {
    setOptions((list) => list.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  function addOption() {
    if (options.length >= 3) return;
    setOptions((list) => [...list, { name: `Option ${list.length + 1}`, values: ["Value"] }]);
  }

  function removeOption(index: number) {
    setOptions((list) => list.filter((_, i) => i !== index));
  }

  function regenerateMatrix() {
    const { rows: generated, errors } = generateVariantMatrix(options);
    if (errors.length) {
      setErr(errors.join(" "));
      return;
    }
    setErr(null);
    const defaultPrice = rows[0]?.pricePkr || "0";
    const defaultMode = rows[0]?.inventoryMode || "untracked";
    setRows(
      generated.map((g) => {
        const existing = rows.find(
          (r) =>
            JSON.stringify(r.optionValues) === JSON.stringify(g.optionValues) ||
            r.key === g.key,
        );
        return {
          id: existing?.id,
          key: g.key,
          title: g.title,
          sku: existing?.sku || "",
          barcode: existing?.barcode || "",
          pricePkr: existing?.pricePkr || defaultPrice,
          compareAtPkr: existing?.compareAtPkr || "",
          inventoryMode: existing?.inventoryMode || defaultMode,
          quantityOnHand: existing?.quantityOnHand || "0",
          purchasable: existing?.purchasable !== false,
          optionValues: g.optionValues,
        };
      }),
    );
    setMsg(`Matrix regenerated: ${generated.length} variant${generated.length === 1 ? "" : "s"}. Review prices, then save.`);
  }

  function patchRow(index: number, patch: Partial<EditableRow>) {
    setRows((list) => list.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(handle)}/variants`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionNames: options.map((o) => o.name).filter(Boolean),
          options,
          removeMissing: true,
          variants: rows.map((r, i) => ({
            id: r.id,
            title: r.title,
            sku: r.sku.trim() || null,
            barcode: r.barcode.trim() || null,
            pricePkr: Number(r.pricePkr) || 0,
            compareAtPkr: r.compareAtPkr === "" ? null : Number(r.compareAtPkr),
            inventoryMode: r.inventoryMode,
            quantityOnHand: r.inventoryMode === "tracked" ? Number(r.quantityOnHand) || 0 : null,
            purchasable: r.purchasable,
            optionValues: r.optionValues,
            position: i + 1,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Save failed (${res.status})`);
        return;
      }
      setMsg(data.notice || `Saved ${data.results?.length || rows.length} variants.`);
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Variants &amp; options</h2>
          <p className="mt-1 text-sm text-[var(--adm-ink-2)]">
            Up to three option dimensions (Shopify-style). Generate the matrix, edit each SKU/price, then save.
            Variants on past orders are never hard-deleted.
          </p>
        </div>
        <button
          type="button"
          disabled={!hydrated || options.length >= 3}
          onClick={addOption}
          className="rounded-lg border border-[var(--adm-border)] px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          Add option
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {options.map((opt, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-3 md:grid-cols-[180px_1fr_auto]">
            <label className="text-sm">
              <span className="font-medium">Option name</span>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-2 py-1.5 text-sm"
                value={opt.name}
                onChange={(e) => updateOption(i, { name: e.target.value })}
                placeholder="e.g. RAM"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium">Values (comma-separated)</span>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-2 py-1.5 text-sm"
                value={opt.values.join(", ")}
                onChange={(e) => updateOption(i, { values: parseOptionValuesCsv(e.target.value) })}
                placeholder="8GB, 16GB, 32GB"
              />
            </label>
            <button
              type="button"
              className="self-end rounded border border-[var(--adm-border)] px-2 py-1.5 text-xs font-semibold text-[var(--adm-danger)]"
              onClick={() => removeOption(i)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!hydrated}
          onClick={regenerateMatrix}
          className="rounded-lg bg-[var(--lh-navy)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Generate / refresh matrix ({preview.rows.length})
        </button>
        {preview.errors.length ? (
          <p className="text-xs text-[var(--adm-danger)]">{preview.errors.join(" ")}</p>
        ) : null}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--adm-border)] text-xs uppercase tracking-wide text-[var(--adm-ink-2)]">
            <tr>
              <th className="px-2 py-2">Variant</th>
              <th className="px-2 py-2">SKU</th>
              <th className="px-2 py-2">Price (PKR)</th>
              <th className="px-2 py-2">Compare-at</th>
              <th className="px-2 py-2">Inventory</th>
              <th className="px-2 py-2">Qty</th>
              <th className="px-2 py-2">Sell</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key || r.id || i} className="border-b border-[var(--adm-border)] align-top">
                <td className="px-2 py-2">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-[var(--adm-ink-2)]">
                    {Object.entries(r.optionValues)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ") || "Default"}
                  </div>
                </td>
                <td className="px-2 py-2">
                  <input
                    className="w-28 rounded border border-[var(--adm-border)] px-1.5 py-1 text-xs"
                    value={r.sku}
                    onChange={(e) => patchRow(i, { sku: e.target.value })}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min={0}
                    className="w-24 rounded border border-[var(--adm-border)] px-1.5 py-1 text-xs"
                    value={r.pricePkr}
                    onChange={(e) => patchRow(i, { pricePkr: e.target.value })}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min={0}
                    className="w-24 rounded border border-[var(--adm-border)] px-1.5 py-1 text-xs"
                    value={r.compareAtPkr}
                    onChange={(e) => patchRow(i, { compareAtPkr: e.target.value })}
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    className="rounded border border-[var(--adm-border)] px-1.5 py-1 text-xs"
                    value={r.inventoryMode}
                    onChange={(e) =>
                      patchRow(i, { inventoryMode: e.target.value as "tracked" | "untracked" })
                    }
                  >
                    <option value="untracked">Untracked</option>
                    <option value="tracked">Tracked</option>
                  </select>
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min={0}
                    disabled={r.inventoryMode !== "tracked"}
                    className="w-16 rounded border border-[var(--adm-border)] px-1.5 py-1 text-xs disabled:opacity-40"
                    value={r.quantityOnHand}
                    onChange={(e) => patchRow(i, { quantityOnHand: e.target.value })}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={r.purchasable}
                    onChange={(e) => patchRow(i, { purchasable: e.target.checked })}
                    aria-label="Purchasable"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!hydrated || busy || !rows.length}
          onClick={save}
          className="rounded-lg bg-[var(--lh-action)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save variants"}
        </button>
        {msg ? <p className="text-sm text-[var(--adm-success)]">{msg}</p> : null}
        {err ? (
          <p className="text-sm text-[var(--adm-danger)]" role="alert">
            {err}
          </p>
        ) : null}
      </div>
    </section>
  );
}
