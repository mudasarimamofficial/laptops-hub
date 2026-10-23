"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCompare } from "@/lib/commerce/compare-store";

/** One hero laptop: V5 cutout when approved media is configured, otherwise the catalog photo (multiply blend). */
export type HeroShot = { href: string; label: string; src: string | null; cutout: boolean };

export type HeroProps = {
  totalCount: number;
  laptopCount: number;
  accCount: number;
  main: HeroShot & { priceText: string; stockText: string; chips: string[] };
  side1: HeroShot | null;
  side2: HeroShot | null;
};

function usePrefersReducedMotion() {
  const [rm, setRm] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setRm(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return rm;
}

const ease = "cubic-bezier(.2,.7,.2,1)";

/** Port of V5 section `#top` ("01 Hero"): layered stage, scroll (--hp) and pointer (--mx/--my) parallax, intro. */
export function CinematicHero({ totalCount, laptopCount, accCount, main, side1, side2 }: HeroProps) {
  const rm = usePrefersReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [entered, setEntered] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [skip, setSkip] = useState(false);
  const compareCount = useCompare((s) => s.handles.length);

  // V5 componentDidMount: entered after 80ms (0 with reduced motion), intro finished after 2.6s.
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const enterT = window.setTimeout(() => setEntered(true), mq.matches ? 0 : 80);
    const introT = window.setTimeout(() => setIntroDone(true), 2600);
    return () => {
      window.clearTimeout(enterT);
      window.clearTimeout(introT);
    };
  }, []);

  // V5 frame(): --hp from scroll, eased pointer --mx/--my.
  useEffect(() => {
    const h = ref.current;
    if (!h) return;
    const pt = { x: 0, y: 0 };
    const pc = { x: 0, y: 0 };
    let raf = 0;
    const frame = () => {
      raf = 0;
      const r = h.getBoundingClientRect();
      const hp = rm ? 0 : Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
      pc.x += (pt.x - pc.x) * 0.12;
      pc.y += (pt.y - pc.y) * 0.12;
      h.style.setProperty("--hp", hp.toFixed(4));
      h.style.setProperty("--mx", (rm ? 0 : pc.x).toFixed(4));
      h.style.setProperty("--my", (rm ? 0 : pc.y).toFixed(4));
      if (Math.abs(pt.x - pc.x) > 0.002 || Math.abs(pt.y - pc.y) > 0.002) sched();
    };
    const sched = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const onMove = (e: MouseEvent) => {
      if (rm || innerWidth < 760) return;
      const r = h.getBoundingClientRect();
      pt.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pt.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      sched();
    };
    const onLeave = () => {
      pt.x = 0;
      pt.y = 0;
      sched();
    };
    h.addEventListener("mousemove", onMove);
    h.addEventListener("mouseleave", onLeave);
    addEventListener("scroll", sched, { passive: true });
    addEventListener("resize", sched);
    sched();
    return () => {
      cancelAnimationFrame(raf);
      h.removeEventListener("mousemove", onMove);
      h.removeEventListener("mouseleave", onLeave);
      removeEventListener("scroll", sched);
      removeEventListener("resize", sched);
    };
  }, [rm]);

  const inn = entered || skip;
  const dd = skip || rm ? "0" : "1";
  const inT = inn ? "none" : "translate3d(0,28px,0)";
  const ringT = inn ? "scale(1)" : "scale(.86)";
  const lapInC = inn ? "none" : "translate3d(0,60px,0) scale(.94)";
  const lapInL = inn ? "none" : "translate3d(-60px,30px,0)";
  const lapInR = inn ? "none" : "translate3d(60px,30px,0)";
  const sweepT = inn && !rm ? "translateX(190%)" : "translateX(-110%)";
  const showSkip = !introDone && !skip && !rm;
  const tr = (props: [string, number, number, boolean?][]) =>
    props.map(([p, d, delay, eased]) => `${p} calc(var(--dd) * ${d}s) ${eased ? ease : "ease"} calc(var(--dd) * ${delay}s)`).join(",");
  // Catalog photos have white backgrounds: multiply them into the stage. The blend must sit on the transformed link,
  // because its transform creates the stacking context the image would otherwise blend inside.
  const blend = (s: HeroShot) => (s.cutout ? undefined : ("multiply" as const));

  return (
    <section
      id="top"
      data-screen-label="01 Hero"
      ref={ref}
      className="v5-hero"
      style={{ ["--hp" as string]: 0, ["--mx" as string]: 0, ["--my" as string]: 0, ["--dd" as string]: dd, position: "relative", overflow: "hidden", isolation: "isolate", background: "var(--lh-canvas)", color: "var(--lh-ink)", display: "flex", flexDirection: "column" }}
    >
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: -5, background: "radial-gradient(42% 58% at 72% 60%,rgba(33,89,212,.17),rgba(33,89,212,0) 70%),radial-gradient(26% 32% at 80% 26%,rgba(28,185,232,.12),transparent 70%),linear-gradient(180deg,rgba(255,255,255,0) 72%,rgba(223,234,247,.95) 100%),linear-gradient(118deg,#F6F9FE 0%,#FFFFFF 34%,#E4EDF8 50%,#F8FBFF 58%,#EAF2FC 100%)" }} />
      <div aria-hidden="true" style={{ position: "absolute", right: "-6%", top: "-30%", width: "60%", height: "160%", zIndex: -4, background: "linear-gradient(100deg,transparent 0%,rgba(255,255,255,.85) 46%,transparent 54%)", transform: "rotate(8deg) translate3d(calc(var(--mx) * -20px),0,0)" }} />
      <div aria-hidden="true" style={{ position: "absolute", inset: -40, zIndex: -5, backgroundImage: "radial-gradient(rgba(var(--lh-action-rgb),.2) 1px,transparent 1.4px)", backgroundSize: "26px 26px", WebkitMaskImage: "radial-gradient(48% 55% at 72% 50%,#000,transparent 78%)", maskImage: "radial-gradient(48% 55% at 72% 50%,#000,transparent 78%)", transform: "translate3d(calc(var(--mx) * -8px),calc(var(--hp) * 70px),0)" }} />
      <div aria-hidden="true" style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "60%", zIndex: 4, pointerEvents: "none", background: "linear-gradient(100deg,transparent 0%,rgba(255,255,255,.55) 48%,transparent 62%)", transform: sweepT, transition: `transform calc(var(--dd) * 1.9s) ${ease} calc(var(--dd) * 0.35s)` }} />
      <div className="v5-hero-grid" style={{ flex: 1, width: "100%", maxWidth: 1440, margin: "0 auto", display: "grid", gap: "clamp(8px,2vw,32px)", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(18px,2vw,26px)", minWidth: 0, position: "relative", zIndex: 3, opacity: "calc(1 - var(--hp) * 1.5)", transform: "translate3d(0,calc(var(--hp) * -80px),0)" }}>
          <span style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 12, fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".2em", color: "var(--lh-ink)", whiteSpace: "nowrap", opacity: 1, transform: inT, transition: tr([["opacity", 0.6, 0.05], ["transform", 0.7, 0.05, true]]) }}>
            <span style={{ width: 12, height: 2, background: "var(--lh-signal)" }} />
            DELL · HP · LENOVO
          </span>
          <h1 className="v5-hero-h1" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, lineHeight: 0.98, letterSpacing: "-.05em", color: "var(--lh-ink)", opacity: 1, transform: inT, transition: tr([["opacity", 0.7, 0.15], ["transform", 0.8, 0.15, true]]) }}>
            <span style={{ display: "block" }}>The future of</span>
            <span style={{ display: "block", color: "var(--lh-action)" }}>smarter laptop</span>
            <span style={{ display: "block" }}>shopping.</span>
          </h1>
          <p style={{ margin: 0, maxWidth: "42ch", fontSize: "clamp(16px,1.2vw,19px)", lineHeight: 1.55, color: "var(--lh-ink-2)", textWrap: "pretty", opacity: 1, transform: inT, transition: tr([["opacity", 0.7, 0.28], ["transform", 0.8, 0.28, true]]) }}>
            Laptops from Dell, HP, Lenovo and more, with the processor, memory, storage and display listed on every page. Filter by spec, then compare up to four side by side.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", opacity: 1, transform: inT, transition: tr([["opacity", 0.7, 0.4], ["transform", 0.8, 0.4, true]]) }}>
            <Link
              href="/collections/all"
              className="v5-hov-cta"
              style={{ position: "relative", overflow: "hidden", height: 56, padding: "0 28px", borderRadius: 14, background: "var(--lh-grad-action)", color: "#FFFFFF", fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 12, whiteSpace: "nowrap", boxShadow: "0 18px 40px -16px rgba(var(--lh-action-rgb),.85),inset 0 1px 0 rgba(255,255,255,.35)", transition: "transform .2s ease,box-shadow .2s ease" }}
            >
              Shop laptops <span aria-hidden="true">→</span>
            </Link>
            <a href="#brands" className="v5-hov-bd-action" style={{ height: 56, padding: "0 24px", borderRadius: 14, border: "1px solid var(--lh-border)", background: "rgba(255,255,255,.75)", color: "var(--lh-ink)", fontWeight: 600, fontSize: 16, display: "flex", alignItems: "center", whiteSpace: "nowrap", transition: "border-color .2s ease" }}>
              Explore categories
            </a>
            <Link href="/compare" className="v5-hov-color-action" style={{ height: 56, padding: "0 10px", color: "var(--lh-action)", fontWeight: 600, fontSize: 16, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              Compare <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--lh-ink-2)" }}>({compareCount})</span>
            </Link>
          </div>
          <a
            href="#chromebooks"
            className="v5-hov-bd-electric"
            style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 10, minHeight: 42, padding: "5px 14px 5px 5px", borderRadius: 999, background: "rgba(255,255,255,.92)", border: "1px solid var(--lh-border)", color: "var(--lh-ink)", fontSize: 14, fontWeight: 600, opacity: 1, transform: inT, transition: tr([["opacity", 0.8, 0.4], ["transform", 0.8, 0.4, true]]) + ",border-color .2s ease" }}
          >
            <span style={{ padding: "6px 10px", borderRadius: 999, background: "var(--lh-navy)", color: "#FFFFFF", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, letterSpacing: ".12em", whiteSpace: "nowrap" }}>CHROMEBOOKS</span>
            Collection in preparation
            <span aria-hidden="true" style={{ color: "var(--lh-action)" }}>→</span>
          </a>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(16px,2.4vw,36px)", paddingTop: "clamp(10px,1.4vw,18px)", borderTop: "1px solid var(--lh-border)", maxWidth: 520, opacity: 1, transition: tr([["opacity", 0.8, 0.6]]) }}>
            <Link href="/collections/all" style={{ display: "flex", flexDirection: "column", gap: 2, color: "var(--lh-ink)" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700 }}>{totalCount}</span>
              <span style={{ fontSize: 13, color: "var(--lh-ink-2)" }}>listings</span>
            </Link>
            <Link href="/collections/laptops" style={{ display: "flex", flexDirection: "column", gap: 2, color: "var(--lh-ink)" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--lh-success)" }}>{laptopCount}</span>
              <span style={{ fontSize: 13, color: "var(--lh-ink-2)" }}>laptops</span>
            </Link>
            <Link href="/collections/accessories" style={{ display: "flex", flexDirection: "column", gap: 2, color: "var(--lh-ink)" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700 }}>{accCount}</span>
              <span style={{ fontSize: 13, color: "var(--lh-ink-2)" }}>accessories</span>
            </Link>
          </div>
        </div>

        <div className="v5-hero-comp" style={{ position: "relative", minWidth: 0, zIndex: 1 }}>
          <div aria-hidden="true" className="v5-hero-ghost" style={{ position: "absolute", left: "50%", fontFamily: "var(--font-display)", fontWeight: 800, lineHeight: 0.8, letterSpacing: "-.06em", color: "transparent", WebkitTextStroke: "1.5px rgba(var(--lh-action-rgb),.16)", whiteSpace: "nowrap", transform: "translate3d(calc(-50% + var(--mx) * -16px + var(--hp) * -60px),calc(var(--hp) * 40px),0)", opacity: 1, transition: tr([["opacity", 1.2, 0]]) }}>
            HUB
          </div>
          <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: "44%", width: "94%", aspectRatio: "1/1", transform: "translate3d(calc(-50% + var(--mx) * -10px),calc(-50% + var(--hp) * 50px + var(--my) * -6px),0) scale(calc(1 + var(--hp) * .18))" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid rgba(var(--lh-action-rgb),.3)", boxShadow: "0 0 0 14px rgba(255,255,255,.4),0 0 80px rgba(33,89,212,.16),inset 0 0 90px rgba(28,185,232,.12)", WebkitMaskImage: "linear-gradient(#000 30%,transparent 74%)", maskImage: "linear-gradient(#000 30%,transparent 74%)", opacity: 1, transform: ringT, transition: tr([["opacity", 1.2, 0.1], ["transform", 1.6, 0.1, true]]) }} />
            <div style={{ position: "absolute", inset: 0, opacity: 1, transition: tr([["opacity", 1.4, 0.5]]) }}>
              <div style={{ position: "absolute", inset: -1, borderRadius: "50%", background: "conic-gradient(from 292deg,transparent 0deg,#1CB9E8 44deg,#2159D4 88deg,transparent 122deg)", WebkitMaskImage: "radial-gradient(closest-side,transparent calc(100% - 3px),#000 calc(100% - 2.5px))", maskImage: "radial-gradient(closest-side,transparent calc(100% - 3px),#000 calc(100% - 2.5px))", transform: "rotate(calc(var(--hp) * 70deg + var(--mx) * 8deg))" }} />
            </div>
            <div style={{ position: "absolute", inset: "16%", borderRadius: "50%", background: "radial-gradient(closest-side,rgba(255,255,255,.95),rgba(255,255,255,0))" }} />
          </div>
          <div aria-hidden="true" style={{ position: "absolute", left: "-12%", right: "-12%", bottom: "-12%", height: "40%", background: "radial-gradient(50% 50% at 50% 50%,rgba(var(--lh-navy-rgb),.32) 0%,rgba(var(--lh-navy-rgb),.12) 42%,rgba(var(--lh-navy-rgb),0) 72%)", transform: "translate3d(calc(var(--mx) * 6px),0,0)" }} />
          <div aria-hidden="true" style={{ position: "absolute", left: "18%", width: "64%", top: "-6%", height: "78%", background: "linear-gradient(180deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.8) 45%,rgba(214,230,255,0) 100%)", clipPath: "polygon(43% 0,57% 0,100% 100%,0 100%)", opacity: 1, transition: tr([["opacity", 1.4, 0.3]]) }} />
          {/* eslint-disable-next-line @next/next/no-img-element -- V5 layered stage, positioned by percentage */}
          <img src="/v5/stage.webp" alt="" aria-hidden="true" width={1800} height={520} style={{ position: "absolute", left: "5%", width: "90%", height: "auto", bottom: "1%", transform: "translate3d(calc(var(--mx) * 8px),calc(var(--hp) * 30px),0)", opacity: 1, transition: tr([["opacity", 1, 0.15]]) }} />
          {side1 ? (
            <Link href={side1.href} aria-label={side1.label} style={{ position: "absolute", left: "1%", bottom: "28%", width: "39%", display: "block", mixBlendMode: blend(side1), transform: "translate3d(calc(var(--mx) * 10px + var(--hp) * -70px),calc(var(--hp) * 30px + var(--my) * 4px),0)", zIndex: 1 }}>
              {side1.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={side1.src} alt={side1.label} fetchPriority="high" style={{ display: "block", width: "100%", opacity: 1, transform: lapInL, transition: tr([["opacity", 0.9, 0.3], ["transform", 1.1, 0.3, true]]) }} />
              ) : null}
            </Link>
          ) : null}
          {side2 ? (
            <Link href={side2.href} aria-label={side2.label} style={{ position: "absolute", right: "-1%", bottom: "29%", width: "43%", display: "block", mixBlendMode: blend(side2), transform: "translate3d(calc(var(--mx) * 12px + var(--hp) * 70px),calc(var(--hp) * 26px + var(--my) * 4px),0)", zIndex: 1 }}>
              {side2.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={side2.src} alt={side2.label} fetchPriority="high" style={{ display: "block", width: "100%", opacity: 1, transform: lapInR, transition: tr([["opacity", 0.9, 0.38], ["transform", 1.1, 0.38, true]]) }} />
              ) : null}
            </Link>
          ) : null}
          <Link href={main.href} aria-label={main.label} style={{ position: "absolute", left: "18%", bottom: "16%", width: "64%", display: "block", mixBlendMode: blend(main), transform: "translate3d(calc(var(--mx) * 22px),calc(var(--hp) * -50px + var(--my) * 8px),0) scale(calc(1 + var(--hp) * .1))", zIndex: 2 }}>
            {main.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={main.src} alt={main.label} fetchPriority="high" style={{ display: "block", width: "100%", filter: main.cutout ? "drop-shadow(0 30px 30px rgba(var(--lh-navy-rgb),.45))" : undefined, opacity: 1, transform: lapInC, transition: tr([["opacity", 0.9, 0.2], ["transform", 1.2, 0.2, true]]) }} />
            ) : null}
          </Link>
          <div className="v5-hero-chips" style={{ position: "absolute", zIndex: 3, display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, alignItems: "flex-end", transform: "translate3d(calc(var(--mx) * 30px),calc(var(--hp) * -90px + var(--my) * 12px),0)" }}>
            {main.chips.map((c, i) => {
              const d = (0.6 + i * 0.1).toFixed(2);
              return (
                <span key={c} style={{ display: "flex", alignItems: "center", gap: 8, height: 34, padding: "0 14px", borderRadius: 999, background: "rgba(255,255,255,.92)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 12px 30px -14px rgba(var(--lh-navy-rgb),.35),inset 0 0 0 1px rgba(var(--lh-action-rgb),.08)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--lh-ink)", whiteSpace: "nowrap", opacity: 1, transform: inn ? "none" : "translate3d(24px,0,0)", transition: `opacity calc(var(--dd) * .6s) ease calc(var(--dd) * ${d}s),transform calc(var(--dd) * .8s) ${ease} calc(var(--dd) * ${d}s)` }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--lh-electric)", boxShadow: "0 0 8px var(--lh-electric)" }} />
                  {c}
                </span>
              );
            })}
          </div>
          <Link
            href={main.href}
            className="v5-hero-tag v5-hov-tag"
            style={{ position: "absolute", bottom: 0, zIndex: 3, display: "flex", alignItems: "center", gap: 14, padding: "10px 12px 10px 16px", borderRadius: 18, background: "rgba(255,255,255,.94)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 18px 40px -18px rgba(var(--lh-navy-rgb),.45)", color: "var(--lh-ink)", opacity: 1, transition: tr([["opacity", 0.8, 0.7]]) + ",box-shadow .2s ease" }}
          >
            <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{main.label}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--lh-action)" }}>{main.stockText}</span>
            </span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, whiteSpace: "nowrap" }}>{main.priceText}</span>
            <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--lh-action)", color: "#FFFFFF", fontSize: 14 }}>→</span>
          </Link>
        </div>
      </div>
      <div className="v5-hero-cue-row" style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", paddingBottom: 18 }}>
        {showSkip ? (
          <button
            type="button"
            onClick={() => {
              setSkip(true);
              setEntered(true);
              setIntroDone(true);
            }}
            className="v5-hov-bd-action"
            style={{ position: "absolute", left: "clamp(16px,4vw,56px)", bottom: 18, height: 34, padding: "0 14px", borderRadius: 999, border: "1px solid var(--lh-border)", background: "rgba(255,255,255,.8)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", color: "var(--lh-ink-2)", cursor: "pointer" }}
          >
            SKIP INTRO
          </button>
        ) : null}
        <span aria-hidden="true" className="v5-hero-cue" style={{ flexDirection: "column", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".2em", color: "var(--lh-ink-2)", opacity: "calc(1 - var(--hp) * 4)" }}>
          SCROLL
          <span style={{ width: 1, height: 32, background: "linear-gradient(var(--lh-action),transparent)" }} />
        </span>
      </div>
    </section>
  );
}
