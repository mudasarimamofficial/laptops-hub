"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Props = {
  totalCount: number;
  laptopCount: number;
  accessoryCount: number;
  heroImageUrl?: string;
  heroAlt?: string;
};

export function CinematicHero({
  totalCount,
  laptopCount,
  accessoryCount,
  heroImageUrl,
  heroAlt,
}: Props) {
  const [intro, setIntro] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [mx, setMx] = useState(0);
  const [my, setMy] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    if (mq.matches) setIntro(false);
    const t = window.setTimeout(() => setIntro(false), 2200);
    return () => window.clearTimeout(t);
  }, []);

  const inO = reduced || !intro ? 1 : 0;
  const dd = reduced ? 0 : 1;

  return (
    <section
      id="top"
      aria-label="Hero"
      className="relative isolate flex min-h-[min(92vh,860px)] flex-col overflow-hidden bg-[var(--lh-canvas)] text-[var(--lh-ink)]"
      onMouseMove={(e) => {
        if (reduced) return;
        const r = e.currentTarget.getBoundingClientRect();
        setMx((e.clientX - r.left) / r.width - 0.5);
        setMy((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => {
        setMx(0);
        setMy(0);
      }}
      style={
        {
          ["--mx" as string]: String(mx),
          ["--my" as string]: String(my),
          ["--dd" as string]: String(dd),
        } as React.CSSProperties
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(42% 58% at 72% 60%, rgba(33,89,212,.17), rgba(33,89,212,0) 70%), radial-gradient(26% 32% at 80% 26%, rgba(28,185,232,.12), transparent 70%), linear-gradient(180deg, rgba(255,255,255,0) 72%, rgba(223,234,247,.95) 100%), linear-gradient(118deg, #F6F9FE 0%, #FFFFFF 34%, #E4EDF8 50%, #F8FBFF 58%, #EAF2FC 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[6%] -top-[30%] -z-10 h-[160%] w-[60%]"
        style={{
          background: "linear-gradient(100deg, transparent 0%, rgba(255,255,255,.85) 46%, transparent 54%)",
          transform: `rotate(8deg) translate3d(${mx * -20}px, 0, 0)`,
        }}
      />

      {!reduced && intro ? (
        <button
          type="button"
          className="absolute right-4 top-4 z-20 rounded-full border border-[var(--lh-border)] bg-white/90 px-4 py-2 text-sm font-semibold"
          onClick={() => setIntro(false)}
        >
          Skip intro
        </button>
      ) : null}

      <div className="lh-container relative z-[3] grid flex-1 items-center gap-8 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
        <div
          className="flex min-w-0 flex-col gap-5"
          style={{
            opacity: inO || reduced ? 1 : 0,
            transform: inO || reduced ? "none" : "translate3d(0, 28px, 0)",
            transition: `opacity ${0.7 * dd}s ease, transform ${0.8 * dd}s cubic-bezier(.2,.7,.2,1)`,
          }}
        >
          <span className="inline-flex items-center gap-3 self-start font-[family-name:var(--font-mono)] text-xs tracking-[0.2em] text-[var(--lh-ink)]">
            <span className="h-0.5 w-3 bg-[var(--lh-signal)]" />
            DELL · HP · LENOVO
          </span>
          <h1 className="m-0 font-[family-name:var(--font-display)] text-[clamp(2.6rem,6.2vw,4.75rem)] font-bold leading-[0.98] tracking-[-0.05em]">
            <span className="block">The future of</span>
            <span className="block text-[var(--lh-action)]">smarter laptop</span>
            <span className="block">shopping.</span>
          </h1>
          <p className="m-0 max-w-[42ch] text-[clamp(1rem,1.2vw,1.2rem)] leading-relaxed text-[var(--lh-ink-2)]">
            Laptops from Dell, HP, Lenovo and more, with the processor, memory, storage and display listed on every page.
            Filter by spec, then compare up to four side by side.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/collections/all"
              className="inline-flex h-14 items-center gap-3 rounded-[14px] bg-[linear-gradient(180deg,var(--lh-grad-action-from),var(--lh-grad-action-to))] px-7 text-base font-bold text-white shadow-[0_18px_40px_-16px_rgba(33,89,212,.85)]"
            >
              Shop laptops <span aria-hidden>→</span>
            </Link>
            <Link
              href="#brands"
              className="inline-flex h-14 items-center rounded-[14px] border border-[var(--lh-border)] bg-white/75 px-6 text-base font-semibold text-[var(--lh-ink)]"
            >
              Explore categories
            </Link>
            <Link href="/compare" className="inline-flex h-14 items-center gap-1.5 px-2.5 text-base font-semibold text-[var(--lh-action)]">
              Compare
            </Link>
          </div>
          <Link
            href="/collections/chromebooks"
            className="inline-flex min-h-[42px] items-center gap-2.5 self-start rounded-full border border-[var(--lh-border)] bg-white/92 py-1.5 pl-1.5 pr-3.5 text-sm font-semibold"
          >
            <span className="rounded-full bg-[var(--lh-navy)] px-2.5 py-1.5 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] text-white">
              CHROMEBOOKS
            </span>
            Browse the collection
            <span aria-hidden className="text-[var(--lh-action)]">
              →
            </span>
          </Link>
          <div className="flex max-w-[520px] flex-wrap gap-8 border-t border-[var(--lh-border)] pt-4">
            <Link href="/collections/all" className="flex flex-col gap-0.5 text-[var(--lh-ink)]">
              <span className="font-[family-name:var(--font-display)] text-[26px] font-bold">{totalCount}</span>
              <span className="text-[13px] text-[var(--lh-ink-2)]">listings</span>
            </Link>
            <Link href="/collections/laptops" className="flex flex-col gap-0.5 text-[var(--lh-ink)]">
              <span className="font-[family-name:var(--font-display)] text-[26px] font-bold text-[var(--lh-success)]">
                {laptopCount}
              </span>
              <span className="text-[13px] text-[var(--lh-ink-2)]">laptops</span>
            </Link>
            <Link href="/collections/accessories" className="flex flex-col gap-0.5 text-[var(--lh-ink)]">
              <span className="font-[family-name:var(--font-display)] text-[26px] font-bold">{accessoryCount}</span>
              <span className="text-[13px] text-[var(--lh-ink-2)]">accessories</span>
            </Link>
          </div>
        </div>

        <div className="relative min-h-[280px] min-w-0 aspect-[5/4]">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[8%] -translate-x-1/2 font-[family-name:var(--font-display)] text-[clamp(4rem,12vw,8rem)] font-extrabold leading-none tracking-[-0.06em] text-transparent"
            style={{
              WebkitTextStroke: "1.5px rgba(33,89,212,.16)",
              transform: `translate3d(calc(-50% + ${mx * -16}px), 0, 0)`,
            }}
          >
            HUB
          </div>
          <div
            aria-hidden
            className="absolute left-1/2 top-[44%] aspect-square w-[94%] -translate-x-1/2 -translate-y-1/2"
            style={{ transform: `translate3d(calc(-50% + ${mx * -10}px), calc(-50% + ${my * -6}px), 0)` }}
          >
            <div className="absolute inset-0 rounded-full border-[1.5px] border-[rgba(33,89,212,.3)] shadow-[0_0_0_14px_rgba(255,255,255,.4),0_0_80px_rgba(33,89,212,.16)]" />
            <div className="absolute inset-[16%] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,.95),rgba(255,255,255,0))]" />
          </div>
          <div className="absolute inset-[8%] overflow-hidden rounded-[28px]">
            {heroImageUrl ? (
              <Image
                src={heroImageUrl}
                alt={heroAlt || "Featured laptop"}
                fill
                className="object-contain p-4"
                sizes="(max-width:1024px) 90vw, 45vw"
                priority
                unoptimized
              />
            ) : (
              <Image
                src="/approved-assets/cut/dell7420-0.png"
                alt="Dell Latitude 7420"
                fill
                className="object-contain p-2"
                sizes="(max-width:1024px) 90vw, 45vw"
                priority
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
