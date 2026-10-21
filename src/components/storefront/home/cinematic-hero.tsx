"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatPkr } from "@/lib/money";

export type HeroLaptop = {
  handle: string;
  label: string;
  imageUrl?: string;
  pricePaisa?: number;
  chips?: string[];
  stockText?: string;
};

type Props = {
  totalCount: number;
  laptopCount: number;
  accessoryCount: number;
  compareCount?: number;
  main: HeroLaptop;
  sideLeft?: HeroLaptop;
  sideRight?: HeroLaptop;
};

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function useIsMobile() {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia("(max-width: 767px)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
}

export function CinematicHero({
  totalCount,
  laptopCount,
  accessoryCount,
  compareCount = 0,
  main,
  sideLeft,
  sideRight,
}: Props) {
  const reduced = usePrefersReducedMotion();
  const isMobile = useIsMobile();
  /** Entrance phase: boot → play (animating) → done. Content stays readable (no long opacity-0 blank). */
  const [entrance, setPhase] = useState<"boot" | "play" | "done">("boot");
  const phase = reduced ? "done" : entrance;
  const [hp, setHp] = useState(0);
  const [mx, setMx] = useState(0);
  const [my, setMy] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let cancelled = false;
    let doneTimer = 0;
    // Double-rAF so first paint includes SSR content, then entrance CSS runs once.
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        setPhase("play");
        doneTimer = window.setTimeout(() => {
          if (!cancelled) setPhase("done");
        }, 1600);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (doneTimer) window.clearTimeout(doneTimer);
    };
  }, [reduced]);

  useEffect(() => {
    if (reduced || isMobile) return;
    const onScroll = () => {
      const y = window.scrollY;
      const vh = window.innerHeight;
      setHp(Math.min(1, Math.max(0, y / Math.max(vh * 0.55, 1))));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduced, isMobile]);

  const showSkip = phase === "play";
  const inO = 1; // always visible for LCP / a11y; motion via transform
  const dd = reduced || phase === "boot" ? 0 : 1;
  const inT = "none";
  const lapInL = phase === "boot" ? "translate3d(-24px, 12px, 0)" : "none";
  const lapInR = phase === "boot" ? "translate3d(24px, 12px, 0)" : "none";
  const lapInC = phase === "boot" ? "translate3d(0, 28px, 0) scale(.96)" : "none";
  const ringT = phase === "boot" ? "scale(.92)" : "none";
  const sweepT = phase === "boot" ? "translate3d(-120%, 0, 0)" : "translate3d(160%, 0, 0)";

  const chips = (main.chips || []).slice(0, 4);
  const priceText = main.pricePaisa != null ? formatPkr(main.pricePaisa) : "";

  return (
    <section
      id="top"
      aria-label="Hero"
      className="relative isolate flex flex-col overflow-hidden bg-[var(--lh-canvas)] text-[var(--lh-ink)]"
      style={
        {
          minHeight: isMobile ? "auto" : "max(640px, calc(100vh - 72px))",
          ["--hp" as string]: String(hp),
          ["--mx" as string]: String(mx),
          ["--my" as string]: String(my),
          ["--dd" as string]: String(dd),
        } as React.CSSProperties
      }
      onMouseMove={(e) => {
        if (reduced || isMobile) return;
        const r = e.currentTarget.getBoundingClientRect();
        setMx(((e.clientX - r.left) / r.width - 0.5) * 2);
        setMy(((e.clientY - r.top) / r.height - 0.5) * 2);
      }}
      onMouseLeave={() => {
        setMx(0);
        setMy(0);
      }}
    >
      {/* Atmosphere layers — V5 exact gradients */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-[5]"
        style={{
          background:
            "radial-gradient(42% 58% at 72% 60%, rgba(33,89,212,.17), rgba(33,89,212,0) 70%), radial-gradient(26% 32% at 80% 26%, rgba(28,185,232,.12), transparent 70%), linear-gradient(180deg, rgba(255,255,255,0) 72%, rgba(223,234,247,.95) 100%), linear-gradient(118deg, #F6F9FE 0%, #FFFFFF 34%, #E4EDF8 50%, #F8FBFF 58%, #EAF2FC 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[6%] -top-[30%] -z-[4] h-[160%] w-[60%]"
        style={{
          background: "linear-gradient(100deg, transparent 0%, rgba(255,255,255,.85) 46%, transparent 54%)",
          transform: `rotate(8deg) translate3d(${mx * -20}px, 0, 0)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 -z-[5]"
        style={{
          backgroundImage: "radial-gradient(rgba(33,89,212,.2) 1px, transparent 1.4px)",
          backgroundSize: "26px 26px",
          WebkitMaskImage: "radial-gradient(48% 55% at 72% 50%, #000, transparent 78%)",
          maskImage: "radial-gradient(48% 55% at 72% 50%, #000, transparent 78%)",
          transform: `translate3d(${mx * -8}px, ${hp * 70}px, 0)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 top-0 z-[4] w-[60%]"
        style={{
          background: "linear-gradient(100deg, transparent 0%, rgba(255,255,255,.55) 48%, transparent 62%)",
          transform: sweepT,
          transition: `transform ${1.9 * dd}s cubic-bezier(.2,.7,.2,1) ${0.35 * dd}s`,
        }}
      />

      <div
        className="relative z-[3] mx-auto grid w-full flex-1 items-center gap-[clamp(8px,2vw,32px)]"
        style={{
          maxWidth: 1440,
          padding: isMobile ? "32px 20px 8px" : "28px clamp(24px,4vw,56px) 8px",
          gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "minmax(0,.92fr) minmax(0,1.08fr)",
        }}
      >
        {/* Copy column */}
        <div
          className="relative z-[3] flex min-w-0 flex-col gap-[clamp(18px,2vw,26px)]"
          style={{
            opacity: Math.max(0, 1 - hp * 1.5),
            transform: `translate3d(0, ${hp * -80}px, 0)`,
          }}
        >
          <span
            className="inline-flex items-center gap-3 self-start whitespace-nowrap font-[family-name:var(--font-mono)] text-xs tracking-[0.2em] text-[var(--lh-ink)]"
            style={{
              opacity: inO,
              transform: inT,
              transition: `opacity ${0.6 * dd}s ease ${0.05 * dd}s, transform ${0.7 * dd}s cubic-bezier(.2,.7,.2,1) ${0.05 * dd}s`,
            }}
          >
            <span className="h-0.5 w-3 bg-[var(--lh-signal)]" />
            DELL · HP · LENOVO
          </span>

          <h1
            className="m-0 font-[family-name:var(--font-display)] font-bold leading-[0.98] tracking-[-0.05em] text-[var(--lh-ink)]"
            style={{
              fontSize: isMobile ? "clamp(2.4rem,11vw,3.4rem)" : "clamp(2.6rem,6.2vw,4.75rem)",
              opacity: inO,
              transform: inT,
              transition: `opacity ${0.7 * dd}s ease ${0.15 * dd}s, transform ${0.8 * dd}s cubic-bezier(.2,.7,.2,1) ${0.15 * dd}s`,
            }}
          >
            <span className="block">The future of</span>
            <span className="block text-[var(--lh-action)]">smarter laptop</span>
            <span className="block">shopping.</span>
          </h1>

          <p
            className="m-0 max-w-[42ch] text-[clamp(16px,1.2vw,19px)] leading-[1.55] text-[var(--lh-ink-2)] text-pretty"
            style={{
              opacity: inO,
              transform: inT,
              transition: `opacity ${0.7 * dd}s ease ${0.28 * dd}s, transform ${0.8 * dd}s cubic-bezier(.2,.7,.2,1) ${0.28 * dd}s`,
            }}
          >
            Laptops from Dell, HP, Lenovo and more, with the processor, memory, storage and display listed on every
            page. Filter by spec, then compare up to four side by side.
          </p>

          <div
            className="flex flex-wrap items-center gap-3"
            style={{
              opacity: inO,
              transform: inT,
              transition: `opacity ${0.7 * dd}s ease ${0.4 * dd}s, transform ${0.8 * dd}s cubic-bezier(.2,.7,.2,1) ${0.4 * dd}s`,
            }}
          >
            <Link
              href="/collections/all"
              className="relative inline-flex h-14 items-center gap-3 overflow-hidden rounded-[14px] bg-[linear-gradient(180deg,var(--lh-grad-action-from),var(--lh-grad-action-to))] px-7 text-base font-bold text-white shadow-[0_18px_40px_-16px_rgba(33,89,212,.85),inset_0_1px_0_rgba(255,255,255,.35)] transition hover:-translate-y-0.5"
            >
              Shop laptops <span aria-hidden>→</span>
            </Link>
            <Link
              href="#brands"
              className="inline-flex h-14 items-center rounded-[14px] border border-[var(--lh-border)] bg-white/75 px-6 text-base font-semibold text-[var(--lh-ink)] transition hover:border-[var(--lh-action)]"
            >
              Explore categories
            </Link>
            <Link
              href="/compare"
              className="inline-flex h-14 items-center gap-1.5 px-2.5 text-base font-semibold text-[var(--lh-action)] hover:text-[var(--lh-action-hover)]"
            >
              Compare{" "}
              <span className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--lh-ink-2)]">
                ({compareCount})
              </span>
            </Link>
          </div>

          <Link
            href="/collections/chromebooks"
            className="inline-flex min-h-[42px] items-center gap-2.5 self-start rounded-full border border-[var(--lh-border)] bg-white/92 py-[5px] pl-[5px] pr-3.5 text-sm font-semibold text-[var(--lh-ink)] transition hover:border-[var(--lh-electric)]"
            style={{
              opacity: inO,
              transform: inT,
              transition: `opacity ${0.8 * dd}s ease ${0.4 * dd}s, transform ${0.8 * dd}s cubic-bezier(.2,.7,.2,1) ${0.4 * dd}s`,
            }}
          >
            <span className="rounded-full bg-[var(--lh-navy)] px-2.5 py-1.5 font-[family-name:var(--font-mono)] text-[10px] font-medium tracking-[0.12em] text-white">
              CHROMEBOOKS
            </span>
            Browse the collection
            <span aria-hidden className="text-[var(--lh-action)]">
              →
            </span>
          </Link>

          <div
            className="flex max-w-[520px] flex-wrap gap-[clamp(16px,2.4vw,36px)] border-t border-[var(--lh-border)] pt-[clamp(10px,1.4vw,18px)]"
            style={{
              opacity: inO,
              transition: `opacity ${0.8 * dd}s ease ${0.6 * dd}s`,
            }}
          >
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

        {/* Layered product composition — V5 geometry */}
        <div
          className="relative z-[1] min-w-0"
          style={{
            aspectRatio: isMobile ? "1 / 1" : "5 / 4",
            marginRight: isMobile ? 0 : "clamp(-24px,-2vw,-8px)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 font-[family-name:var(--font-display)] font-extrabold leading-[0.8] tracking-[-0.06em] text-transparent whitespace-nowrap"
            style={{
              top: isMobile ? "2%" : "8%",
              fontSize: isMobile ? "clamp(4rem,22vw,6rem)" : "clamp(4rem,12vw,8rem)",
              WebkitTextStroke: "1.5px rgba(33,89,212,.16)",
              transform: `translate3d(calc(-50% + ${mx * -16}px + ${hp * -60}px), ${hp * 40}px, 0)`,
              opacity: inO,
              transition: `opacity ${1.2 * dd}s ease`,
            }}
          >
            HUB
          </div>

          <div
            aria-hidden
            className="absolute left-1/2 top-[44%] aspect-square w-[94%]"
            style={{
              transform: `translate3d(calc(-50% + ${mx * -10}px), calc(-50% + ${hp * 50}px + ${my * -6}px), 0) scale(${1 + hp * 0.18})`,
            }}
          >
            <div
              className="absolute inset-0 rounded-full border-[1.5px] border-[rgba(33,89,212,.3)] shadow-[0_0_0_14px_rgba(255,255,255,.4),0_0_80px_rgba(33,89,212,.16),inset_0_0_90px_rgba(28,185,232,.12)]"
              style={{
                WebkitMaskImage: "linear-gradient(#000 30%, transparent 74%)",
                maskImage: "linear-gradient(#000 30%, transparent 74%)",
                opacity: inO,
                transform: ringT,
                transition: `opacity ${1.2 * dd}s ease ${0.1 * dd}s, transform ${1.6 * dd}s cubic-bezier(.2,.7,.2,1) ${0.1 * dd}s`,
              }}
            />
            <div className="absolute inset-0" style={{ opacity: inO, transition: `opacity ${1.4 * dd}s ease ${0.5 * dd}s` }}>
              <div
                className="absolute -inset-px rounded-full"
                style={{
                  background:
                    "conic-gradient(from 292deg, transparent 0deg, #1CB9E8 44deg, #2159D4 88deg, transparent 122deg)",
                  WebkitMaskImage: "radial-gradient(closest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px))",
                  maskImage: "radial-gradient(closest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px))",
                  transform: `rotate(${hp * 70 + mx * 8}deg)`,
                }}
              />
            </div>
            <div className="absolute inset-[16%] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,.95),rgba(255,255,255,0))]" />
          </div>

          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-[12%] -left-[12%] -right-[12%] h-[40%]"
            style={{
              background:
                "radial-gradient(50% 50% at 50% 50%, rgba(10,23,48,.32) 0%, rgba(10,23,48,.12) 42%, rgba(10,23,48,0) 72%)",
              transform: `translate3d(${mx * 6}px, 0, 0)`,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-[18%] top-[-6%] h-[78%] w-[64%]"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.8) 45%, rgba(214,230,255,0) 100%)",
              clipPath: "polygon(43% 0, 57% 0, 100% 100%, 0 100%)",
              opacity: inO,
              transition: `opacity ${1.4 * dd}s ease ${0.3 * dd}s`,
            }}
          />

          {/* Stage ellipse (CSS stand-in until scene.png rights cleared) */}
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-[1%] left-[5%] h-[12%] w-[90%] rounded-[50%]"
            style={{
              background: "radial-gradient(closest-side, rgba(10,23,48,.28), transparent 72%)",
              transform: `translate3d(${mx * 8}px, ${hp * 30}px, 0)`,
              opacity: inO,
              transition: `opacity ${1 * dd}s ease ${0.15 * dd}s`,
            }}
          />

          {sideLeft?.imageUrl ? (
            <Link
              href={`/products/${sideLeft.handle}`}
              aria-label={sideLeft.label}
              className="absolute bottom-[28%] left-[1%] z-[1] block w-[39%]"
              style={{
                transform: `translate3d(${mx * 10 + hp * -70}px, ${hp * 30 + my * 4}px, 0)`,
              }}
            >
              <span
                className="relative block aspect-[5/4] w-full"
                style={{
                  opacity: inO,
                  transform: lapInL,
                  transition: `opacity ${0.9 * dd}s ease ${0.3 * dd}s, transform ${1.1 * dd}s cubic-bezier(.2,.7,.2,1) ${0.3 * dd}s`,
                }}
              >
                <Image src={sideLeft.imageUrl} alt={sideLeft.label} fill className="object-contain" sizes="20vw" unoptimized />
              </span>
            </Link>
          ) : null}

          {sideRight?.imageUrl ? (
            <Link
              href={`/products/${sideRight.handle}`}
              aria-label={sideRight.label}
              className="absolute bottom-[29%] right-[-1%] z-[1] block w-[43%]"
              style={{
                transform: `translate3d(${mx * 12 + hp * 70}px, ${hp * 26 + my * 4}px, 0)`,
              }}
            >
              <span
                className="relative block aspect-[5/4] w-full"
                style={{
                  opacity: inO,
                  transform: lapInR,
                  transition: `opacity ${0.9 * dd}s ease ${0.38 * dd}s, transform ${1.1 * dd}s cubic-bezier(.2,.7,.2,1) ${0.38 * dd}s`,
                }}
              >
                <Image src={sideRight.imageUrl} alt={sideRight.label} fill className="object-contain" sizes="22vw" unoptimized />
              </span>
            </Link>
          ) : null}

          {main.imageUrl ? (
            <Link
              href={`/products/${main.handle}`}
              aria-label={main.label}
              className="absolute bottom-[16%] left-[18%] z-[2] block w-[64%]"
              style={{
                transform: `translate3d(${mx * 22}px, ${hp * -50 + my * 8}px, 0) scale(${1 + hp * 0.1})`,
              }}
            >
              <span
                className="relative block aspect-[5/4] w-full drop-shadow-[0_30px_30px_rgba(10,23,48,.45)]"
                style={{
                  opacity: inO,
                  transform: lapInC,
                  transition: `opacity ${0.9 * dd}s ease ${0.2 * dd}s, transform ${1.2 * dd}s cubic-bezier(.2,.7,.2,1) ${0.2 * dd}s`,
                }}
              >
                <Image src={main.imageUrl} alt={main.label} fill className="object-contain" sizes="35vw" priority unoptimized />
              </span>
            </Link>
          ) : (
            <div className="absolute inset-[8%] flex items-center justify-center rounded-[28px] bg-[var(--lh-titanium)] text-sm text-[var(--lh-ink-2)]">
              Featured product image
            </div>
          )}

          {chips.length > 0 ? (
            <div
              className="absolute z-[3] flex flex-wrap items-end justify-end gap-2"
              style={{
                top: isMobile ? "4%" : "10%",
                right: isMobile ? "2%" : "0%",
                left: isMobile ? "2%" : "auto",
                flexDirection: isMobile ? "row" : "column",
                transform: `translate3d(${mx * 30}px, ${hp * -90 + my * 12}px, 0)`,
              }}
            >
              {chips.map((ch, i) => (
                <span
                  key={ch}
                  className="inline-flex h-[34px] items-center gap-2 whitespace-nowrap rounded-full border border-white/95 bg-white/92 px-3.5 font-[family-name:var(--font-mono)] text-xs text-[var(--lh-ink)] shadow-[0_12px_30px_-14px_rgba(10,23,48,.35),inset_0_0_0_1px_rgba(33,89,212,.08)]"
                  style={{
                    opacity: inO,
                    transform: phase === "boot" ? "translate3d(24px,0,0)" : "none",
                    transition: `opacity ${0.6 * dd}s ease ${(0.6 + i * 0.1) * dd}s, transform ${0.8 * dd}s cubic-bezier(.2,.7,.2,1) ${(0.6 + i * 0.1) * dd}s`,
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--lh-electric)] shadow-[0_0_8px_var(--lh-electric)]" />
                  {ch}
                </span>
              ))}
            </div>
          ) : null}

          {main.handle && main.handle !== "all" ? (
            <Link
              href={`/products/${main.handle}`}
              className="absolute bottom-0 z-[3] flex items-center gap-3.5 rounded-[18px] border border-white/95 bg-white/94 py-2.5 pl-4 pr-3 text-[var(--lh-ink)] shadow-[0_18px_40px_-18px_rgba(10,23,48,.45)] transition hover:shadow-[0_0_0_2px_var(--lh-action),0_18px_40px_-18px_rgba(10,23,48,.45)]"
              style={{
                left: isMobile ? "4%" : "12%",
                opacity: inO,
                transition: `opacity ${0.8 * dd}s ease ${0.7 * dd}s, box-shadow .2s ease`,
              }}
            >
              <span className="flex flex-col gap-px">
                <span className="text-[13px] font-semibold">{main.label}</span>
                <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--lh-action)]">
                  {main.stockText || "In catalog"}
                </span>
              </span>
              {priceText ? (
                <span className="whitespace-nowrap font-[family-name:var(--font-display)] text-[17px] font-bold">
                  {priceText}
                </span>
              ) : null}
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-full bg-[var(--lh-action)] text-sm text-white"
              >
                →
              </span>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="relative flex min-h-[52px] items-center justify-center pb-[18px]">
        {showSkip ? (
          <button
            type="button"
            className="absolute bottom-[18px] left-[clamp(16px,4vw,56px)] h-[34px] cursor-pointer rounded-full border border-[var(--lh-border)] bg-white/80 px-3.5 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.1em] text-[var(--lh-ink-2)] hover:border-[var(--lh-action)] hover:text-[var(--lh-ink)]"
            onClick={() => setPhase("done")}
          >
            SKIP INTRO
          </button>
        ) : null}
        {!isMobile ? (
          <span
            aria-hidden
            className="flex flex-col items-center gap-2.5 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.2em] text-[var(--lh-ink-2)]"
            style={{ opacity: Math.max(0, 1 - hp * 4) }}
          >
            SCROLL
            <span className="h-8 w-px bg-[linear-gradient(var(--lh-action),transparent)]" />
          </span>
        ) : null}
      </div>
    </section>
  );
}
