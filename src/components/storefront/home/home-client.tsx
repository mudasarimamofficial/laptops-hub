"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { LHImg } from "@/components/storefront/v5/lh-img";
import { InquiryDialog } from "@/components/commerce/inquiry-dialog";
import { useCompare } from "@/lib/commerce/compare-store";

export type CbData = {
  text: string;
  countText: string;
  p: { href: string; model: string; img: string | null; alt: string; priceText: string };
};

/** Port of V5 section `#chromebooks` ("03 Chromebooks") with its scroll-linked `--cp` parallax. */
export function ChromebookSection({ cb }: { cb: CbData }) {
  const ref = useRef<HTMLElement>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const frame = () => {
      raf = 0;
      const r = c.getBoundingClientRect();
      const vh = innerHeight;
      c.style.setProperty("--cp", (mq.matches ? 0.5 : Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)))).toFixed(4));
    };
    const sched = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    addEventListener("scroll", sched, { passive: true });
    addEventListener("resize", sched);
    sched();
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", sched);
      removeEventListener("resize", sched);
    };
  }, []);

  const chip = { position: "absolute", flexDirection: "column", gap: 4, padding: "12px 14px", borderRadius: 16, background: "rgba(255,255,255,.94)", border: "1px solid #FFFFFF", boxShadow: "0 18px 40px -20px rgba(var(--lh-navy-rgb),.4)" } as const;

  return (
    <section
      id="chromebooks"
      data-screen-label="03 Chromebooks"
      ref={ref}
      aria-label="Chromebooks"
      style={{ ["--cp" as string]: 0.5, position: "relative", overflow: "hidden", isolation: "isolate", background: "linear-gradient(180deg,var(--lh-canvas) 0%,#FFFFFF 45%,var(--lh-ice) 100%)" }}
    >
      <div aria-hidden="true" style={{ position: "absolute", width: "min(720px,70vw)", aspectRatio: "1/1", top: "-18%", right: "-12%", zIndex: -1, borderRadius: "50%", background: "radial-gradient(closest-side,rgba(var(--lh-electric-rgb),.3),rgba(var(--lh-electric-rgb),0))", transform: "translate3d(0,calc((var(--cp) - .5) * -160px),0)" }} />
      <div aria-hidden="true" style={{ position: "absolute", width: "min(640px,64vw)", aspectRatio: "1/1", bottom: "-30%", left: "22%", zIndex: -1, borderRadius: "50%", background: "radial-gradient(closest-side,rgba(var(--lh-iris-rgb),.24),rgba(var(--lh-iris-rgb),0))", transform: "translate3d(0,calc((var(--cp) - .5) * 120px),0)" }} />
      <div aria-hidden="true" style={{ position: "absolute", width: "clamp(160px,18vw,260px)", height: "clamp(64px,7vw,100px)", top: "12%", left: "-3%", zIndex: -1, borderRadius: 999, background: "linear-gradient(100deg,rgba(255,255,255,.9),rgba(232,242,255,.6))", border: "1px solid #FFFFFF", boxShadow: "0 30px 60px -30px rgba(var(--lh-action-rgb),.45)", transform: "translate3d(0,calc((var(--cp) - .5) * -220px),0) rotate(calc(-14deg + var(--cp) * 18deg))" }} />
      <div aria-hidden="true" style={{ position: "absolute", width: "clamp(90px,10vw,150px)", height: "clamp(90px,10vw,150px)", bottom: "10%", right: "6%", zIndex: -1, borderRadius: 32, background: "linear-gradient(140deg,#1CB9E8,#2159D4)", opacity: 0.16, transform: "translate3d(0,calc((var(--cp) - .5) * 200px),0) rotate(calc(20deg - var(--cp) * 40deg))" }} />
      <div className="v5-cb-grid" style={{ maxWidth: 1360, margin: "0 auto", padding: "clamp(72px,9vw,128px) clamp(16px,3vw,32px) clamp(64px,8vw,112px)", display: "grid", gap: "clamp(36px,5vw,72px)", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ padding: "7px 12px", borderRadius: 999, background: "var(--lh-navy)", color: "#FFFFFF", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".14em", whiteSpace: "nowrap" }}>03 — CHROMEBOOKS</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", color: "var(--lh-ink-2)" }}>NOW LISTED</span>
          </div>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(38px,4.8vw,76px)", lineHeight: 0.98, letterSpacing: "-.05em", fontWeight: 700, color: "var(--lh-ink)", textWrap: "balance" }}>
            Chromebooks, made for <span style={{ color: "var(--lh-action)" }}>everyday speed.</span>
          </h2>
          <p style={{ margin: 0, maxWidth: "48ch", fontSize: "clamp(16px,1.2vw,18px)", lineHeight: 1.6, color: "var(--lh-ink-2)", textWrap: "pretty" }}>{cb.text}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", color: "var(--lh-action)" }}>EVERY LISTING SHOWS</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["Model", "Memory", "Storage", "Condition", "Price", "Photos"].map((f) => (
                <span key={f} style={{ height: 34, padding: "0 14px", borderRadius: 999, display: "flex", alignItems: "center", background: "rgba(255,255,255,.75)", border: "1px solid var(--lh-border)", fontSize: 13, fontWeight: 600, color: "var(--lh-ink)", whiteSpace: "nowrap" }}>
                  {f}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/collections/chromebooks" className="v5-hov-bg-action" style={{ height: 54, padding: "0 26px", borderRadius: 999, background: "var(--lh-action)", color: "#FFFFFF", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap", boxShadow: "0 16px 36px -16px rgba(var(--lh-action-rgb),.85)" }}>
              View Chromebook collection <span aria-hidden="true">→</span>
            </Link>
            <button type="button" onClick={() => setAsking(true)} className="v5-hov-bd-action" style={{ height: 54, padding: "0 24px", borderRadius: 999, border: "1px solid var(--lh-border)", background: "#FFFFFF", color: "var(--lh-ink)", fontWeight: 600, fontSize: 15, cursor: "pointer", whiteSpace: "nowrap" }}>
              Ask about Chromebooks
            </button>
          </div>
        </div>

        <div style={{ position: "relative", minWidth: 0, aspectRatio: "5/4" }}>
          <div aria-hidden="true" style={{ position: "absolute", inset: "6% 4%", borderRadius: 40, background: "linear-gradient(160deg,rgba(255,255,255,.9),rgba(232,242,255,.55))", border: "1px solid #FFFFFF", boxShadow: "0 50px 100px -50px rgba(var(--lh-action-rgb),.5),inset 0 1px 0 #FFFFFF" }} />
          <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: "44%", width: "78%", aspectRatio: "1/1", transform: "translate(-50%,-50%) rotate(calc(var(--cp) * 120deg))", borderRadius: "50%", background: "conic-gradient(from 0deg,rgba(28,185,232,0),rgba(28,185,232,.55) 60deg,rgba(33,89,212,.5) 120deg,rgba(33,89,212,0) 170deg)", WebkitMaskImage: "radial-gradient(closest-side,transparent calc(100% - 2.5px),#000 calc(100% - 2px))", maskImage: "radial-gradient(closest-side,transparent calc(100% - 2.5px),#000 calc(100% - 2px))" }} />
          <div aria-hidden="true" style={{ position: "absolute", left: "16%", right: "16%", bottom: "13%", height: "16%", borderRadius: "50%", background: "linear-gradient(180deg,#FFFFFF,var(--lh-titanium))", border: "1px solid #FFFFFF", boxShadow: "0 26px 50px -20px rgba(var(--lh-action-rgb),.45),inset 0 -8px 22px rgba(var(--lh-electric-rgb),.3)" }} />
          <div style={{ position: "absolute", left: "22%", right: "22%", top: "14%", height: "46%", transform: "translate3d(0,calc((.5 - var(--cp)) * 50px),0)" }}>
            <Link href={cb.p.href} aria-label={cb.p.model} style={{ position: "absolute", inset: "-18% -14% -30%", display: "block" }}>
              <LHImg src={cb.p.img} alt={cb.p.alt} pad="0" blend="multiply" />
            </Link>
          </div>
          <div className="v5-cb-chip" style={{ ...chip, left: 0, top: "10%", transform: "translate3d(0,calc((var(--cp) - .5) * -70px),0)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".12em", color: "var(--lh-action)" }}>NOW LISTED</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--lh-ink)" }}>{cb.p.model}</span>
          </div>
          <div className="v5-cb-chip" style={{ ...chip, right: 0, bottom: "30%", transform: "translate3d(0,calc((var(--cp) - .5) * 60px),0)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".12em", color: "var(--lh-action)" }}>PRICE</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--lh-ink)" }}>{cb.p.priceText}</span>
          </div>
          <span style={{ position: "absolute", left: "50%", bottom: "2%", transform: "translateX(-50%)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".14em", color: "var(--lh-ink-2)", whiteSpace: "nowrap" }}>{cb.countText}</span>
        </div>
      </div>
      <InquiryDialog open={asking} onClose={() => setAsking(false)} productTitle="Chromebooks: tell us the model, budget or specs you need" productHandle="chromebooks" />
    </section>
  );
}

/** V5 "08 — Newer generations" scroll-snap row with prev/next buttons (±600px). */
export function NewGenRow({ count, children }: { count: number; children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const btn = { width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--lh-border)", background: "#FFFFFF", cursor: "pointer", display: "grid", placeItems: "center" } as const;
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".12em", color: "var(--lh-ink-2)" }}>
            <span style={{ width: 12, height: 2, background: "var(--lh-signal)" }} />
            08 — NEWER GENERATIONS
          </span>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(28px,3vw,44px)", letterSpacing: "-.035em", fontWeight: 700 }}>10th gen and newer</h2>
          <span style={{ fontSize: 16, color: "var(--lh-ink-2)" }}>Intel Core 10th, 11th, 12th and 13th generation models.</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/collections/gen-10-plus" className="v5-hov-color-action" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontWeight: 600, fontSize: 15, color: "var(--lh-action)", marginRight: 6, whiteSpace: "nowrap" }}>
            <span>View all {count} →</span>
          </Link>
          <button type="button" aria-label="Scroll left" className="v5-hov-bd-action" style={btn} onClick={() => row.current?.scrollBy({ left: -600 })}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#102039" strokeWidth="2" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <button type="button" aria-label="Scroll right" className="v5-hov-bd-action" style={btn} onClick={() => row.current?.scrollBy({ left: 600 })}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#102039" strokeWidth="2" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
      <div ref={row} className="v5-row" style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(270px,290px)", gap: 18, overflowX: "auto", scrollSnapType: "x mandatory", scrollBehavior: "smooth", padding: "6px 2px 12px", scrollbarWidth: "thin", scrollbarColor: "var(--lh-action) transparent" }}>
        {children}
      </div>
    </>
  );
}

/** Live compare count for V5 copy such as "Open compare (n)". */
export function CompareCount() {
  return <>{useCompare((s) => s.handles.length)}</>;
}
