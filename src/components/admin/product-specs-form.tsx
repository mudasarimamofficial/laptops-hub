"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { AdminField, admInputClass } from "@/components/admin/ui/admin-field";
import { SPEC_CONDITIONS, SPEC_TABLE_FIELDS, type SpecEdit } from "@/lib/catalog/spec-edit";

type Props = { handle: string; initial: SpecEdit };

const numOrNull = (v: string) => {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Admin → product → Specifications (G04). The typed fields drive the storefront chips, filters, compare and menu
 * counts; the table rows are the spec table on the product page. Only facts about this unit: leave a field empty when
 * unsure. Other stored keys (import references) are kept untouched.
 */
export function ProductSpecsForm({ handle, initial }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [v, setV] = useState(() => ({
    model: initial.model,
    config: initial.config,
    cpu: initial.cpu,
    gen: initial.gen?.toString() ?? "",
    ramGb: initial.ramGb?.toString() ?? "",
    storageGb: initial.storageGb?.toString() ?? "",
    sizeIn: initial.sizeIn?.toString() ?? "",
    touch: initial.touch,
    condition: initial.condition,
  }));
  const [table, setTable] = useState<Record<string, string>>(initial.table);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));

  async function save() {
    setMsg(null);
    setErr(null);
    const gen = numOrNull(v.gen);
    const ramGb = numOrNull(v.ramGb);
    const storageGb = numOrNull(v.storageGb);
    const sizeIn = numOrNull(v.sizeIn);
    if ([gen, ramGb, storageGb, sizeIn].some((n) => Number.isNaN(n))) {
      setErr("Generation, RAM, storage and screen size must be numbers (or empty).");
      return;
    }
    const specs: SpecEdit = {
      model: v.model,
      config: v.config,
      cpu: v.cpu,
      gen,
      ramGb,
      storageGb,
      sizeIn,
      touch: v.touch,
      condition: v.condition,
      table,
    };
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(handle)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || `Save failed (${res.status})`);
        return;
      }
      setMsg("Specifications saved. The storefront shows them within a minute.");
      router.refresh();
    } catch {
      setErr("Network error. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="mt-10 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]"
      data-testid="product-specs-form"
    >
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Specifications</h2>
      <p className="mt-1 max-w-3xl text-sm text-[var(--adm-ink-2)]">
        These drive the spec chips, filters, compare table and menu counts. Enter only what is true for this unit and
        leave anything unknown empty.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AdminField label="Model" hint="e.g. Dell Latitude 5400">
          <input className={admInputClass} value={v.model} maxLength={120} onChange={(e) => set("model", e.target.value)} data-testid="spec-model" />
        </AdminField>
        <AdminField label="Configuration" hint="e.g. Core i5, 8th Gen, 8GB RAM, 256GB Storage">
          <input className={admInputClass} value={v.config} maxLength={200} onChange={(e) => set("config", e.target.value)} data-testid="spec-config" />
        </AdminField>
        <AdminField label="Processor" hint="e.g. i5, i7, Ryzen 5, M1">
          <input className={admInputClass} value={v.cpu} maxLength={60} onChange={(e) => set("cpu", e.target.value)} data-testid="spec-cpu" />
        </AdminField>
        <AdminField label="Processor generation" hint="Number, e.g. 8">
          <input className={admInputClass} inputMode="numeric" value={v.gen} onChange={(e) => set("gen", e.target.value)} data-testid="spec-gen" />
        </AdminField>
        <AdminField label="RAM (GB)">
          <input className={admInputClass} inputMode="numeric" value={v.ramGb} onChange={(e) => set("ramGb", e.target.value)} data-testid="spec-ram" />
        </AdminField>
        <AdminField label="Storage (GB)" hint="1 TB = 1024">
          <input className={admInputClass} inputMode="numeric" value={v.storageGb} onChange={(e) => set("storageGb", e.target.value)} data-testid="spec-storage" />
        </AdminField>
        <AdminField label="Screen size (inches)">
          <input className={admInputClass} inputMode="decimal" value={v.sizeIn} onChange={(e) => set("sizeIn", e.target.value)} data-testid="spec-size" />
        </AdminField>
        <AdminField label="Condition">
          <select className={admInputClass} value={v.condition} onChange={(e) => set("condition", e.target.value as SpecEdit["condition"])} data-testid="spec-condition">
            <option value="">Not listed</option>
            {SPEC_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </AdminField>
        <label className="mt-6 flex items-center gap-2 text-sm font-medium text-[var(--adm-ink)]">
          <input type="checkbox" checked={v.touch} onChange={(e) => set("touch", e.target.checked)} data-testid="spec-touch" />
          Touch screen
        </label>
      </div>

      <h3 className="mt-6 text-sm font-semibold text-[var(--adm-ink)]">Spec table</h3>
      <p className="text-xs text-[var(--adm-ink-2)]">The rows of the specifications table on the product page. Empty rows are hidden.</p>
      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="spec-table">
        {SPEC_TABLE_FIELDS.map(([key, label]) => (
          <AdminField key={key} label={`Table: ${label}`}>
            <input
              className={admInputClass}
              value={table[key] ?? ""}
              maxLength={300}
              onChange={(e) => setTable((p) => ({ ...p, [key]: e.target.value }))}
            />
          </AdminField>
        ))}
      </div>

      {err ? (
        <p role="alert" className="mt-3 text-sm text-[var(--adm-danger)]" data-testid="spec-error">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p role="status" className="mt-3 text-sm text-[var(--adm-success)]" data-testid="spec-saved">
          {msg}
        </p>
      ) : null}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!hydrated || busy}
          className="inline-flex min-h-10 items-center rounded-[var(--adm-radius)] bg-[var(--adm-action)] px-4 text-sm font-semibold text-white hover:bg-[var(--adm-action-hover)] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save specifications"}
        </button>
      </div>
    </section>
  );
}
