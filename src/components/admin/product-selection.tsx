"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Ctx = {
  selected: Set<string>;
  toggle: (handle: string, on: boolean) => void;
  setMany: (handles: string[], on: boolean) => void;
  clear: () => void;
};
const SelectionContext = createContext<Ctx | null>(null);
const useSelection = () => {
  const c = useContext(SelectionContext);
  if (!c) throw new Error("ProductSelection missing");
  return c;
};

/** Holds the ticked products on the current list page (cleared when the page, filter or search changes). */
export function ProductSelection({ pageKey, children }: { pageKey: string; children: React.ReactNode }) {
  const [state, setState] = useState<{ key: string; selected: Set<string> }>({ key: pageKey, selected: new Set() });
  // A new page/filter starts with nothing ticked (derived during render; no effect needed).
  const selected = useMemo(() => (state.key === pageKey ? state.selected : new Set<string>()), [state, pageKey]);
  const value = useMemo<Ctx>(
    () => ({
      selected,
      toggle: (h, on) =>
        setState((s) => {
          const next = new Set(s.key === pageKey ? s.selected : []);
          if (on) next.add(h);
          else next.delete(h);
          return { key: pageKey, selected: next };
        }),
      setMany: (hs, on) =>
        setState((s) => {
          const next = new Set(s.key === pageKey ? s.selected : []);
          for (const h of hs) {
            if (on) next.add(h);
            else next.delete(h);
          }
          return { key: pageKey, selected: next };
        }),
      clear: () => setState({ key: pageKey, selected: new Set() }),
    }),
    [selected, pageKey],
  );
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function SelectRow({ handle, title }: { handle: string; title: string }) {
  const { selected, toggle } = useSelection();
  return (
    <input
      type="checkbox"
      className="h-4 w-4 cursor-pointer accent-[var(--adm-action)]"
      checked={selected.has(handle)}
      onChange={(e) => toggle(handle, e.target.checked)}
      aria-label={`Select ${title}`}
      data-testid="product-select"
      data-handle={handle}
    />
  );
}

export function SelectAll({ handles }: { handles: string[] }) {
  const { selected, setMany } = useSelection();
  const ref = useRef<HTMLInputElement>(null);
  const n = handles.filter((h) => selected.has(h)).length;
  const all = n > 0 && n === handles.length;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = n > 0 && !all;
  }, [n, all]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="h-4 w-4 cursor-pointer accent-[var(--adm-action)]"
      checked={all}
      onChange={(e) => setMany(handles, e.target.checked)}
      aria-label={all ? "Unselect all products on this page" : "Select all products on this page"}
      data-testid="product-select-all"
    />
  );
}

type Action = { label: string; patch: Record<string, unknown>; confirm?: string; testid: string };
const ACTIONS: Action[] = [
  { label: "Set active", patch: { status: "active" }, testid: "bulk-active" },
  { label: "Set draft", patch: { status: "draft" }, testid: "bulk-draft", confirm: "Move {n} product(s) to draft? They disappear from the storefront until set active again." },
  { label: "Archive", patch: { status: "archived" }, testid: "bulk-archive", confirm: "Archive {n} product(s)? They disappear from the storefront. Orders already placed are not changed." },
  { label: "Feature", patch: { featured: true }, testid: "bulk-feature" },
  { label: "Unfeature", patch: { featured: false }, testid: "bulk-unfeature" },
];

/** Sticky bar shown while products are ticked: quick status/featured changes, or open them in the bulk editor. */
export function BulkActionBar() {
  const { selected, clear } = useSelection();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [, startTransition] = useTransition();
  const n = selected.size;
  const handles = [...selected];

  async function run(a: Action) {
    if (a.confirm && !window.confirm(a.confirm.replace("{n}", String(n)))) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: handles.map((handle) => ({ handle, ...a.patch })) }),
      });
      const data = (await res.json().catch(() => ({}))) as { successCount?: number; message?: string; results?: { ok: boolean }[] };
      if (!res.ok) {
        setMsg({ tone: "err", text: data.message || "Could not update the selected products." });
        return;
      }
      const failed = (data.results ?? []).filter((r) => !r.ok).length;
      setMsg({
        tone: failed ? "err" : "ok",
        text: `${a.label}: ${data.successCount ?? 0} updated${failed ? `, ${failed} could not be changed` : ""}.`,
      });
      clear();
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  if (n === 0 && !msg) return null;
  return (
    <div
      className="sticky bottom-3 z-30 mt-4 flex flex-wrap items-center gap-2 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3 shadow-[var(--adm-shadow)]"
      role="region"
      aria-label="Bulk actions"
      data-testid="bulk-bar"
    >
      {n > 0 ? (
        <>
          <span className="mr-1 text-sm font-semibold" aria-live="polite" data-testid="bulk-count">
            {n} selected
          </span>
          {ACTIONS.map((a) => (
            <button
              key={a.testid}
              type="button"
              disabled={busy}
              onClick={() => void run(a)}
              data-testid={a.testid}
              className={`inline-flex min-h-9 items-center rounded-lg border px-3 text-sm font-semibold disabled:opacity-50 ${
                a.patch.status === "archived"
                  ? "border-red-200 bg-white text-red-700 hover:bg-red-50"
                  : "border-[var(--adm-border)] bg-white hover:bg-[var(--adm-surface-2)]"
              }`}
            >
              {a.label}
            </button>
          ))}
          <Link
            href={`/admin/products/bulk?handles=${encodeURIComponent(handles.join(","))}`}
            className="inline-flex min-h-9 items-center rounded-[var(--adm-radius)] bg-[var(--adm-action)] px-3 text-sm font-semibold text-white hover:bg-[var(--adm-action-hover)]"
            data-testid="bulk-open-editor"
          >
            Edit prices in bulk editor
          </Link>
          <button type="button" onClick={clear} className="ml-auto text-sm font-semibold text-[var(--adm-ink-2)] hover:underline">
            Clear selection
          </button>
        </>
      ) : null}
      {msg ? (
        <p role={msg.tone === "err" ? "alert" : "status"} className={`w-full text-sm ${msg.tone === "err" ? "text-red-700" : "text-emerald-700"}`} data-testid="bulk-msg">
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
