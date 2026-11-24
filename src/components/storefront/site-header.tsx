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
import { useHydrated } from "@/lib/ui/use-hydrated";
import type { V5MenuGroup } from "@/lib/catalog/v5-model";
import { DEFAULT_THEME_GLOBALS, isDefaultGlobal, type ThemeGlobals } from "@/lib/content/theme-globals";

export type MegaFeature = { href: string; img: string | null; model: string; priceText: string; stockText: string };
/** `supportHref`: first public help page (FAQ → contact → order inquiries), else order tracking. */
export type ChromeData = {
  menu: V5MenuGroup[];
  megaFeat: MegaFeature | null;
  totalCount: number;
  /** Show catalog counts (Admin → Settings → Storefront labels; hidden by default at the owner's request). */
  showCounts?: boolean;
  supportHref: string;
  guidesPublic: boolean;
  navLinks?: { id?: string; label: string; href: string; isNew?: boolean }[];
  /** Published site-wide copy (theme editor → Header & footer); V5 defaults when absent. */
  globals?: ThemeGlobals;
};

/** V5 `navLinks` (shown at ≥1180px). */
const NAV_LINKS: { id?: string; label: string; href: string; isNew?: boolean }[] = [
  { label: "Dell", href: "/collections/dell" },
  { label: "HP", href: "/collections/hp" },
  { label: "Lenovo", href: "/collections/lenovo" },
  { label: "Chromebooks", href: "/collections/chromebooks", isNew: true },
  { label: "Accessories", href: "/collections/accessories" },
  { id: "h-guides", label: "Guides", href: "/guides" },
  { id: "h-support", label: "Support", href: "/pages/faq" },
];

/**
 * Special header links are recognised by their navigation id (Admin → Navigation keeps ids when a link is renamed),
 * falling back to the V5 label for links saved without an id. Renaming "Support" to "Help" keeps its behaviour.
 */
function navRole(l: { id?: string; label: string }): "guides" | "support" | null {
  if (l.id === "h-guides" || (!l.id && l.label === "Guides")) return "guides";
  if (l.id === "h-support" || (!l.id && l.label === "Support")) return "support";
  return null;
}

function Wordmark({ size, onDark }: { size: number; onDark?: boolean }) {
  return (
    <>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: size,
          letterSpacing: "-.02em",
          textTransform: "uppercase",
          color: onDark ? "#FFFFFF" : undefined,
        }}
      >
        LAPTOPS
      </span>{" "}
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
  const hydrated = useHydrated();
  const [mega, setMega] = useState(false);
  const [mnav, setMnav] = useState(false);
  const [sOpen, setSOpen] = useState(false);
  const [mgroup, setMgroup] = useState<string | null>("Brand");
  const [finePointer, setFinePointer] = useState(false);
  const cartCount = useCart((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  const compareCount = useCompare((s) => s.handles.length);
  const mnavRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  /** Ignore the mouse click that immediately follows a hover-open (same gesture would toggle closed). */
  const suppressClickCloseRef = useRef(false);
  const closeMnav = useCallback(() => setMnav(false), []);
  useDialog(mnav, mnavRef, closeMnav);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setFinePointer(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Publish sticky header (+ promo) bottom so the mega panel can bound to remaining viewport height.
  useEffect(() => {
    const root = document.documentElement;
    const syncOffset = () => {
      const header = headerRef.current;
      if (!header) return;
      root.style.setProperty("--lh-header-offset", `${Math.max(72, Math.round(header.getBoundingClientRect().bottom))}px`);
    };
    syncOffset();
    window.addEventListener("resize", syncOffset);
    window.addEventListener("scroll", syncOffset, { passive: true });
    return () => {
      window.removeEventListener("resize", syncOffset);
      window.removeEventListener("scroll", syncOffset);
    };
  }, [mega]);

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
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && headerRef.current?.contains(t)) return;
      setMega(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [mega]);

  const openSearch = () => {
    setSOpen(true);
    setMega(false);
    setMnav(false);
  };
  const openMega = () => {
    setMega(true);
    setMgroup((g) => g ?? chrome.menu[0]?.title ?? null);
  };
  const closeMega = () => mega && setMega(false);
  const activeMegaGroup = chrome.menu.find((g) => g.title === mgroup) ?? chrome.menu[0] ?? null;
  const countFor = (c: number | string) => (c === "__compare__" ? `${compareCount}/4` : c);
  const isCur = (l: { id?: string; href: string; label: string }) =>
    pathname === l.href ||
    (navRole(l) === "guides" && pathname.startsWith("/guides")) ||
    (navRole(l) === "support" && pathname.startsWith("/pages/"));
  const gc = chrome.globals ?? DEFAULT_THEME_GLOBALS;
  const feat = chrome.megaFeat;

  return (
    <>
      <header
        ref={headerRef}
        onMouseLeave={() => {
          if (finePointer) closeMega();
        }}
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
            data-testid="mobile-nav-open"
            data-ready={hydrated ? "true" : "false"}
            // Pre-hydration clicks look successful but never open the drawer — gate until handlers are live.
            disabled={!hydrated}
            onClick={() => setMnav(true)}
            aria-label="Open menu"
            aria-expanded={mnav}
            style={{
              width: 44,
              height: 44,
              marginLeft: -10,
              border: 0,
              background: "transparent",
              display: "grid",
              placeItems: "center",
              cursor: hydrated ? "pointer" : "wait",
              color: "var(--lh-ink)",
              opacity: hydrated ? 1 : 0.7,
            }}
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
              data-testid="desktop-mega-trigger"
              onClick={() => {
                if (suppressClickCloseRef.current) {
                  suppressClickCloseRef.current = false;
                  if (!mega) openMega();
                  return;
                }
                if (mega) setMega(false);
                else openMega();
              }}
              onMouseEnter={() => {
                if (!finePointer) return;
                if (!mega) {
                  openMega();
                  suppressClickCloseRef.current = true;
                }
              }}
              aria-expanded={mega}
              aria-controls="lh-mega-menu"
              style={{ height: 40, padding: "0 14px", border: 0, borderRadius: 10, background: mega ? "var(--lh-ice)" : "transparent", fontSize: 15, fontWeight: 600, color: "var(--lh-ink)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", transition: "background .2s ease" }}
            >
              {gc.laptopsMenuLabel}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2159D4" strokeWidth="2.4" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {((chrome.navLinks && chrome.navLinks.length > 0 ? chrome.navLinks : NAV_LINKS))
              .filter((n) => navRole(n) !== "guides" || chrome.guidesPublic)
              .map((n) => (navRole(n) === "support" && chrome.supportHref ? { ...n, href: chrome.supportHref } : n))
              .map((l) => {
              const cur = isCur(l);
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
            aria-label={gc.searchLabel}
            style={{
              width: "clamp(44px, 18vw, 280px)",
              maxWidth: 280,
              height: 44,
              border: "1px solid var(--lh-border)",
              borderRadius: 999,
              background: "rgba(255,255,255,.8)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 14px",
              color: "var(--lh-ink-2)",
              fontSize: 14,
              cursor: "pointer",
              transition: "border-color .2s ease,box-shadow .2s ease",
              flexShrink: 1,
              minWidth: 44,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2159D4" strokeWidth="2" aria-hidden="true" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <span className="v5-header-search-text" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span className="v5-header-search-label-full">{gc.searchLabel}</span>
              <span className="v5-header-search-label-short">{gc.searchShortLabel}</span>
            </span>
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
            aria-label={`Open cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
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
            id="lh-mega-menu"
            className="v5-d-only v5-mega-panel"
            role="region"
            aria-label="Catalog menu"
            data-testid="desktop-mega-menu"
            data-open="true"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "100%",
              background: "rgba(255,255,255,.98)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderBottom: "1px solid var(--lh-border)",
              boxShadow: "0 28px 56px -36px rgba(var(--lh-navy-rgb),.4)",
            }}
          >
            <div style={{ height: 2, flex: "0 0 auto", background: "linear-gradient(90deg,var(--lh-signal) 0,var(--lh-signal) 64px,var(--lh-border) 64px)" }} />
            <div className="v5-mega-body">
              <div className="v5-mega-grid" style={{ maxWidth: 1360, margin: "0 auto", padding: "14px clamp(16px,3vw,32px) 12px", display: "grid", gap: "12px 20px" }}>
                <nav aria-label="Catalog categories" className="v5-mega-groups" style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                  {chrome.menu.map((g) => {
                    const selected = (activeMegaGroup?.title ?? "") === g.title;
                    return (
                      <button
                        key={g.title}
                        type="button"
                        data-testid={`mega-group-${g.title}`}
                        aria-pressed={selected}
                        onMouseEnter={() => {
                          if (finePointer) setMgroup(g.title);
                        }}
                        onFocus={() => setMgroup(g.title)}
                        onClick={() => setMgroup(g.title)}
                        className="v5-hov-ice v5-mega-group-btn"
                        style={{
                          textAlign: "left",
                          border: 0,
                          cursor: "pointer",
                          borderRadius: 10,
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          letterSpacing: ".08em",
                          textTransform: "uppercase",
                          fontWeight: 600,
                          color: selected ? "var(--lh-action)" : "var(--lh-ink)",
                          background: selected ? "var(--lh-ice)" : "transparent",
                        }}
                      >
                        {g.title}
                      </button>
                    );
                  })}
                </nav>
                <div className="v5-mega-links" style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--lh-action)", marginBottom: 8 }}>
                    {activeMegaGroup?.title ?? "Browse"}
                  </div>
                  <div className="v5-mega-links-grid" data-count={activeMegaGroup?.items.length ?? 0}>
                    {(activeMegaGroup?.items ?? []).map((it) => (
                      <Link
                        key={it.href}
                        href={it.href}
                        className="v5-hov-ice"
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, color: "var(--lh-ink)", fontSize: 15, transition: "background .18s ease", minHeight: 40 }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
                        {chrome.showCounts ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--lh-ink-2)", flexShrink: 0 }}>{countFor(it.count)}</span> : null}
                      </Link>
                    ))}
                  </div>
                </div>
                {feat ? (
                  <Link
                    href={feat.href}
                    className="v5-mega-feat v5-hov-bd-action"
                    style={{ alignSelf: "start", flexDirection: "column", gap: 8, padding: 12, borderRadius: 16, background: "var(--lh-canvas)", border: "1px solid var(--lh-border)", color: "var(--lh-ink)", width: "100%", maxWidth: 220 }}
                  >
                    <span style={{ position: "relative", aspectRatio: "4/3", borderRadius: 12, background: "radial-gradient(100% 90% at 50% 100%,var(--lh-titanium),#FFFFFF)", overflow: "hidden" }}>
                      <LHImg src={feat.img} alt="" pad="10px" blend="multiply" eager />
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".08em", color: "var(--lh-action)" }}>{feat.stockText}</span>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, lineHeight: 1.25 }}>{feat.model}</span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{feat.priceText}</span>
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="v5-mega-footer" style={{ maxWidth: 1360, width: "100%", margin: "0 auto", padding: "8px clamp(16px,3vw,32px) 12px", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <Link href="/collections/all" style={{ display: "inline-flex", alignItems: "center", minHeight: 40, gap: 8, fontWeight: 600, fontSize: 14, color: "var(--lh-action)" }}>
                <span>{chrome.showCounts && isDefaultGlobal(gc, "menuAllLabel") ? `View all ${chrome.totalCount} products →` : `${gc.menuAllLabel} →`}</span>
              </Link>
              <Link href={gc.menuSecondHref} style={{ display: "inline-flex", alignItems: "center", minHeight: 40, gap: 8, fontWeight: 600, fontSize: 14, color: "var(--lh-ink)" }}>
                {gc.menuSecondLabel} →
              </Link>
              <button
                type="button"
                onClick={closeMega}
                data-testid="desktop-mega-close"
                style={{ marginLeft: "auto", minHeight: 40, padding: "0 12px", border: "1px solid var(--lh-border)", borderRadius: 999, background: "#fff", fontSize: 13, fontWeight: 600, color: "var(--lh-ink-2)", cursor: "pointer" }}
              >
                Close
              </button>
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
              {gc.searchShortLabel}
            </button>
            <Link href="/collections/all" style={{ padding: 16, fontSize: 16, fontWeight: 700, color: "var(--lh-ink)", borderBottom: "1px solid var(--lh-border)" }}>
              All products{chrome.showCounts ? <> <span style={{ color: "var(--lh-action)", fontFamily: "var(--font-mono)", fontSize: 13 }}>{chrome.totalCount}</span></> : null}
            </Link>
            <Link href={gc.menuSecondHref} style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 16, fontWeight: 700, color: "var(--lh-ink)", borderBottom: "1px solid var(--lh-border)" }}>
              {gc.menuSecondLabel}
              {isDefaultGlobal(gc, "menuSecondLabel") && isDefaultGlobal(gc, "menuSecondHref") ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", padding: "4px 8px", borderRadius: 999, background: "var(--lh-ice)", color: "var(--lh-action-hover)" }}>NEW</span> : null}
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
                          {chrome.showCounts ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--lh-ink-2)" }}>{countFor(it.count)}</span> : null}
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
