import Link from "next/link";
import { LHImg } from "@/components/storefront/v5/lh-img";
import { V5ProductCard } from "@/components/commerce/product-card";
import { CompareCount, NewGenRow } from "@/components/storefront/home/home-client";
import type { V5Card, V5Link } from "@/lib/catalog/v5-model";

/** Server-rendered V5 home sections 04–10 (`Laptops Hub Storefront v5.dc.html`). */

function Kicker({ children, onDark }: { children: string; onDark?: boolean }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".12em", color: onDark ? "var(--lh-on-dark-2)" : "var(--lh-ink-2)" }}>
      <span style={{ width: 12, height: 2, background: "var(--lh-signal)" }} />
      {children}
    </span>
  );
}

const H2 = { margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(28px,3vw,44px)", letterSpacing: "-.035em", fontWeight: 700 } as const;
const SECTION = { maxWidth: 1360, margin: "0 auto", padding: "clamp(56px,7vw,96px) clamp(16px,3vw,32px) 0" } as const;

export type BrandTile = { name: string; count: number; fromText: string; lines: string; img: string | null; tint: string; href: string };

export function BrandSection({ tiles }: { tiles: BrandTile[] }) {
  return (
    <section id="brands" data-screen-label="04 Brands" style={{ maxWidth: 1360, margin: "0 auto", padding: "clamp(24px,3vw,40px) clamp(16px,3vw,32px) 0" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        <Kicker>04 — BRANDS</Kicker>
        <h2 style={H2}>Shop by brand</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 18 }}>
        {tiles.map((b) => (
          <Link
            key={b.name}
            href={b.href}
            className="v5-hov-brand"
            style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 20, padding: 26, minHeight: 360, borderRadius: 24, backgroundColor: "#FFFFFF", backgroundImage: b.tint, border: "1px solid var(--lh-border)", color: "var(--lh-ink)", transition: "transform .25s ease,box-shadow .25s ease,border-color .25s ease" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 700, letterSpacing: "-.04em", lineHeight: 1 }}>{b.name}</span>
                <span style={{ fontSize: 14, color: "var(--lh-ink-2)" }}>{b.lines}</span>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, padding: "6px 10px", borderRadius: 999, background: "var(--lh-ice)", border: "1px solid var(--lh-border)", color: "var(--lh-action)", whiteSpace: "nowrap" }}>{b.count} listings</span>
            </div>
            <div style={{ position: "relative", flex: 1, minHeight: 150, borderRadius: 16, background: "radial-gradient(90% 80% at 50% 100%,var(--lh-titanium),var(--lh-canvas) 70%)", overflow: "hidden" }}>
              <LHImg src={b.img} alt="" pad="14px" blend="multiply" />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 14, color: "var(--lh-ink-2)" }}>
                From <strong style={{ color: "var(--lh-ink)" }}>{b.fromText}</strong>
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--lh-action)", whiteSpace: "nowrap" }}>View products →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function FeaturedSection({ cards, laptopCount, brandTotal, accCount }: { cards: V5Card[]; laptopCount: number; brandTotal: number; accCount: number }) {
  return (
    <section style={SECTION}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Kicker>05 — FEATURED</Kicker>
          <h2 style={H2}>Featured laptops</h2>
          <span style={{ fontSize: 16, color: "var(--lh-ink-2)" }}>
            {laptopCount} laptops from {brandTotal} brands, plus {accCount} accessories.
          </span>
        </div>
        <Link href="/collections/laptops" className="v5-hov-bd-action" style={{ height: 44, padding: "0 20px", borderRadius: 999, border: "1px solid var(--lh-border)", background: "#FFFFFF", color: "var(--lh-ink)", fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
          <span>View all {laptopCount} →</span>
        </Link>
      </div>
      <div className="v5-card-grid">
        {cards.map((c) => (
          <V5ProductCard key={c.h} item={c} />
        ))}
      </div>
    </section>
  );
}

export type Promo = { href: string; img: string | null; alt: string; brand: string; model: string; config: string; priceText: string; rows: { k: string; v: string }[] };

export function PromoSection({ promo }: { promo: Promo }) {
  return (
    <section style={{ marginTop: "clamp(56px,7vw,96px)", backgroundColor: "var(--lh-navy)", backgroundImage: "radial-gradient(50% 80% at 0% 50%,rgba(var(--lh-action-rgb),.32),transparent 70%),radial-gradient(40% 70% at 100% 0%,rgba(var(--lh-iris-rgb),.3),transparent 70%)", color: "#FFFFFF", overflow: "hidden" }}>
      <div className="v5-promo-grid" style={{ maxWidth: 1360, margin: "0 auto", padding: "clamp(48px,6vw,88px) clamp(16px,3vw,32px)", display: "grid", gap: "clamp(28px,4vw,64px)", alignItems: "center" }}>
        <Link href={promo.href} style={{ position: "relative", display: "block", padding: 1.5, borderRadius: 28, background: "linear-gradient(140deg,rgba(var(--lh-electric-rgb),.7),rgba(255,255,255,.06) 50%,rgba(var(--lh-action-rgb),.8))" }}>
          <span style={{ position: "relative", display: "block", aspectRatio: "16/11", borderRadius: 27, overflow: "hidden", background: "radial-gradient(110% 90% at 50% 105%,var(--lh-titanium),#FFFFFF 70%)" }}>
            <LHImg src={promo.img} alt={promo.alt} pad="clamp(20px,3vw,40px)" blend="multiply" />
          </span>
        </Link>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          <Kicker onDark>06 — FEATURED CONFIGURATION</Kicker>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(32px,3.6vw,54px)", letterSpacing: "-.04em", lineHeight: 1.02, fontWeight: 700 }}>
            {promo.brand} {promo.model}
          </h2>
          <p style={{ margin: 0, fontSize: 17, color: "var(--lh-on-dark-2)" }}>{promo.config}</p>
          <div style={{ display: "flex", flexDirection: "column", borderRadius: 18, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}>
            {promo.rows.map((r) => (
              <div key={r.k} style={{ display: "grid", gridTemplateColumns: "100px minmax(0,1fr)", gap: 14, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--lh-on-dark-3)", paddingTop: 2 }}>{r.k}</span>
                <span style={{ fontSize: 14, lineHeight: 1.45, color: "var(--lh-on-dark-2)" }}>{r.v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700 }}>{promo.priceText}</span>
            <Link href={promo.href} className="v5-hov-white-ice" style={{ height: 50, padding: "0 24px", borderRadius: 999, background: "#FFFFFF", color: "var(--lh-ink)", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
              View laptop →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SpecSection({ links }: { links: (V5Link & { bar: string; share: string })[] }) {
  return (
    <section style={SECTION}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        <Kicker>07 — SPECIFICATIONS</Kicker>
        <h2 style={H2}>Shop by spec</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,240px),1fr))", gap: 12 }}>
        {links.map((q) => (
          <Link key={q.href} href={q.href} className="v5-hov-spec" style={{ display: "flex", flexDirection: "column", gap: 14, padding: 20, background: "#FFFFFF", border: "1px solid var(--lh-border)", borderRadius: 18, color: "var(--lh-ink)", transition: "border-color .2s ease,box-shadow .2s ease,transform .2s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-.02em" }}>{q.label}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 500, color: "var(--lh-action)" }}>{q.count}</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "var(--lh-divider)", overflow: "hidden" }}>
              <div style={{ width: q.bar, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,var(--lh-action),var(--lh-electric))" }} />
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--lh-ink-2)" }}>{q.share}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function NewGenSection({ cards, count }: { cards: V5Card[]; count: number }) {
  return (
    <section style={{ marginTop: "clamp(56px,7vw,96px)", background: "linear-gradient(180deg,var(--lh-ice),var(--lh-canvas))", color: "var(--lh-ink)" }}>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "clamp(48px,6vw,88px) clamp(16px,3vw,32px)" }}>
        <NewGenRow count={count}>
          {cards.map((c) => (
            <div key={c.h} style={{ scrollSnapAlign: "start" }}>
              <V5ProductCard item={c} />
            </div>
          ))}
        </NewGenRow>
      </div>
    </section>
  );
}

export function BudgetSection({ tiles }: { tiles: V5Link[] }) {
  return (
    <section style={SECTION}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        <Kicker>09 — BUDGET</Kicker>
        <h2 style={H2}>Shop by budget</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 18 }}>
        {tiles.map((b) => (
          <Link key={b.href} href={b.href} className="v5-hov-budget" style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 40, padding: 28, borderRadius: 22, background: "linear-gradient(160deg,#FFFFFF 40%,var(--lh-ice) 100%)", border: "1px solid var(--lh-border)", color: "var(--lh-ink)", minHeight: 200, transition: "border-color .2s ease,transform .2s ease" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--lh-ink-2)" }}>{b.count} laptops</span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px,2.2vw,30px)", fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1.1, color: "var(--lh-ink)" }}>{b.label}</span>
              <span style={{ width: 44, height: 44, flexShrink: 0, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--lh-ink)", color: "var(--lh-electric)", fontSize: 18 }}>→</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export type CmpDemo = { a: { model: string; img: string | null }; b: { model: string; img: string | null }; rows: { k: string; a: string; b: string; diff: boolean }[] };

export function CompareDemoSection({ demo }: { demo: CmpDemo | null }) {
  const cols = "90px minmax(0,1fr) minmax(0,1fr)";
  return (
    <section style={{ maxWidth: 1360, margin: "0 auto", padding: "clamp(56px,7vw,96px) clamp(16px,3vw,32px) clamp(64px,8vw,112px)" }}>
      <div className="v5-cmp-grid" style={{ position: "relative", overflow: "hidden", borderRadius: 32, backgroundColor: "var(--lh-navy)", backgroundImage: "radial-gradient(60% 90% at 100% 100%,rgba(var(--lh-iris-rgb),.45),transparent 70%),radial-gradient(50% 80% at 0% 0%,rgba(var(--lh-action-rgb),.4),transparent 70%)", color: "#FFFFFF", padding: "clamp(28px,4vw,56px)", display: "grid", gap: "clamp(28px,4vw,56px)", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Kicker onDark>10 — COMPARE</Kicker>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(30px,3.2vw,48px)", letterSpacing: "-.04em", lineHeight: 1.04, fontWeight: 700 }}>Compare before you buy.</h2>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: "var(--lh-on-dark-2)", maxWidth: "46ch" }}>
            Add up to four laptops and line up processor, memory, storage, display and price. Rows that differ are highlighted.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/compare" className="v5-hov-bright" style={{ height: 52, padding: "0 24px", borderRadius: 999, background: "var(--lh-grad-action)", color: "#FFFFFF", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", whiteSpace: "nowrap", boxShadow: "0 12px 30px -12px rgba(var(--lh-electric-rgb),.8)" }}>
              <span>
                Open compare (<CompareCount />)
              </span>
            </Link>
            <Link href="/collections/all" className="v5-hov-bd-electric" style={{ height: 52, padding: "0 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,.2)", color: "#FFFFFF", fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
              Pick laptops
            </Link>
          </div>
        </div>
        {demo ? (
          <div style={{ borderRadius: 22, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.14)", overflow: "hidden", boxShadow: "0 30px 60px -30px rgba(0,0,0,.8)" }}>
            <div style={{ display: "grid", gridTemplateColumns: cols, borderBottom: "1px solid rgba(255,255,255,.1)" }}>
              <div />
              {[demo.a, demo.b].map((x, i) => (
                <div key={i} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, borderLeft: "1px solid rgba(255,255,255,.08)" }}>
                  <span style={{ position: "relative", aspectRatio: "4/3", borderRadius: 10, background: "#FFFFFF", overflow: "hidden" }}>
                    <LHImg src={x.img} alt="" pad="6px" />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{x.model}</span>
                </div>
              ))}
            </div>
            {demo.rows.map((r) => (
              <div key={r.k} style={{ display: "grid", gridTemplateColumns: cols, background: r.diff ? "rgba(var(--lh-electric-rgb),.10)" : "transparent", borderBottom: "1px solid rgba(255,255,255,.06)", boxShadow: `inset 3px 0 0 ${r.diff ? "var(--lh-electric)" : "rgba(255,255,255,.18)"}` }}>
                <span style={{ padding: "11px 14px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--lh-on-dark-3)" }}>{r.k}</span>
                <span style={{ padding: "11px 14px", fontSize: 13, color: "var(--lh-on-dark-2)", borderLeft: "1px solid rgba(255,255,255,.08)" }}>{r.a}</span>
                <span style={{ padding: "11px 14px", fontSize: 13, color: "var(--lh-on-dark-2)", borderLeft: "1px solid rgba(255,255,255,.08)" }}>{r.b}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
