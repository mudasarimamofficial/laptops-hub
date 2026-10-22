"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/commerce/cart-store";
import { openCartDrawer } from "@/lib/commerce/cart-ui";
import { useCompare } from "@/lib/commerce/compare-store";
import { SearchOverlay } from "@/components/storefront/search-overlay";
import { useDialog } from "@/components/storefront/v5/use-dialog";
import { LHImg } from "@/components/storefront/v5/lh-img";
import type { V5MenuGroup } from "@/lib/catalog/v5-model";

export type MegaFeature = { href: string; img: string | null; model: string; priceText: string; stockText: string };
export type ChromeData = { menu: V5MenuGroup[]; megaFeat: MegaFeature | null; totalCount: number };

/** V5 `navLinks` (shown at ≥1180px). */
const NAV_LINKS: { label: string; href: string; isNew?: boolean }[] = [
  { label: "Dell", href: "/collections/dell" },
  { label: "HP", href: "/collections/hp" },
  { label: "Lenovo", href: "/collections/lenovo" },
  { label: "Chromebooks", href: "/collections/chromebooks", isNew: true },
  { label: "Accessories", href: "/collections/accessories" },
  { label: "Guides", href: "/guides" },
  { label: "Support", href: "/pages/faq" },
];

function Wordmark({ size, onDark }: { size: number; onDark?: boolean }) {
  return (
    <>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: size, letterSpacing: "-.03em", color: onDark ? "#FFFFFF" : undefined }}>
        Laptops
      </span>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 12,
          lineHeight: 1,
          letterSpacing: ".12em",
          padding: "5px 7px 5px 8px",
          borderRadius: 6,
          background: "var(--lh-signal)",
          color: "#FFFFFF",
          boxShadow: "inset 0 -2px 0 rgba(0,0,0,.14)",
        }}
      >
        HUB
      </span>
    </>
  );
}
export { Wordmark };

export function SiteHeader({ chrome }: { chrome: ChromeData }) {
  const pathname = usePathname() || "/";
  const [mega, setMega] = useState(false);
  const [mnav, setMnav] = useState(false);
  const [sOpen, setSOpen] = useState(false);
  const [mgroup, setMgroup] = useState<string | null>("Brand");
  const cartCount = useCart((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  const compareCount = useCompare((s) => s.handles.length);
  const mnavRef = useRef<HTMLElement>(null);
  const closeMnav = useCallback(() => setMnav(false), []);
  useDialog(mnav, mnavRef, closeMnav);

  // V5 `onHash`: any navigation closes menus and overlays.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route change is an external event
    setMega(false);
    setMnav(false);
    setSOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mega) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMega(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mega]);

  const openSearch = () => {
    setSOpen(true);
    setMega(false);
    setMnav(false);
  };
  const closeMega = () => mega && setMega(false);
  const countFor = (c: number | string) => (c === "__compare__" ? `${compareCount}/4` : c);
  const isCur = (href: string, label: string) =>
    pathname === href || (label === "Guides" && pathname.startsWith("/guides")) || (label === "Support" && pathname.startsWith("/pages/"));
  const feat = chrome.megaFeat;

  return (
    <>
      <header
        onMouseLeave={closeMega}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(247,250,255,.84)",
          backdropFilter: "blur(18px) saturate(160%)",
          WebkitBackdropFilter: "blur(18px) saturate(160%)",
          borderBottom: "1px solid var(--lh-border)",
          color: "var(--lh-ink)",
        }}
      >
        <div style={{ maxWidth: 1360, margin: "0 auto", padding: "0 clamp(16px,3vw,32px)", height: 72, display: "flex", alignItems: "center", gap: "clamp(6px,2.4vw,24px)" }}>
          <button
            type="button"
            className="v5-m-only"
            onClick={() => setMnav(true)}
            aria-label="Open menu"
            aria-expanded={mnav}
            style={{ width: 44, height: 44, marginLeft: -10, border: 0, background: "transparent", placeItems: "center", cursor: "pointer", color: "var(--lh-ink)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <Link href="/" aria-label="Laptops HUB home" style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--lh-ink)", textDecoration: "none", flexShrink: 0 }}>
            <Wordmark size={21} />
          </Link>
          <nav aria-label="Primary" className="v5-d-only" style={{ display: "flex", alignItems: "center", gap: 2, height: "100%" }}>
            <button
              type="button"
              className="v5-hov-ice"
              onClick={() => setMega((m) => !m)}
              onMouseEnter={() => setMega(true)}
              aria-expanded={mega}
              style={{ height: 40, padding: "0 14px", border: 0, borderRadius: 10, background: mega ? "var(--lh-ice)" : "transparent", fontSize: 15, fontWeight: 600, color: "var(--lh-ink)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", transition: "background .2s ease" }}
            >
              Laptops
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2159D4" strokeWidth="2.4" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {NAV_LINKS.map((l) => {
              const cur = isCur(l.href, l.label);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={cur ? "page" : undefined}
                  onMouseEnter={closeMega}
                  className="v5-wide-only v5-hov-ice"
                  style={{ height: 40, padding: "0 12px", borderRadius: 10, fontSize: 15, fontWeight: 500, color: "var(--lh-ink)", background: cur ? "var(--lh-ice)" : "transparent", alignItems: "center", gap: 7, transition: "background .2s ease,color .2s ease" }}
                >
                  {l.label}
                  {l.isNew ? (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 500, letterSpacing: ".1em", padding: "3px 6px", borderRadius: 999, background: "var(--lh-ice)", color: "var(--lh-action-hover)" }}>NEW</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="v5-d-only v5-hov-search"
            onClick={openSearch}
            style={{ width: "min(320px,26vw)", height: 44, border: "1px solid var(--lh-border)", borderRadius: 999, background: "rgba(255,255,255,.8)", display: "flex", alignItems: "center", gap: 10, padding: "0 16px", color: "var(--lh-ink-2)", fontSize: 14, cursor: "pointer", transition: "border-color .2s ease,box-shadow .2s ease", whiteSpace: "nowrap", overflow: "hidden" }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2159D4" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            Search model, processor, RAM
          </button>
          <Link
            href="/compare"
            className="v5-d-only v5-hov-bd-action"
            style={{ height: 44, padding: "0 14px", borderRadius: 999, display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--lh-ink)", border: "1px solid var(--lh-border)", background: "rgba(255,255,255,.8)" }}
          >
            Compare
            <span style={{ minWidth: 22, height: 22, padding: "0 6px", borderRadius: 999, background: "var(--lh-ice)", color: "var(--lh-action)", fontSize: 12, fontWeight: 700, display: "grid", placeItems: "center" }}>{compareCount}</span>
          </Link>
          <button
            type="button"
            className="v5-m-only"
            onClick={openSearch}
            aria-label="Search"
            style={{ width: 44, height: 44, border: 0, background: "transparent", placeItems: "center", cursor: "pointer", color: "var(--lh-ink)" }}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>
          <button
            type="button"
            className="v5-hov-bg-action"
            onClick={() => {
              setMega(false);
              openCartDrawer();
            }}
            aria-label="Open cart"
            style={{ height: 44, padding: "0 16px", border: 0, borderRadius: 999, background: "var(--lh-action)", color: "#FFFFFF", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", marginRight: -4, boxShadow: "0 10px 24px -12px rgba(var(--lh-action-rgb),.9)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
              <path d="M5 8h14l-1.2 12H6.2L5 8z" />
              <path d="M9 8V6a3 3 0 016 0v2" />
            </svg>
            <span>{cartCount}</span>
          </button>
        </div>

        {mega && chrome.menu.length ? (
          <div
            className="v5-d-only"
            style={{ position: "absolute", left: 0, right: 0, top: "100%", maxHeight: "calc(100vh - 72px)", overflow: "auto", overscrollBehavior: "contain", background: "rgba(255,255,255,.97)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderBottom: "1px solid var(--lh-border)", boxShadow: "0 40px 80px -40px rgba(var(--lh-navy-rgb),.35)", display: "block" }}
          >
            <div style={{ height: 2, background: "linear-gradient(90deg,var(--lh-signal) 0,var(--lh-signal) 64px,var(--lh-border) 64px)" }} />
            <div className="v5-mega-grid" style={{ maxWidth: 1360, margin: "0 auto", padding: "30px clamp(16px,3vw,32px) 28px", display: "grid", gap: "26px 28px" }}>
              {chrome.menu.map((g) => (
                <div key={g.title} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--lh-action)", marginBottom: 10 }}>{g.title}</div>
                  {g.items.map((it) => (
                    <Link
                      key={it.href}
                      href={it.href}
                      className="v5-hov-ice"
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 10px", margin: "0 -10px", borderRadius: 8, color: "var(--lh-ink)", fontSize: 15, transition: "background .18s ease" }}
                    >
                      <span>{it.label}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--lh-ink-2)" }}>{countFor(it.count)}</span>
                    </Link>
                  ))}
                </div>
              ))}
              {feat ? (
                <Link
                  href={feat.href}
                  className="v5-mega-feat v5-hov-bd-action"
                  style={{ gridColumn: 5, gridRow: "1 / span 2", alignSelf: "start", flexDirection: "column", gap: 10, padding: 14, borderRadius: 18, background: "var(--lh-canvas)", border: "1px solid var(--lh-border)", color: "var(--lh-ink)" }}
                >
                  <span style={{ position: "relative", aspectRatio: "4/3", borderRadius: 12, background: "radial-gradient(100% 90% at 50% 100%,var(--lh-titanium),#FFFFFF)", overflow: "hidden" }}>
                    <LHImg src={feat.img} alt="" pad="10px" blend="multiply" eager />
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".08em", color: "var(--lh-action)" }}>{feat.stockText}</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>{feat.model}</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{feat.priceText}</span>
                </Link>
              ) : null}
            </div>
            <div style={{ maxWidth: 1360, margin: "0 auto", padding: "0 clamp(16px,3vw,32px) 24px", display: "flex", gap: 24, flexWrap: "wrap" }}>
              <Link href="/collections/all" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, gap: 8, fontWeight: 600, fontSize: 14, color: "var(--lh-action)" }}>
                <span>View all {chrome.totalCount} products →</span>
              </Link>
              <Link href="/collections/chromebooks" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, gap: 8, fontWeight: 600, fontSize: 14, color: "var(--lh-ink)" }}>
                Chromebooks →
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      {mnav ? (
        <>
          <div onClick={closeMnav} style={{ position: "fixed", inset: 0, background: "rgba(var(--lh-navy-rgb),.35)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 90 }} />
          <nav
            ref={mnavRef}
            data-lh-dialog="1"
            aria-label="Mobile"
            style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: "min(360px,88vw)", background: "var(--lh-canvas)", borderRight: "1px solid var(--lh-border)", color: "var(--lh-ink)", zIndex: 91, display: "flex", flexDirection: "column", overflow: "auto", boxShadow: "24px 0 60px -30px rgba(var(--lh-navy-rgb),.45)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--lh-border)" }}>
              <Link href="/" aria-label="Laptops HUB home" style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--lh-ink)" }}>
                <Wordmark size={19} />
              </Link>
              <button type="button" onClick={closeMnav} aria-label="Close menu" style={{ width: 44, height: 44, border: 0, background: "transparent", cursor: "pointer", display: "grid", placeItems: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#102039" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              onClick={openSearch}
              style={{ margin: "14px 16px 6px", height: 46, borderRadius: 999, border: "1px solid var(--lh-border)", background: "#FFFFFF", color: "var(--lh-ink-2)", display: "flex", alignItems: "center", gap: 10, padding: "0 16px", fontSize: 14, cursor: "pointer" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2159D4" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              Search laptops
            </button>
            <Link href="/collections/all" style={{ padding: 16, fontSize: 16, fontWeight: 700, color: "var(--lh-ink)", borderBottom: "1px solid var(--lh-border)" }}>
              All products <span style={{ color: "var(--lh-action)", fontFamily: "var(--font-mono)", fontSize: 13 }}>{chrome.totalCount}</span>
            </Link>
            <Link href="/collections/chromebooks" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 16, fontWeight: 700, color: "var(--lh-ink)", borderBottom: "1px solid var(--lh-border)" }}>
              Chromebooks
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", padding: "4px 8px", borderRadius: 999, background: "var(--lh-ice)", color: "var(--lh-action-hover)" }}>NEW</span>
            </Link>
            {chrome.menu.map((g) => {
              const open = mgroup === g.title;
              return (
                <div key={g.title} style={{ borderBottom: "1px solid var(--lh-border)" }}>
                  <button
                    type="button"
                    onClick={() => setMgroup((m) => (m === g.title ? null : g.title))}
                    aria-expanded={open}
                    style={{ width: "100%", height: 56, padding: "0 16px", border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 16, fontWeight: 600, color: "var(--lh-ink)", cursor: "pointer" }}
                  >
                    {g.title}
                    <span style={{ fontSize: 20, fontWeight: 400, color: "var(--lh-action)" }}>{open ? "−" : "+"}</span>
                  </button>
                  {open ? (
                    <div style={{ display: "flex", flexDirection: "column", padding: "0 16px 12px" }}>
                      {g.items.map((it) => (
                        <Link key={it.href} href={it.href} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", fontSize: 15, color: "var(--lh-ink)" }}>
                          {it.label}
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--lh-ink-2)" }}>{countFor(it.count)}</span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <Link href="/compare" style={{ padding: 16, fontSize: 16, fontWeight: 600, color: "var(--lh-ink)", borderBottom: "1px solid var(--lh-border)" }}>
              <span>Compare ({compareCount})</span>
            </Link>
            <Link href="/cart" style={{ padding: 16, fontSize: 16, fontWeight: 600, color: "var(--lh-ink)", borderBottom: "1px solid var(--lh-border)" }}>
              <span>Cart ({cartCount})</span>
            </Link>
          </nav>
        </>
      ) : null}

      <SearchOverlay open={sOpen} onClose={() => setSOpen(false)} />
    </>
  );
}
