"use client";

import { useState } from "react";
import { useHydrated } from "@/lib/ui/use-hydrated";

type Row = { handle: string; status: string; pricePkr: string; featured: string };

export function BulkProductsForm({ initialHandles }: { initialHandles: string[] }) {
  const hydrated = useHydrated();
  const [rows, setRows] = useState<Row[]>(
    initialHandles.slice(0, 50).map((handle) => ({
      handle,
      status: "",
      pricePkr: "",
      featured: "",
    })),
  );
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function loadFromPaste() {
    const handles = paste
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 100);
    setRows(handles.map((handle) => ({ handle, status: "", pricePkr: "", featured: "" })));
  }

  async function apply() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const items = rows
        .filter((r) => r.handle)
        .map((r) => {
          const item: Record<string, unknown> = { handle: r.handle };
          if (r.status) item.status = r.status;
          if (r.pricePkr !== "") item.pricePkr = Number(r.pricePkr);
          if (r.featured === "true") item.featured = true;
          if (r.featured === "false") item.featured = false;
          return item;
        })
        .filter((i) => Object.keys(i).length > 1);

      if (!items.length) {
        setErr("Set at least one field to change (status, price, or featured).");
        return;
      }

      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.message || data.error || `Bulk failed (${res.status})`);
        return;
      }
      setMsg(`Updated ${data.successCount} of ${data.results?.length ?? 0} products.`);
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="font-medium">Paste handles (one per line or comma-separated)</span>
        <textarea
          className="mt-1 w-full rounded-lg border border-[var(--adm-border)] px-3 py-2 font-[family-name:var(--font-mono)] text-xs"
          rows={3}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="handle-one&#10;handle-two"
        />
      </label>
      <button
        type="button"
        onClick={loadFromPaste}
        className="rounded-lg border border-[var(--adm-border)] px-3 py-1.5 text-sm font-semibold"
      >
        Load handles
      </button>

      <div className="overflow-x-auto rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[var(--adm-surface-2)] text-[11px] uppercase tracking-wider text-[var(--adm-ink-2)]">
            <tr>
              <th className="px-3 py-2">Handle</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Price PKR</th>
              <th className="px-3 py-2">Featured</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.handle}-${i}`} className="border-t border-[var(--adm-divider)]">
                <td className="px-3 py-2 font-[family-name:var(--font-mono)] text-xs">{r.handle}</td>
                <td className="px-3 py-2">
                  <select
                    className="rounded border border-[var(--adm-border)] px-2 py-1 text-sm"
                    value={r.status}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...r, status: e.target.value };
                      setRows(next);
                    }}
                  >
                    <option value="">—</option>
                    <option value="draft">draft</option>
                    <option value="active">active</option>
                    <option value="archived">archived</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    className="w-28 rounded border border-[var(--adm-border)] px-2 py-1"
                    value={r.pricePkr}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...r, pricePkr: e.target.value };
                      setRows(next);
                    }}
                    placeholder="—"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    className="rounded border border-[var(--adm-border)] px-2 py-1 text-sm"
                    value={r.featured}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...r, featured: e.target.value };
                      setRows(next);
                    }}
                  >
                    <option value="">—</option>
                    <option value="true">yes</option>
                    <option value="false">no</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        disabled={!hydrated || busy || !rows.length}
        onClick={apply}
        className="rounded-lg bg-[var(--lh-action)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Applying…" : "Apply bulk changes"}
      </button>
      {msg ? <p className="text-sm text-[var(--adm-success)]">{msg}</p> : null}
      {err ? (
        <p className="text-sm text-[var(--adm-danger)]" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
