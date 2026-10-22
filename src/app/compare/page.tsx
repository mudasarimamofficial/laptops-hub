"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LHImg } from "@/components/storefront/v5/lh-img";
import { useCompare } from "@/lib/commerce/compare-store";
import { useCart } from "@/lib/commerce/cart-store";
import { openCartDrawer } from "@/lib/commerce/cart-ui";
import { canPurchase } from "@/lib/catalog/availability";
import { V5_COMPARE_ROWS, type V5CompareCol } from "@/lib/catalog/v5-model";

/** Port of the V5 compare page (`isCompare`): sticky label column, highlighted differing rows, "Only differences". */
export default function ComparePage() {
  const handles = useCompare((s) => s.handles);
  const toggle = useCompare((s) => s.toggle);
  const clear = useCompare((s) => s.clear);
  const add = useCart((s) => s.add);
  const [data, setData] = useState<{ key: string; cols: V5CompareCol[] } | null>(null);
  const [diffOnly, setDiffOnly] = useState(false);
  const key = handles.join(",");

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    fetch(`/api/catalog/compare?handles=${encodeURIComponent(key)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { cols: V5CompareCol[] }) => setData({ key, cols: j.cols || [] }))
      .catch(() => {
        /* aborted or offline: keep the last table */
      });
    return () => ctrl.abort();
  }, [key]);

  // Keep the store's order; a handle removed here disappears immediately.
  const cols = key && data ? handles.map((h) => data.cols.find((c) => c.h === h)).filter((c): c is V5CompareCol => !!c) : [];
  const has = cols.length > 0;
  const cells: { v: string; label: string; diff: boolean; head: boolean }[] = [];
  for (const label of V5_COMPARE_ROWS) {
    const vals = cols.map((c) => c.values[label] || "—");
    const diff = cols.length > 1 && new Set(vals).size > 1;
    if (diffOnly && !diff) continue;
    cells.push({ v: label, label, diff, head: true });
    vals.forEach((v) => cells.push({ v, label, diff, head: false }));
  }

  return (
    <section data-screen-label="Compare" style={{ maxWidth: 1360, margin: "0 auto", padding: "36px clamp(16px,3vw,32px) 80px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "1 1 auto", minWidth: "min(100%,320px)" }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(34px,4vw,56px)", lineHeight: 1.08, letterSpacing: "-.04em", fontWeight: 700, textWrap: "balance" }}>Compare laptops</h1>
          <span style={{ fontSize: 15, color: "var(--lh-ink-2)" }}>Up to 4 at a time. Highlighted rows differ.</span>
        </div>
        {has ? (
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              <input type="checkbox" checked={diffOnly} onChange={() => setDiffOnly((d) => !d)} style={{ width: 17, height: 17, margin: 0, accentColor: "var(--lh-action)" }} />
              Only differences
            </label>
            <button type="button" onClick={clear} style={{ height: 42, padding: "0 16px", border: "1px solid var(--lh-border)", borderRadius: 999, background: "#FFFFFF", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "var(--lh-ink)" }}>
              Clear
            </button>
          </div>
        ) : null}
      </div>
      {!handles.length ? (
        <div style={{ padding: "72px 24px", textAlign: "center", background: "#FFFFFF", border: "1px solid var(--lh-border)", borderRadius: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>Nothing to compare yet</span>
          <span style={{ fontSize: 15, color: "var(--lh-ink-2)" }}>Tap Compare on any laptop card or product page.</span>
          <Link href="/collections/all" style={{ height: 48, padding: "0 24px", borderRadius: 999, background: "var(--lh-grad-action)", color: "#FFFFFF", fontWeight: 700, display: "flex", alignItems: "center", marginTop: 6, whiteSpace: "nowrap" }}>
            Browse laptops
          </Link>
        </div>
      ) : null}
      {has ? (
        <div style={{ overflowX: "auto", background: "#FFFFFF", border: "1px solid var(--lh-border)", borderRadius: 24 }}>
          <div role="table" aria-label="Product comparison" style={{ minWidth: 150 + cols.length * 200, display: "grid", gridTemplateColumns: `150px repeat(${cols.length},minmax(200px,1fr))` }}>
            <div role="columnheader" style={{ padding: 16, borderBottom: "1px solid var(--lh-border)", position: "sticky", left: 0, background: "#FFFFFF" }} />
            {cols.map((c) => (
              <div key={c.h} role="columnheader" style={{ padding: 18, borderBottom: "1px solid var(--lh-border)", borderLeft: "1px solid var(--lh-divider)", display: "flex", flexDirection: "column", gap: 12 }}>
                <Link href={c.href} tabIndex={-1} aria-hidden="true" style={{ position: "relative", aspectRatio: "4/3", display: "block", borderRadius: 14, background: "radial-gradient(100% 90% at 50% 100%,var(--lh-titanium),#FFFFFF)", overflow: "hidden" }}>
                  <LHImg src={c.img} alt="" pad="8px" blend="multiply" eager />
                </Link>
                <Link href={c.href} style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--lh-ink)", lineHeight: 1.3 }}>
                  {c.model}
                </Link>
                <div style={{ display: "flex", gap: 8 }}>
                  {canPurchase({ available: c.avail, pricePaisa: c.pricePaisa, variantId: c.variantId }) ? (
                    <button
                      type="button"
                      onClick={() => {
                        add({ variantId: c.variantId, handle: c.h, title: c.title, unitPricePaisa: c.pricePaisa, quantity: 1, imageUrl: c.img ?? undefined, maxPerOrder: c.maxPerOrder, model: c.model, config: c.config, sku: c.sku });
                        openCartDrawer();
                      }}
                      style={{ flex: 1, height: 38, border: 0, borderRadius: 999, background: "var(--lh-grad-action)", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      Add to cart
                    </button>
                  ) : null}
                  <button type="button" onClick={() => toggle(c.h)} aria-label="Remove from compare" style={{ height: 38, padding: "0 14px", border: "1px solid var(--lh-border)", borderRadius: 999, background: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--lh-ink)" }}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {cells.map((cl, i) => {
              const price = cl.label === "Price" && !cl.head;
              return (
                <div
                  key={i}
                  role={cl.head ? "rowheader" : "cell"}
                  style={{
                    padding: "13px 18px",
                    borderBottom: "1px solid var(--lh-divider)",
                    borderLeft: cl.head ? "0" : "1px solid var(--lh-divider)",
                    background: cl.head ? (cl.diff ? "var(--lh-ice)" : "#FFFFFF") : cl.diff ? "var(--lh-canvas)" : "#FFFFFF",
                    boxShadow: cl.head && cl.diff ? "inset 3px 0 0 var(--lh-electric)" : "none",
                    fontFamily: cl.head ? "var(--font-mono)" : price ? "var(--font-display)" : "inherit",
                    fontSize: cl.head ? 11 : price ? 17 : 14,
                    letterSpacing: cl.head ? ".06em" : "normal",
                    textTransform: cl.head ? "uppercase" : "none",
                    color: cl.head ? "var(--lh-ink-2)" : "var(--lh-ink)",
                    fontWeight: cl.head ? 500 : price ? 700 : 400,
                    lineHeight: 1.45,
                  }}
                >
                  {cl.v}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
