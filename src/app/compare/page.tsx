"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCompare } from "@/lib/commerce/compare-store";
import { formatPkr } from "@/lib/money";
import { curateSpecs, type SpecRow } from "@/lib/catalog/specs";
import { PendingBlock } from "@/components/ui/pending-block";

type Row = {
  handle: string;
  title: string;
  pricePaisa: number;
  manufacturer: string | null;
  sku: string | null;
  specs: Record<string, unknown>;
};

export default function ComparePage() {
  const handles = useCompare((s) => s.handles);
  const remove = useCompare((s) => s.remove);
  const clear = useCompare((s) => s.clear);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (handles.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when compare tray emptied
      setRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const out: Row[] = [];
      for (const h of handles) {
        const res = await fetch(`/api/catalog/product?handle=${encodeURIComponent(h)}`);
        if (res.ok) {
          const j = await res.json();
          if (j.product) out.push(j.product);
        }
      }
      if (!cancelled) {
        setRows(out);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handles]);

  const curated: SpecRow[][] = rows.map((r) => curateSpecs({ manufacturer: r.manufacturer, specs: r.specs || {}, sku: r.sku ?? null }));
  const labels = Array.from(new Set(curated.flatMap((list) => list.map((x) => x.label))));
  const valueOf = (i: number, label: string) => curated[i]?.find((x) => x.label === label)?.value ?? "—";

  if (handles.length === 0) {
    return (
      <div className="lh-content py-12">
        <p className="lh-kicker">Compare</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.04em]">
          Compare up to 4
        </h1>
        <div className="mt-8">
          <PendingBlock title="Nothing selected yet">
            Add products from listings or product pages.{" "}
            <Link href="/collections/all" className="text-[var(--lh-action)]">
              Browse catalog
            </Link>
          </PendingBlock>
        </div>
      </div>
    );
  }

  return (
    <div className="lh-container py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="lh-kicker">Compare</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.04em]">
            Side by side
          </h1>
        </div>
        <button type="button" onClick={clear} className="text-sm font-semibold text-[var(--lh-error)]">
          Clear all
        </button>
      </div>
      {loading ? <p className="mt-6 text-[var(--lh-ink-2)]">Loading…</p> : null}
      <div className="mt-8 overflow-x-auto rounded-[20px] border border-[var(--lh-border)] bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--lh-divider)] bg-[var(--lh-ice)]">
              <th className="p-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider">Spec</th>
              {rows.map((r) => (
                <th key={r.handle} className="p-4 align-top">
                  <p className="font-semibold">{r.title}</p>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-lg font-bold">{formatPkr(r.pricePaisa)}</p>
                  <div className="mt-2 flex gap-2">
                    <Link href={`/products/${r.handle}`} className="text-[var(--lh-action)]">
                      View
                    </Link>
                    <button type="button" className="text-[var(--lh-error)]" onClick={() => remove(r.handle)}>
                      Remove
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label) => (
              <tr key={label} className="border-b border-[var(--lh-divider)]">
                <th className="p-4 font-medium">{label}</th>
                {rows.map((r, i) => (
                  <td key={r.handle} className="p-4 text-[var(--lh-ink-2)]">
                    {valueOf(i, label)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
