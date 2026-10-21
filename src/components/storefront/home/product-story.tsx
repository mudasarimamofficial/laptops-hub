"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatPkr } from "@/lib/money";
import { useCart } from "@/lib/commerce/cart-store";

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

const ANGLE_LABELS = ["Front", "Left", "Right", "Rear"];

const STEPS = [
  { n: "01", label: "Look" },
  { n: "02", label: "Spec" },
  { n: "03", label: "Fit" },
  { n: "04", label: "Buy" },
];

type Props = {
  handle: string;
  title: string;
  model: string;
  config: string;
  pricePaisa: number;
  variantId: string;
  /** Variant max_per_order, carried into the cart line so the cart enforces the same limit as the server. */
  maxPerOrder?: number;
  specs: { k: string; v: string }[];
  /** Catalog / CDN images only — never unverified cutout assets from the public repo. */
  images: { src: string; alt: string }[];
};

export function ProductStory({ handle, title, model, config, pricePaisa, variantId, maxPerOrder, specs, images }: Props) {
  const angles = (images.length ? images : [{ src: "", alt: title }])
    .slice(0, 4)
    .map((img, i) => ({
      src: img.src,
      alt: img.alt || `${title}, ${ANGLE_LABELS[i] || "view"}`,
      label: ANGLE_LABELS[i] || `View ${i + 1}`,
    }));
  while (angles.length < 4 && angles[0]?.src) {
    angles.push({ ...angles[angles.length % Math.max(images.length, 1)], label: ANGLE_LABELS[angles.length] || "View" });
  }
  const root = useRef<HTMLElement>(null);
  const [sp, setSp] = useState(0);
  const reduced = usePrefersReducedMotion();
  const add = useCart((s) => s.add);
  const chapter = Math.min(3, Math.floor(sp * 4));

  useEffect(() => {
    if (reduced) return;
    const el = root.current;
    if (!el) return;
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      setSp(scrolled / Math.max(total, 1));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduced]);

  function goChapter(i: number) {
    const el = root.current;
    if (!el) return;
    if (reduced) {
      setSp((i + 0.5) / 4);
      return;
    }
    const total = el.offsetHeight - window.innerHeight;
    const y = el.offsetTop + (total * (i + 0.15)) / 4;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  const opacities = [0, 1, 2, 3].map((i) => {
    if (reduced) return i === chapter ? 1 : 0.15;
    const center = (i + 0.5) / 4;
    return Math.max(0, 1 - Math.abs(sp - center) * 5);
  });

  return (
    <section
      ref={root}
      id="story"
      aria-label={`Find your next machine: ${model}`}
      className="relative bg-[var(--lh-canvas)]"
      style={{ height: reduced ? "auto" : "320vh" }}
    >
      <div className={`top-[72px] ${reduced ? "relative" : "sticky"} h-[min(calc(100vh-72px),820px)] min-h-[560px]`}>
        <div className="relative flex h-full flex-col justify-center overflow-hidden bg-[var(--lh-navy)] text-white isolation-isolate">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-[3]"
            style={{
              background:
                "radial-gradient(60% 55% at 30% 80%, rgba(33,89,212,.5), transparent 70%), linear-gradient(#0A1730,#0A1730)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 top-[18%] -z-[2] whitespace-nowrap font-[family-name:var(--font-display)] text-[clamp(5rem,16vw,16rem)] font-bold leading-none tracking-[-0.05em] text-transparent"
            style={{
              WebkitTextStroke: "1px rgba(150,185,235,.12)",
              transform: `translate3d(calc(10vw - ${sp * 70}vw), -50%, 0)`,
            }}
          >
            LATITUDE 7420
          </div>

          <div className="lh-container relative grid h-full max-h-[820px] grid-cols-1 items-stretch gap-6 py-8 lg:grid-cols-2 lg:gap-10 lg:py-10">
            <div className="flex min-h-0 min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2.5 font-[family-name:var(--font-mono)] text-xs tracking-[0.14em] text-white/70">
                  <span className="h-0.5 w-3 bg-[var(--lh-signal)]" />
                  02 — PRODUCT STORY
                </span>
                <span className="font-[family-name:var(--font-mono)] text-xs text-white/70">{angles[chapter]?.label} view</span>
              </div>
              <div className="relative min-h-[220px] flex-1 perspective-[1400px]">
                <div className="absolute inset-0">
                  {angles.map((a, i) =>
                    a.src ? (
                      <Image
                        key={`${a.src}-${i}`}
                        src={a.src}
                        alt={a.alt}
                        fill
                        className="object-contain p-[4%] transition-opacity duration-300"
                        style={{ opacity: opacities[i] }}
                        sizes="(max-width:1024px) 90vw, 45vw"
                        priority={i === 0}
                        unoptimized
                      />
                    ) : null,
                  )}
                </div>
              </div>
              {reduced ? (
                <div className="grid grid-cols-4 gap-2">
                  {angles.map((a, i) => (
                    <button
                      key={`${a.label}-${i}`}
                      type="button"
                      onClick={() => goChapter(i)}
                      className="rounded-xl border border-white/15 bg-white/5 p-2"
                      aria-pressed={chapter === i}
                    >
                      {a.src ? (
                        <Image src={a.src} alt="" width={120} height={75} className="mx-auto h-auto w-full object-contain" unoptimized />
                      ) : null}
                      <span className="mt-1 block text-center font-[family-name:var(--font-mono)] text-[11px] text-white/70">
                        {a.label}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="relative h-0.5 rounded bg-white/15">
                <div
                  className="absolute inset-y-0 left-0 rounded bg-[linear-gradient(90deg,var(--lh-action),var(--lh-electric))]"
                  style={{ width: `${Math.max(sp, reduced ? (chapter + 1) / 4 : sp) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex min-h-0 min-w-0 flex-col justify-center gap-4 overflow-auto py-1">
              <div>
                <h2 className="m-0 font-[family-name:var(--font-display)] text-[clamp(1.75rem,3.2vw,2.75rem)] font-bold leading-none tracking-[-0.045em]">
                  Find your next machine.
                </h2>
                <p className="mt-2 text-[clamp(0.95rem,1.1vw,1.05rem)] text-white/70">
                  {model} · {config}
                </p>
              </div>
              <div role="group" aria-label="Story chapters" className="grid grid-cols-4 gap-1.5">
                {STEPS.map((s, i) => {
                  const on = chapter === i;
                  return (
                    <button
                      key={s.n}
                      type="button"
                      onClick={() => goChapter(i)}
                      aria-pressed={on}
                      className="flex min-h-11 flex-col items-start justify-center gap-0.5 rounded-xl px-2 py-1.5 text-left transition"
                      style={{
                        border: `1px solid ${on ? "rgba(28,185,232,.55)" : "rgba(150,185,235,.2)"}`,
                        background: on ? "rgba(33,89,212,.35)" : "rgba(255,255,255,.04)",
                        color: on ? "#fff" : "rgba(255,255,255,.75)",
                      }}
                    >
                      <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.1em]">{s.n}</span>
                      <span className="text-[13px] font-semibold">{s.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {specs.slice(0, 4).map((r) => (
                  <div
                    key={r.k}
                    className="flex flex-col gap-1.5 rounded-[14px] border border-white/15 bg-white/5 p-3"
                  >
                    <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.14em] text-[var(--lh-electric)]">
                      {r.k}
                    </span>
                    <span className="text-[clamp(0.875rem,1.05vw,1rem)] font-semibold leading-snug">{r.v}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/25 bg-[linear-gradient(100deg,rgba(33,89,212,.3),rgba(101,116,213,.24))] px-4 py-3">
                <span className="flex flex-col gap-0.5">
                  <span className="font-[family-name:var(--font-display)] text-2xl font-bold">{formatPkr(pricePaisa)}</span>
                  <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--lh-electric-text,#8FDDF5)]">
                    Cash on delivery
                  </span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <Link
                    href={`/products/${handle}`}
                    className="inline-flex h-[46px] items-center rounded-full border border-white/30 px-[18px] text-sm font-semibold text-white"
                  >
                    Details
                  </Link>
                  <button
                    type="button"
                    className="inline-flex h-[46px] items-center rounded-full bg-white px-5 text-sm font-bold text-[var(--lh-ink)]"
                    onClick={() =>
                      add({
                        variantId,
                        handle,
                        title,
                        unitPricePaisa: pricePaisa,
                        quantity: 1,
                        maxPerOrder,
                      })
                    }
                  >
                    Add to cart
                  </button>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
