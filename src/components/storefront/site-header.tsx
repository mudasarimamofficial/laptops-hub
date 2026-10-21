"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/commerce/cart-store";
import { useCompare } from "@/lib/commerce/compare-store";

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

export function SiteHeader() {
  const [mega, setMega] = useState(false);
  const [mobile, setMobile] = useState(false);
  const cartCount = useCart((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  const compareCount = useCompare((s) => s.handles.length);

  return (
    <header
      className="sticky top-0 z-40 border-b border-[var(--lh-border)] bg-[rgba(247,250,255,.84)] text-[var(--lh-ink)] backdrop-blur-[18px]"
      onMouseLeave={() => setMega(false)}
    >
      <div className="lh-container flex h-[72px] items-center gap-3 md:gap-5">
        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-lg md:hidden"
          aria-label="Open menu"
          onClick={() => setMobile((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-1.5 no-underline" aria-label="Laptops HUB home">
          <span className="font-[family-name:var(--font-display)] text-[21px] font-bold tracking-[-0.03em]">Laptops</span>
          <span className="rounded-[6px] bg-[var(--lh-signal)] px-2 py-1 font-[family-name:var(--font-display)] text-[12px] font-extrabold tracking-[0.12em] text-white shadow-[inset_0_-2px_0_rgba(0,0,0,.14)]">
            HUB
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden h-full items-center gap-0.5 md:flex">
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

        <Link
          href="/search"
          className="hidden h-11 w-[min(320px,26vw)] items-center gap-2.5 overflow-hidden rounded-full border border-[var(--lh-border)] bg-white/80 px-4 text-sm text-[var(--lh-ink-2)] md:flex"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2159D4" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          Search model, processor, RAM
        </Link>
        <Link
          href="/compare"
          className="hidden h-11 items-center gap-2 rounded-full border border-[var(--lh-border)] bg-white/80 px-3.5 text-sm font-semibold md:flex"
        >
          Compare
          <span className="grid min-w-[22px] place-items-center rounded-full bg-[var(--lh-ice)] px-1.5 text-xs font-bold text-[var(--lh-action)]">
            {compareCount}
          </span>
        </Link>
        <Link
          href="/cart"
          className="mr-[-4px] flex h-11 items-center gap-2 rounded-full bg-[var(--lh-action)] px-4 text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgba(33,89,212,.9)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="M5 8h14l-1.2 12H6.2L5 8z" />
            <path d="M9 8V6a3 3 0 016 0v2" />
          </svg>
          <span>{cartCount}</span>
        </Link>
      </div>

      {mega ? (
        <div className="absolute inset-x-0 top-full max-h-[calc(100vh-72px)] overflow-auto border-b border-[var(--lh-border)] bg-white/97 shadow-[0_40px_80px_-40px_rgba(10,23,48,.35)] backdrop-blur-xl">
          <div className="h-0.5 bg-[linear-gradient(90deg,var(--lh-signal)_0,var(--lh-signal)_64px,var(--lh-border)_64px)]" />
          <div className="lh-container grid gap-6 py-7 md:grid-cols-3">
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
          <div className="lh-container flex flex-wrap gap-6 pb-6">
            <Link href="/collections/all" className="text-sm font-semibold text-[var(--lh-action)]" onClick={() => setMega(false)}>
              View all products →
            </Link>
            <Link href="/collections/chromebooks" className="text-sm font-semibold" onClick={() => setMega(false)}>
              Chromebooks →
            </Link>
          </div>
        </div>
      ) : null}

      {mobile ? (
        <div className="border-t border-[var(--lh-border)] bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {[...MEGA.flatMap((g) => g.items), ...NAV].map((it) => (
              <Link
                key={it.href + it.label}
                href={it.href}
                className="rounded-lg px-3 py-3 text-[15px] font-medium hover:bg-[var(--lh-ice)]"
                onClick={() => setMobile(false)}
              >
                {it.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
