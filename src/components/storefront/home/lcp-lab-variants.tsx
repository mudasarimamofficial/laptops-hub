"use client";

/**
 * Isolated LCP experiment surfaces. Not used by production homepage.
 * Modes map to the scientific matrix in docs/LCP_ROOT_CAUSE_ISOLATION_2026-11-23.md
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const MAIN_IMG =
  "https://cdn.shopify.com/s/files/1/4720/5393/files/01-main_75861162-94ba-4fe0-b055-5747c932a9e1.jpg?v=1792270142&width=800";

const ease = "cubic-bezier(.2,.7,.2,1)";

function Shell({ children, note }: { children: ReactNode; note: string }) {
  return (
    <main style={{ minHeight: "100vh", background: "#F6F9FE", color: "#102039", padding: 24 }}>
      <p style={{ fontFamily: "monospace", fontSize: 12, marginBottom: 16, opacity: 0.7 }}>{note}</p>
      {children}
    </main>
  );
}

/** A — Minimal static H1 + image, system fonts, no V5 chrome. */
export function ModeA() {
  return (
    <Shell note="Mode A: minimal static H1 + IMG, system fonts">
      <h1 style={{ fontSize: 48, fontWeight: 700, lineHeight: 1, margin: "0 0 24px", maxWidth: 420 }}>
        The future of smarter laptop shopping.
      </h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MAIN_IMG} alt="Dell laptop" width={640} height={512} fetchPriority="high" decoding="async" style={{ width: "70%", maxWidth: 420, height: "auto", display: "block" }} />
    </Shell>
  );
}

/** A-font — same as A but display font variable. */
export function ModeAFont() {
  return (
    <Shell note="Mode A-font: minimal + var(--font-display)">
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 48, fontWeight: 700, lineHeight: 1, margin: "0 0 24px", maxWidth: 420 }}>
        The future of smarter laptop shopping.
      </h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MAIN_IMG} alt="Dell laptop" width={640} height={512} fetchPriority="high" decoding="async" style={{ width: "70%", maxWidth: 420, height: "auto", display: "block" }} />
    </Shell>
  );
}

/** B — Homepage-like copy + image, no cinematic effects. */
export function ModeB() {
  return (
    <Shell note="Mode B: homepage content, no cinematic hero effects">
      <div style={{ display: "grid", gap: 24, maxWidth: 960 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(36px,10vw,48px)", fontWeight: 700, lineHeight: 0.98, letterSpacing: "-.05em", margin: 0 }}>
          <span style={{ display: "block" }}>The future of</span>
          <span style={{ display: "block", color: "#2159D4" }}>smarter laptop</span>
          <span style={{ display: "block" }}>shopping.</span>
        </h1>
        <p style={{ margin: 0, maxWidth: "42ch", fontSize: 17, lineHeight: 1.55 }}>
          Laptops from Dell, HP, Lenovo and more, with the processor, memory, storage and display listed on every page.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MAIN_IMG} alt="Featured laptop" width={640} height={512} fetchPriority="high" decoding="async" style={{ width: "100%", maxWidth: 520, height: "auto" }} />
      </div>
    </Shell>
  );
}

type HeroFlags = {
  decorative?: boolean;
  transformIntro?: boolean;
  blend?: boolean;
  isolation?: boolean;
  introMachine?: boolean;
  parallax?: boolean;
  calcOpacity?: boolean;
  note: string;
};

function HeroShell({ flags }: { flags: HeroFlags }) {
  const rm = false;
  const ref = useRef<HTMLElement>(null);
  const [entered, setEntered] = useState(!flags.introMachine && !flags.transformIntro);
  const [introDone, setIntroDone] = useState(!flags.introMachine && !flags.calcOpacity && !flags.blend);

  useEffect(() => {
    if (!flags.introMachine && !flags.transformIntro) return;
    const enterT = window.setTimeout(() => setEntered(true), 80);
    const introT = window.setTimeout(() => setIntroDone(true), 2600);
    return () => {
      window.clearTimeout(enterT);
      window.clearTimeout(introT);
    };
  }, [flags.introMachine, flags.transformIntro]);

  useEffect(() => {
    if (!flags.parallax) return;
    if (!introDone) return;
    const h = ref.current;
    if (!h) return;
    let raf = 0;
    const frame = () => {
      raf = 0;
      const r = h.getBoundingClientRect();
      const hp = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
      h.style.setProperty("--hp", hp.toFixed(4));
    };
    const sched = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    addEventListener("scroll", sched, { passive: true });
    sched();
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", sched);
    };
  }, [flags.parallax, introDone]);

  const inn = entered;
  const inT = inn || !flags.transformIntro ? "none" : "translate3d(0,28px,0)";
  const lapIn = inn || !flags.transformIntro ? "none" : "translate3d(0,30px,0)";
  const tr = (props: [string, number, number][]) =>
    props.map(([p, d, delay]) => `${p} ${d}s ${ease} ${delay}s`).join(",");

  const textColStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    minWidth: 0,
    zIndex: 3,
    opacity: flags.calcOpacity && introDone ? "calc(1 - var(--hp, 0) * 1.5)" : 1,
    transform: flags.calcOpacity && introDone ? "translate3d(0,calc(var(--hp, 0) * -80px),0)" : "none",
  };

  return (
    <Shell note={flags.note}>
      <section
        ref={ref}
        className="v5-hero"
        style={{
          ["--hp" as string]: 0,
          ["--mx" as string]: 0,
          ["--my" as string]: 0,
          position: "relative",
          overflow: flags.isolation && introDone ? "hidden" : "visible",
          isolation: flags.isolation && introDone ? "isolate" : "auto",
          background: "#F6F9FE",
          display: "flex",
          flexDirection: "column",
          minHeight: 640,
        }}
      >
        {flags.decorative ? (
          <>
            <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: -5, background: "radial-gradient(42% 58% at 72% 60%,rgba(33,89,212,.17),transparent 70%)" }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/v5/stage-960.webp"
              srcSet="/v5/stage-640.webp 640w, /v5/stage-960.webp 960w"
              sizes="340px"
              alt=""
              width={960}
              height={277}
              loading="lazy"
              fetchPriority="low"
              style={{ position: "absolute", left: "5%", width: "90%", bottom: "8%", opacity: 1, zIndex: 0 }}
            />
          </>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24, padding: 20, alignItems: "center", flex: 1 }}>
          <div style={textColStyle}>
            <span style={{ fontFamily: "monospace", fontSize: 12, letterSpacing: ".2em", opacity: 1, transform: inT, transition: flags.transformIntro ? tr([["transform", 0.7, 0.05]]) : undefined }}>
              DELL · HP · LENOVO
            </span>
            <h1
              className="v5-hero-h1"
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "clamp(36px,10.6vw,48px)",
                lineHeight: 0.98,
                letterSpacing: "-.05em",
                opacity: 1,
                transform: "none",
              }}
            >
              <span style={{ display: "block" }}>The future of</span>
              <span style={{ display: "block", color: "#2159D4" }}>smarter laptop</span>
              <span style={{ display: "block" }}>shopping.</span>
            </h1>
            <p style={{ margin: 0, maxWidth: "42ch", fontSize: 16, lineHeight: 1.55, opacity: 1, transform: inT, transition: flags.transformIntro ? tr([["transform", 0.8, 0.28]]) : undefined }}>
              Laptops from Dell, HP, Lenovo and more.
            </p>
          </div>
          <div style={{ position: "relative", minHeight: 280 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={MAIN_IMG}
              alt="Featured laptop"
              width={640}
              height={512}
              fetchPriority="high"
              decoding="async"
              style={{
                display: "block",
                width: "70%",
                margin: "0 auto",
                opacity: 1,
                transform: flags.transformIntro ? lapIn : "none",
                transition: flags.transformIntro ? tr([["transform", 1.1, 0.3]]) : undefined,
                mixBlendMode: flags.blend && introDone ? "multiply" : undefined,
              }}
            />
          </div>
        </div>
        {!rm && flags.introMachine ? <p style={{ fontFamily: "monospace", fontSize: 11, padding: 12 }}>introDone={String(introDone)}</p> : null}
      </section>
    </Shell>
  );
}

export function ModeC() {
  return <HeroShell flags={{ note: "Mode C: hero shell, static H1 + main image only" }} />;
}

export function ModeD() {
  return <HeroShell flags={{ decorative: true, note: "Mode D: + decorative layers, no animation" }} />;
}

export function ModeETransform() {
  return <HeroShell flags={{ decorative: true, transformIntro: true, introMachine: true, note: "Mode E-transform: intro transform transitions" }} />;
}

export function ModeEBlend() {
  return <HeroShell flags={{ decorative: true, blend: true, introMachine: true, note: "Mode E-blend: mix-blend after intro" }} />;
}

export function ModeEIsolation() {
  return <HeroShell flags={{ decorative: true, isolation: true, introMachine: true, note: "Mode E-isolation: overflow+isolation after intro" }} />;
}

export function ModeEIntro() {
  return (
    <HeroShell
      flags={{
        decorative: true,
        transformIntro: true,
        introMachine: true,
        note: "Mode E-intro: full intro state machine + transforms",
      }}
    />
  );
}

export function ModeEParallax() {
  return (
    <HeroShell
      flags={{
        decorative: true,
        transformIntro: true,
        introMachine: true,
        parallax: true,
        note: "Mode E-parallax: + scroll rAF after intro",
      }}
    />
  );
}

export function ModeECalcOpacity() {
  return (
    <HeroShell
      flags={{
        decorative: true,
        transformIntro: true,
        introMachine: true,
        parallax: true,
        calcOpacity: true,
        note: "Mode E-calc-opacity: + calc opacity/transform on text column after intro",
      }}
    />
  );
}

export function ModeEFullHeroShell() {
  return (
    <HeroShell
      flags={{
        decorative: true,
        transformIntro: true,
        blend: true,
        isolation: true,
        introMachine: true,
        parallax: true,
        calcOpacity: true,
        note: "Mode E-full-hero-shell: combined hero effect flags",
      }}
    />
  );
}

/** F — hero shell + heavy below-fold stubs (story/reels stand-ins). */
export function ModeF() {
  return (
    <>
      <ModeEFullHeroShell />
      <section style={{ padding: 40, background: "#fff" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 32 }}>Product story (stub)</h2>
        <p>Below-fold content that should not affect LCP candidacy.</p>
        {Array.from({ length: 8 }).map((_, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={MAIN_IMG} alt="" loading="lazy" width={400} height={320} style={{ width: 200, height: "auto", margin: 8 }} />
        ))}
      </section>
    </>
  );
}

export function renderLabMode(mode: string) {
  switch (mode) {
    case "A":
      return <ModeA />;
    case "A-font":
      return <ModeAFont />;
    case "B":
      return <ModeB />;
    case "C":
      return <ModeC />;
    case "D":
      return <ModeD />;
    case "E-transform":
      return <ModeETransform />;
    case "E-blend":
      return <ModeEBlend />;
    case "E-isolation":
      return <ModeEIsolation />;
    case "E-intro":
      return <ModeEIntro />;
    case "E-parallax":
      return <ModeEParallax />;
    case "E-calc-opacity":
      return <ModeECalcOpacity />;
    case "E-full-hero-shell":
      return <ModeEFullHeroShell />;
    case "F":
      return <ModeF />;
    default:
      return null;
  }
}

export type { LabModeId as LabMode } from "@/lib/diag/lcp-lab-modes";
