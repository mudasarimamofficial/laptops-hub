"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { V5ProductCard } from "@/components/commerce/product-card";
import { InquiryDialog } from "@/components/commerce/inquiry-dialog";
import { useDialog } from "@/components/storefront/v5/use-dialog";
import { SORT_OPTS, type CollectionView as View, type FacetOpt } from "@/lib/catalog/v5-collection";

/** V5 `cbNeeded`. */
const CB_NEEDED = [
  "Price in PKR and current availability",
  "Processor, memory and storage",
  "Screen size and whether it is a touchscreen",
  "Condition as recorded for that unit",
  "Photos of the model being sold",
];

const legend = { float: "left", width: "100%", padding: "0 0 8px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--lh-action)" } as const;
const fieldset = { border: 0, borderTop: "1px solid var(--lh-divider)", margin: 0, padding: "16px 0 0", display: "flex", flexDirection: "column", gap: 2 } as const;
const countStyle = { fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--lh-ink-2)" } as const;
const box = { width: 17, height: 17, margin: 0, accentColor: "var(--lh-action)" } as const;

/** Port of the V5 collection / search view (`isCollection`). Filter state lives in the URL. */
export function CollectionView({ title, view }: { title: string; view: View }) {
  const router = useRouter();
  const pathname = usePathname();
  const [, start] = useTransition();
  const [fOpen, setFOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const closeFilters = useCallback(() => setFOpen(false), []);
  useDialog(fOpen, asideRef, closeFilters);
  const go = (q: string) => start(() => router.replace(pathname + (q === "?" ? "" : q), { scroll: false }));

  const opt = (o: FacetOpt, type: "checkbox" | "radio") => (
    <label key={o.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 14, cursor: "pointer", opacity: o.op }}>
      <input type={type} name={type === "radio" ? "lh-price" : undefined} checked={o.checked} onChange={() => go(o.href)} style={box} />
      <span style={{ flex: 1 }}>{o.label}</span>
      <span style={countStyle}>{o.count}</span>
    </label>
  );

  return (
    <>
      <section data-screen-label="Collection" style={{ background: "radial-gradient(40% 120% at 100% 0%,rgba(var(--lh-action-rgb),.10),transparent 70%),linear-gradient(180deg,var(--lh-ice),var(--lh-canvas))", borderBottom: "1px solid var(--lh-border)", color: "var(--lh-ink)" }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", padding: "28px clamp(16px,3vw,32px) 36px" }}>
          <nav aria-label="Breadcrumb" style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--lh-ink-2)", marginBottom: 16 }}>
            <Link href="/" style={{ color: "var(--lh-ink-2)" }}>
              Home
            </Link>
            <span>/</span>
            <span style={{ color: "var(--lh-ink)" }}>{title}</span>
          </nav>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(34px,4vw,56px)", lineHeight: 1.04, letterSpacing: "-.04em", fontWeight: 700 }}>{title}</h1>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--lh-ink-2)" }}>
                <span style={{ width: 12, height: 2, background: "var(--lh-signal)" }} />
                {view.resultText}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button type="button" className="v5-m-only" onClick={() => setFOpen(true)} style={{ height: 44, padding: "0 16px", border: "1px solid var(--lh-border)", borderRadius: 999, background: "var(--lh-paper)", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "var(--lh-ink)", whiteSpace: "nowrap", alignItems: "center" }}>
                Filters{view.chips.length ? ` (${view.chips.length})` : ""}
              </button>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--lh-ink-2)" }}>
                Sort
                <select value={view.sort} onChange={(e) => go(view.sortHrefs[e.target.value])} style={{ height: 44, padding: "0 14px", border: "1px solid var(--lh-border)", borderRadius: 999, background: "var(--lh-paper)", fontSize: 14, color: "var(--lh-ink)", cursor: "pointer" }}>
                  {SORT_OPTS.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      </section>
      <section style={{ maxWidth: 1360, margin: "0 auto", padding: "28px clamp(16px,3vw,32px) 80px" }}>
        <div className={view.cbPending ? undefined : "v5-col-layout"} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 28, alignItems: "start" }}>
          {view.cbPending ? null : (
            <aside
              ref={asideRef}
              aria-label="Filters"
              data-lh-dialog={fOpen ? "1" : undefined}
              role={fOpen ? "dialog" : undefined}
              aria-modal={fOpen ? true : undefined}
              className={fOpen ? "v5-filters v5-filters-open" : "v5-filters"}
              style={{ background: "#FFFFFF", border: "1px solid var(--lh-border)", overflow: "auto", flexDirection: "column", gap: 20 }}
            >
              <div className="v5-m-flex" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700 }}>Filters</span>
                <button type="button" onClick={closeFilters} aria-label="Close filters" style={{ width: 44, height: 44, border: 0, background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", justifySelf: "end" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#102039" strokeWidth="2" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", fontSize: 14, cursor: "pointer" }}>
                  <input type="checkbox" checked={view.touchOpt.checked} onChange={() => go(view.touchOpt.href)} style={box} />
                  <span style={{ flex: 1, fontWeight: 600 }}>Touchscreen</span>
                  <span style={countStyle}>{view.touchOpt.count}</span>
                </label>
              </div>
              {view.facets.map((fc) => (
                <fieldset key={fc.label} style={fieldset}>
                  <legend style={legend}>{fc.label}</legend>
                  {fc.opts.map((o) => opt(o, "checkbox"))}
                </fieldset>
              ))}
              <fieldset style={fieldset}>
                <legend style={legend}>Price</legend>
                {view.priceOpts.map((o) => opt(o, "radio"))}
              </fieldset>
              <button type="button" className="v5-m-only" onClick={closeFilters} style={{ position: "sticky", bottom: 0, height: 52, border: 0, borderRadius: 999, background: "var(--lh-grad-action)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: "pointer", placeItems: "center" }}>
                <span>Show {view.resultCount} results</span>
              </button>
            </aside>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
            {view.chips.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {view.chips.map((ch) => (
                  <button key={ch.label} type="button" onClick={() => go(ch.href)} className="v5-hov-bd-action" style={{ height: 34, padding: "0 12px 0 14px", border: "1px solid var(--lh-border)", borderRadius: 999, background: "var(--lh-ice)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "var(--lh-action-hover)" }}>
                    {ch.label}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                ))}
                <button type="button" onClick={() => go(view.clearHref)} style={{ height: 34, padding: "0 8px", border: 0, background: "transparent", fontSize: 13, fontWeight: 700, color: "var(--lh-ink)", cursor: "pointer", textDecoration: "underline", whiteSpace: "nowrap" }}>
                  Clear all
                </button>
              </div>
            ) : null}
            {view.cbPending ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))", gap: 18 }}>
                <div style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", gap: 16, padding: "clamp(24px,3vw,36px)", borderRadius: 24, background: "linear-gradient(160deg,#FFFFFF,var(--lh-ice))", border: "1px solid var(--lh-border)" }}>
                  <span style={{ alignSelf: "flex-start", padding: "6px 12px", borderRadius: 999, background: "var(--lh-navy)", color: "#FFFFFF", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", whiteSpace: "nowrap" }}>COMING SOON</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px,2.4vw,32px)", fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1.1, color: "var(--lh-ink)" }}>Chromebooks are on the way.</span>
                  <span style={{ fontSize: 15, lineHeight: 1.6, color: "var(--lh-ink-2)", maxWidth: "52ch" }}>
                    We aren’t listing any Chromebooks yet. Models will appear here once each one is photographed and its price, specifications and availability are confirmed. Tell us what you’re looking for and we’ll let you know.
                  </span>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                    <button type="button" onClick={() => setAsking(true)} className="v5-hov-bg-action" style={{ height: 48, padding: "0 22px", border: 0, borderRadius: 999, background: "var(--lh-action)", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                      Ask about Chromebooks
                    </button>
                    <Link href="/collections/all" className="v5-hov-bd-action" style={{ height: 48, padding: "0 20px", borderRadius: 999, border: "1px solid var(--lh-border)", background: "#FFFFFF", color: "var(--lh-ink)", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                      Browse all products
                    </Link>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "clamp(24px,3vw,36px)", borderRadius: 24, background: "#FFFFFF", border: "1px solid var(--lh-border)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", color: "var(--lh-action)" }}>EVERY CHROMEBOOK LISTING WILL SHOW</span>
                  {CB_NEEDED.map((nd) => (
                    <div key={nd} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid var(--lh-divider)", fontSize: 14, lineHeight: 1.45, color: "var(--lh-ink)" }}>
                      <span style={{ flexShrink: 0, width: 6, height: 6, marginTop: 7, borderRadius: "50%", background: "var(--lh-electric)" }} />
                      {nd}
                    </div>
                  ))}
                </div>
                <InquiryDialog open={asking} onClose={() => setAsking(false)} productTitle="Chromebooks: tell us the model, budget or specs you need" productHandle="chromebooks" />
              </div>
            ) : null}
            {view.noResults ? (
              <div style={{ padding: "64px 24px", textAlign: "center", background: "#FFFFFF", border: "1px solid var(--lh-border)", borderRadius: 22, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>No products match these filters</span>
                <span style={{ fontSize: 15, color: "var(--lh-ink-2)" }}>Remove a filter or browse the full catalog.</span>
                <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
                  <button type="button" onClick={() => go(view.clearHref)} style={{ height: 46, padding: "0 20px", border: "1px solid var(--lh-border)", borderRadius: 999, background: "#FFFFFF", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "var(--lh-ink)", whiteSpace: "nowrap" }}>
                    Clear filters
                  </button>
                  <Link href="/collections/all" style={{ height: 46, padding: "0 20px", borderRadius: 999, background: "var(--lh-grad-action)", color: "#FFFFFF", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                    All laptops
                  </Link>
                </div>
              </div>
            ) : null}
            <div className="v5-card-grid">
              {view.cards.map((c) => (
                <V5ProductCard key={c.h} item={c} />
              ))}
            </div>
            {view.hasMore ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 16 }}>
                <div style={{ width: 200, height: 4, borderRadius: 999, background: "var(--lh-border)", overflow: "hidden" }}>
                  <div style={{ width: view.shownPct, height: "100%", background: "linear-gradient(90deg,var(--lh-action),var(--lh-electric))" }} />
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--lh-ink-2)" }}>
                  Showing {view.shownCount} of {view.resultCount}
                </span>
                <Link href={pathname + view.moreHref} scroll={false} replace style={{ height: 48, padding: "0 28px", border: 0, borderRadius: 999, background: "var(--lh-ink)", fontSize: 15, fontWeight: 700, cursor: "pointer", color: "#FFFFFF", display: "flex", alignItems: "center" }}>
                  Load more
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
