"use client";

import { useEffect, useState, useTransition } from "react";

type Hit = { id: string; title: string; handle: string; status: string };

type Props = {
  value: string[];
  onChange: (handles: string[]) => void;
  error?: string;
};

/** Multi-select product picker for reels (title / handle / SKU search). */
export function ReelProductPicker({ value, onChange, error }: Props) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/admin/products/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j: { products?: Hit[] }) => {
          startTransition(() => setHits(j.products || []));
        })
        .catch(() => undefined);
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  function onQueryChange(next: string) {
    setQ(next);
    if (next.trim().length < 2) setHits([]);
  }

  function add(handle: string) {
    if (value.includes(handle)) return;
    onChange([...value, handle]);
    setQ("");
    setHits([]);
  }

  function remove(handle: string) {
    onChange(value.filter((h) => h !== handle));
  }

  function move(handle: string, dir: -1 | 1) {
    const i = value.indexOf(handle);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    const [row] = next.splice(i, 1);
    next.splice(j, 0, row);
    onChange(next);
  }

  return (
    <div className="sm:col-span-2" data-testid="reel-product-picker">
      <span className="font-medium">Products featured in this reel</span>
      <p className="mt-1 text-xs text-[var(--adm-ink-2)]">
        Search by title, handle or SKU. Add one or many — order here is the order in the shoppable video popup.
      </p>
      <input
        className="mt-2 w-full min-w-0 rounded-lg border border-[var(--adm-border)] bg-white px-3 py-2"
        value={q}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search products…"
        aria-label="Search products to feature"
      />
      {pending ? <p className="mt-1 text-xs text-[var(--adm-ink-2)]">Searching…</p> : null}
      {hits.length > 0 ? (
        <ul className="mt-2 max-h-48 overflow-auto rounded-lg border border-[var(--adm-border)] bg-white">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--adm-canvas)]"
                onClick={() => add(h.handle)}
                disabled={value.includes(h.handle)}
              >
                <span className="min-w-0 truncate font-medium">{h.title}</span>
                <span className="shrink-0 text-xs text-[var(--adm-ink-2)]">
                  {h.handle} · {h.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {value.length ? (
        <ol className="mt-3 space-y-2">
          {value.map((handle, i) => (
            <li
              key={handle}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--adm-border)] bg-white px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs text-[var(--adm-ink)]">
                {i + 1}. {handle}
              </span>
              <span className="flex gap-1">
                <button type="button" className="rounded border border-[var(--adm-border)] px-2 py-1 text-xs" onClick={() => move(handle, -1)} disabled={i === 0}>
                  Up
                </button>
                <button
                  type="button"
                  className="rounded border border-[var(--adm-border)] px-2 py-1 text-xs"
                  onClick={() => move(handle, 1)}
                  disabled={i === value.length - 1}
                >
                  Down
                </button>
                <button type="button" className="rounded border border-[var(--adm-border)] px-2 py-1 text-xs text-[var(--adm-danger)]" onClick={() => remove(handle)}>
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-xs text-[var(--adm-ink-2)]">No products linked yet — the shoppable popup will show a browse CTA.</p>
      )}
      {error ? (
        <span role="alert" className="mt-1 block text-xs text-[var(--adm-danger)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
