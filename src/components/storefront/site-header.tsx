"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/commerce/cart-store";
import { openCartDrawer } from "@/lib/commerce/cart-ui";
import { useCompare } from "@/lib/commerce/compare-store";
import { SearchOverlay } from "@/components/storefront/search-overlay";

const NAV = [
  { label: "Dell", href: "/collections/dell" },
  { label: "HP", href: "/collections/hp" },
  { label: "Lenovo", href: "/collections/lenovo" },
  { label: "Accessories", href: "/collections/accessories" },
  { label: "Contact", href: "/pages/contact" },
];

const MEGA = [
  {
    title: "Category",
    items: [
      { label: "All laptops", href: "/collections/laptops" },
      { label: "Gaming", href: "/collections/gaming-laptops" },
      { label: "MacBooks", href: "/collections/macbooks" },
      { label: "Chromebooks", href: "/collections/chromebooks" },
      { label: "Tablets", href: "/collections/tablets" },
      { label: "Accessories", href: "/collections/accessories" },
      { label: "Chargers", href: "/collections/chargers" },
      { label: "Workstations", href: "/collections/workstations" },
    ],
  },
  {
    title: "Brand",
    items: [
      { label: "Dell", href: "/collections/dell" },
      { label: "HP", href: "/collections/hp" },
      { label: "Lenovo", href: "/collections/lenovo" },
      { label: "Apple", href: "/collections/apple" },
      { label: "Microsoft", href: "/collections/microsoft" },
    ],
  },
  {
    title: "Budget",
    items: [
      { label: "Under Rs 40k", href: "/collections/under-40k" },
      { label: "Rs 40k – 60k", href: "/collections/40k-60k" },
      { label: "Over Rs 60k", href: "/collections/over-60k" },
    ],
  },
];

const M_GROUPS = [
  {
    title: "Shop by category",
    items: MEGA[0].items,
  },
  {
    title: "Shop by brand",
    items: MEGA[1].items,
  },
  {
    title: "Shop by budget",
    items: MEGA[2].items,
  },
];

export function SiteHeader() {
  const [mega, setMega] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const cartCount = useCart((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  const compareCount = useCompare((s) => s.handles.length);

  useEffect(() => {
    if (!mobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobile]);

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b border-[var(--lh-border)] bg-[rgba(247,250,255,.84)] text-[var(--lh-ink)] backdrop-blur-[18px] saturate-[160%]"
        onMouseLeave={() => setMega(false)}
      >
        <div
          className="mx-auto flex h-[72px] items-center"
          style={{
            maxWidth: 1360,
            padding: "0 clamp(16px, 3vw, 32px)",
            gap: "clamp(6px, 2.4vw, 24px)",
          }}
        >
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-lg lg:hidden"
            aria-label="Open menu"
            aria-expanded={mobile}
            onClick={() => setMobile(true)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>

          <Link href="/" className="flex shrink-0 items-center gap-[7px] no-underline" aria-label="Laptops HUB home">
            <span className="font-[family-name:var(--font-display)] text-[21px] font-bold tracking-[-0.03em]">
              Laptops
            </span>
            <span className="rounded-[6px] bg-[var(--lh-signal)] px-2 py-[5px] font-[family-name:var(--font-display)] text-[12px] font-extrabold leading-none tracking-[0.12em] text-white shadow-[inset_0_-2px_0_rgba(0,0,0,.14)]">
              HUB
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden h-full items-center gap-0.5 min-[1180px]:flex">
            <button
              type="button"
              className="flex h-10 items-center gap-1.5 rounded-[10px] px-3.5 text-[15px] font-semibold hover:bg-[var(--lh-ice)]"
              aria-expanded={mega}
              onMouseEnter={() => setMega(true)}
              onClick={() => setMega((v) => !v)}
            >
              Laptops
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2159D4" strokeWidth="2.4">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {NAV.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex h-10 items-center rounded-[10px] px-3 text-[15px] font-medium hover:bg-[var(--lh-ice)]"
                onMouseEnter={() => setMega(false)}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => {
              setSearchOpen(true);
              setMega(false);
              setMobile(false);
            }}
            className="hidden h-11 w-[min(320px,26vw)] items-center gap-2.5 overflow-hidden rounded-full border border-[var(--lh-border)] bg-white/80 px-4 text-left text-sm text-[var(--lh-ink-2)] transition hover:border-[var(--lh-action)] hover:shadow-[0_0_0_4px_rgba(33,89,212,.1)] md:flex"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2159D4" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            Search model, processor, RAM
          </button>

          <button
            type="button"
            aria-label="Search"
            className="grid h-11 w-11 place-items-center md:hidden"
            onClick={() => setSearchOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>

          <Link
            href="/compare"
            className="hidden h-11 items-center gap-2 rounded-full border border-[var(--lh-border)] bg-white/80 px-3.5 text-sm font-semibold md:flex"
          >
            Compare
            <span className="grid min-w-[22px] place-items-center rounded-full bg-[var(--lh-ice)] px-1.5 text-xs font-bold text-[var(--lh-action)]">
              {compareCount}
            </span>
          </Link>
          <button
            type="button"
            onClick={openCartDrawer}
            className="mr-[-4px] flex h-11 items-center gap-2 rounded-full bg-[var(--lh-action)] px-4 text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgba(33,89,212,.9)]"
            aria-label={`Open cart, ${cartCount} items`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M5 8h14l-1.2 12H6.2L5 8z" />
              <path d="M9 8V6a3 3 0 016 0v2" />
            </svg>
            <span>{cartCount}</span>
          </button>
        </div>

        {mega ? (
          <div
            className="absolute inset-x-0 top-full max-h-[calc(100vh-72px)] overflow-auto overscroll-contain border-b border-[var(--lh-border)] bg-white/97 shadow-[0_40px_80px_-40px_rgba(10,23,48,.35)] backdrop-blur-[24px]"
            onMouseEnter={() => setMega(true)}
          >
            <div className="h-0.5 bg-[linear-gradient(90deg,var(--lh-signal)_0,var(--lh-signal)_64px,var(--lh-border)_64px)]" />
            <div
              className="mx-auto grid gap-6 py-7 md:grid-cols-3"
              style={{ maxWidth: 1360, paddingLeft: "clamp(16px,3vw,32px)", paddingRight: "clamp(16px,3vw,32px)" }}
            >
              {MEGA.map((g) => (
                <div key={g.title}>
                  <p className="mb-2.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--lh-action)]">
                    {g.title}
                  </p>
                  <ul className="space-y-0.5">
                    {g.items.map((it) => (
                      <li key={it.href}>
                        <Link
                          href={it.href}
                          className="block rounded-lg px-2.5 py-2 text-[15px] hover:bg-[var(--lh-ice)]"
                          onClick={() => setMega(false)}
                        >
                          {it.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div
              className="mx-auto flex flex-wrap gap-6 pb-6"
              style={{ maxWidth: 1360, paddingLeft: "clamp(16px,3vw,32px)", paddingRight: "clamp(16px,3vw,32px)" }}
            >
              <Link href="/collections/all" className="text-sm font-semibold text-[var(--lh-action)]" onClick={() => setMega(false)}>
                View all products →
              </Link>
              <Link href="/collections/chromebooks" className="text-sm font-semibold" onClick={() => setMega(false)}>
                Chromebooks →
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      {mobile ? (
        <>
          <div
            className="fixed inset-0 z-[90] bg-[rgba(10,23,48,.35)] backdrop-blur-[4px]"
            onClick={() => setMobile(false)}
            aria-hidden
          />
          <nav
            aria-label="Mobile"
            className="fixed bottom-0 left-0 top-0 z-[91] flex w-[min(360px,88vw)] flex-col overflow-auto border-r border-[var(--lh-border)] bg-[var(--lh-canvas)] text-[var(--lh-ink)] shadow-[24px_0_60px_-30px_rgba(10,23,48,.45)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--lh-border)] px-4 py-3.5">
              <Link href="/" aria-label="Laptops HUB home" className="flex items-center gap-[7px]" onClick={() => setMobile(false)}>
                <span className="font-[family-name:var(--font-display)] text-[19px] font-bold tracking-[-0.03em]">Laptops</span>
                <span className="rounded-[6px] bg-[var(--lh-signal)] px-2 py-[5px] font-[family-name:var(--font-display)] text-[12px] font-extrabold leading-none tracking-[0.12em] text-white shadow-[inset_0_-2px_0_rgba(0,0,0,.14)]">
                  HUB
                </span>
              </Link>
              <button
                type="button"
                aria-label="Close menu"
                className="grid h-11 w-11 place-items-center"
                onClick={() => setMobile(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#102039" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              className="mx-4 mt-3.5 mb-1.5 flex h-[46px] items-center gap-2.5 rounded-full border border-[var(--lh-border)] bg-white px-4 text-sm text-[var(--lh-ink-2)]"
              onClick={() => {
                setMobile(false);
                setSearchOpen(true);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2159D4" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              Search laptops
            </button>
            <Link
              href="/collections/all"
              className="border-b border-[var(--lh-border)] px-4 py-4 text-base font-bold"
              onClick={() => setMobile(false)}
            >
              All products
            </Link>
            <Link
              href="/collections/chromebooks"
              className="flex items-center justify-between gap-2.5 border-b border-[var(--lh-border)] px-4 py-3.5 text-base font-bold"
              onClick={() => setMobile(false)}
            >
              Chromebooks
              <span className="rounded-full bg-[var(--lh-ice)] px-2 py-1 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.1em] text-[var(--lh-action-hover)]">
                NEW
              </span>
            </Link>
            {M_GROUPS.map((g) => {
              const open = !!openGroups[g.title];
              return (
                <div key={g.title} className="border-b border-[var(--lh-border)]">
                  <button
                    type="button"
                    aria-expanded={open}
                    className="flex h-14 w-full items-center justify-between px-4 text-base font-semibold"
                    onClick={() => setOpenGroups((s) => ({ ...s, [g.title]: !s[g.title] }))}
                  >
                    {g.title}
                    <span className="text-xl font-normal text-[var(--lh-action)]">{open ? "−" : "+"}</span>
                  </button>
                  {open ? (
                    <div className="flex flex-col px-4 pb-3">
                      {g.items.map((it) => (
                        <Link
                          key={it.href}
                          href={it.href}
                          className="py-3 text-[15px]"
                          onClick={() => setMobile(false)}
                        >
                          {it.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <Link href="/compare" className="border-b border-[var(--lh-border)] px-4 py-4 text-base font-semibold" onClick={() => setMobile(false)}>
              Compare ({compareCount})
            </Link>
            <Link href="/cart" className="border-b border-[var(--lh-border)] px-4 py-4 text-base font-semibold" onClick={() => setMobile(false)}>
              Cart ({cartCount})
            </Link>
            {NAV.filter((n) => n.label === "Contact").map((l) => (
              <Link key={l.href} href={l.href} className="px-4 py-4 text-base font-semibold" onClick={() => setMobile(false)}>
                {l.label}
              </Link>
            ))}
          </nav>
        </>
      ) : null}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
