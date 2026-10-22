"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/commerce/cart-store";
import { openCartDrawer } from "@/lib/commerce/cart-ui";
import { canPurchase } from "@/lib/catalog/availability";
import { setStoryInView } from "@/lib/commerce/story-ui";

export type StoryProps = {
  handle: string;
  title: string;
  model: string;
  config: string;
  priceText: string;
  stockText: string;
  pricePaisa: number;
  variantId: string;
  maxPerOrder: number;
  available: boolean;
  /** Four angles (front, left, right, rear): V5 cutouts when approved, otherwise catalog photos. */
  angles: { src: string | null; cutout: boolean }[];
  rows: { k: string; v: string }[];
};

const LABELS = ["Front", "Left", "Right", "Rear"];
const VIEW = ["Front view", "Left angle", "Right angle", "Rear view"];
const ALT = ["front view", "left angle", "right angle", "rear view"];
const POS = [
  { left: "6%", width: "88%" },
  { left: "4%", width: "92%" },
  { left: "4%", width: "92%" },
  { left: "6%", width: "88%" },
];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function lerp(x: number, xs: number[], ys: number[]) {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++)
    if (x <= xs[i]) {
      const k = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return ys[i - 1] + (ys[i] - ys[i - 1]) * k;
    }
  return ys[ys.length - 1];
}
const E = (x: number) => x * x * (3 - 2 * x);

/** Port of V5 section `#story` ("02 Product story"): pinned scene, four angles, scroll-linked spec reveal. */
export function ProductStory(p: StoryProps) {
  const ref = useRef<HTMLElement>(null);
  const [rm, setRm] = useState(false);
  const [ci, setCi] = useState(0);
  const [ctaOn, setCtaOn] = useState(false);
  const add = useCart((s) => s.add);
  const state = useRef({ ci: 0, ctaOn: false, storyIn: false });

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setRm(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const s = ref.current;
    if (!s) return;
    let raf = 0;
    const set = (k: string, v: number | string) => s.style.setProperty(k, typeof v === "number" ? v.toFixed(4) : v);
    const frame = () => {
      raf = 0;
      const vh = innerHeight;
      const r = s.getBoundingClientRect();
      const H = Math.max(1, vh - 72);
      const sh = s.firstElementChild ? (s.firstElementChild as HTMLElement).offsetHeight : H;
      const span = Math.max(1, r.height - sh);
      const sp = rm ? 1 : clamp((72 - r.top) / span, 0, 1);
      const ent = clamp((vh - r.top) / H, 0, 1);
      const ext = clamp((r.bottom - 72) / (sh * 0.55), 0, 1);
      const ep = rm ? 1 : Math.min(ent, ext);
      const f = rm ? state.current.ci : lerp(sp, [0, 0.14, 0.28, 0.4, 0.52, 0.64, 0.76, 1], [0, 0, 1, 1, 2, 2, 3, 3]);
      const fi = Math.floor(f);
      const fr = f - fi;
      const fe = fi + E(fr);
      set("--sp", sp);
      set("--ep", E(ep));
      for (let i = 0; i < 4; i++) set("--o" + i, clamp(1 - Math.abs(fe - i), 0, 1));
      set("--tw", rm ? 0 : Math.sin(Math.PI * fr));
      set("--px", rm ? 0 : lerp(sp, [0, 0.14, 0.4, 0.64, 0.86, 1], [0, 0, -1.6, 1.6, 0, 0]));
      set("--py", rm ? 0 : (1 - E(ent)) * 180 + lerp(sp, [0, 0.12, 0.92, 1], [50, 0, 0, -24]));
      set("--ps", rm ? 1 : lerp(sp, [0, 0.12, 0.4, 0.64, 0.86, 1], [0.82, 1, 1.04, 1.04, 0.98, 0.92]) * (0.86 + 0.14 * E(ent)));
      [0.06, 0.28, 0.5, 0.7].forEach((a, i) => set("--l" + i, rm ? 1 : clamp((sp - a) / 0.08, 0, 1)));
      const l4 = rm ? 1 : clamp((sp - 0.8) / 0.08, 0, 1);
      set("--l4", l4);
      const nci = rm ? state.current.ci : clamp(Math.round(f), 0, 3);
      const on = l4 > 0.5;
      // Story covers the compare-tray zone: hide the tray so story CTAs stay reachable.
      const sin = r.top < vh - 90 && r.bottom > vh - 90;
      if (nci !== state.current.ci) {
        state.current.ci = nci;
        setCi(nci);
      }
      if (on !== state.current.ctaOn) {
        state.current.ctaOn = on;
        setCtaOn(on);
      }
      if (sin !== state.current.storyIn) {
        state.current.storyIn = sin;
        setStoryInView(sin);
      }
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
      setStoryInView(false);
    };
  }, [rm]);

  const goCh = (i: number) => {
    if (rm) {
      state.current.ci = i;
      setCi(i);
      return;
    }
    const s = ref.current;
    if (!s) return;
    const sh = s.firstElementChild ? (s.firstElementChild as HTMLElement).offsetHeight : innerHeight - 72;
    const span = Math.max(1, s.offsetHeight - sh);
    const top = s.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top - 72 + span * [0.08, 0.34, 0.58, 0.84][i], behavior: "smooth" });
  };

  const live = ctaOn || rm;
  const purchasable = canPurchase({ available: p.available, pricePaisa: p.pricePaisa, variantId: p.variantId });
  const href = "/products/" + encodeURIComponent(p.handle);
  const stageVars = { "--o0": 1, "--o1": 0, "--o2": 0, "--o3": 0 } as Record<string, number>;
  if (rm) for (let i = 0; i < 4; i++) stageVars["--o" + i] = i === ci ? 1 : 0;

  return (
    <section
      id="story"
      data-screen-label="02 Product story"
      ref={ref}
      aria-label={`Find your next machine: ${p.model}`}
      className="v5-story"
      style={{ ["--ep" as string]: 0, ["--sp" as string]: 0, ["--o0" as string]: 1, ["--o1" as string]: 0, ["--o2" as string]: 0, ["--o3" as string]: 0, ["--l0" as string]: 0, ["--l1" as string]: 0, ["--l2" as string]: 0, ["--l3" as string]: 0, ["--l4" as string]: 0, ["--px" as string]: 0, ["--py" as string]: 0, ["--ps" as string]: 1, ["--tw" as string]: 0, position: "relative", background: "var(--lh-canvas)" }}
    >
      <div className="v5-story-sticky" style={{ top: 72 }}>
        <div style={{ position: "relative", height: "100%", overflow: "hidden", isolation: "isolate", background: "var(--lh-navy)", color: "#FFFFFF", clipPath: "inset(calc((1 - var(--ep)) * 3.5%) calc((1 - var(--ep)) * 3%) round calc((1 - var(--ep)) * 48px))", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: -3, background: "radial-gradient(60% 55% at 30% 80%,rgba(var(--lh-action-rgb),.5),transparent 70%),linear-gradient(var(--lh-navy),var(--lh-navy) 60%,var(--lh-navy))" }} />
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: -3, opacity: "calc(1 - var(--sp))", background: "radial-gradient(42% 42% at 18% 18%,rgba(var(--lh-electric-rgb),.3),transparent 70%)" }} />
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: -3, opacity: "var(--sp)", background: "radial-gradient(50% 50% at 75% 25%,rgba(var(--lh-iris-rgb),.42),transparent 70%)" }} />
          <div aria-hidden="true" className="v5-story-orbit" style={{ position: "absolute", aspectRatio: "1/1", zIndex: -2, transform: "translate(-50%,-50%)" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(var(--lh-haze-rgb),.14)" }} />
            <div style={{ position: "absolute", inset: 0 }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "conic-gradient(from 0deg,transparent 0deg,#1CB9E8 40deg,#2159D4 80deg,transparent 110deg)", WebkitMaskImage: "radial-gradient(closest-side,transparent calc(100% - 2.5px),#000 calc(100% - 2px))", maskImage: "radial-gradient(closest-side,transparent calc(100% - 2.5px),#000 calc(100% - 2px))", transform: "rotate(calc(var(--sp) * 260deg - 40deg))", willChange: "transform" }} />
            </div>
            <div style={{ position: "absolute", inset: "16%", borderRadius: "50%", border: "1px dashed rgba(var(--lh-haze-rgb),.16)", transform: "rotate(calc(var(--sp) * -140deg))" }} />
          </div>
          <div aria-hidden="true" style={{ position: "absolute", left: "-20%", right: "-20%", bottom: "-8%", height: "44%", zIndex: -2, transform: "perspective(700px) rotateX(68deg)", transformOrigin: "50% 100%", backgroundImage: "linear-gradient(rgba(var(--lh-electric-rgb),.16) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--lh-electric-rgb),.16) 1px,transparent 1px)", backgroundSize: "64px 64px", backgroundPosition: "0 calc(var(--sp) * 640px)", WebkitMaskImage: "linear-gradient(transparent,#000 40%)", maskImage: "linear-gradient(transparent,#000 40%)" }} />
          <div aria-hidden="true" className="v5-story-ghost" style={{ position: "absolute", left: 0, zIndex: -2, whiteSpace: "nowrap", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(110px,18vw,290px)", letterSpacing: "-.05em", lineHeight: 1, color: "transparent", WebkitTextStroke: "1px rgba(var(--lh-haze-rgb),.12)", transform: "translate3d(calc(10vw - var(--sp) * 70vw),-50%,0)", willChange: "transform" }}>
            {p.model.replace(/^(Dell|HP|Lenovo)\s+/i, "").toUpperCase()}
          </div>

          <div className="v5-story-grid" style={{ position: "relative", width: "100%", maxWidth: 1360, margin: "0 auto", display: "grid", alignItems: "stretch" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0, minHeight: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".14em", color: "var(--lh-on-dark-2)" }}>
                  <span style={{ width: 12, height: 2, background: "var(--lh-signal)" }} />
                  02 — PRODUCT STORY
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--lh-on-dark-2)" }}>
                  {VIEW[ci]} · {ci + 1}/4
                </span>
              </div>
              <div className="v5-story-stage" style={{ position: "relative", perspective: 1400 }}>
                <div aria-hidden="true" style={{ position: "absolute", left: "16%", right: "16%", top: "-14%", bottom: "22%", background: "linear-gradient(180deg,rgba(var(--lh-haze-rgb),0),rgba(var(--lh-haze-rgb),.2) 60%,rgba(var(--lh-haze-rgb),0))", clipPath: "polygon(44% 0,56% 0,100% 100%,0 100%)", opacity: "calc(.35 + var(--sp) * .5)" }} />
                <div aria-hidden="true" style={{ position: "absolute", left: "14%", right: "14%", bottom: "5%", height: "18%", borderRadius: "50%", background: "radial-gradient(closest-side,rgba(var(--lh-electric-rgb),.5),rgba(var(--lh-action-rgb),.18) 60%,transparent)", transform: "translate3d(calc(var(--px) * 1vw),0,0) scaleX(calc(.8 + var(--ps) * .2))" }} />
                <div aria-hidden="true" style={{ position: "absolute", left: "20%", right: "20%", bottom: "9%", height: "8%", borderRadius: "50%", background: "radial-gradient(closest-side,rgba(0,0,0,.75),transparent)", transform: "translate3d(calc(var(--px) * 1vw),0,0)" }} />
                <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: "translate3d(calc(var(--px) * 1vw),calc(var(--py) * 1px),0) scale(var(--ps)) rotateY(calc(var(--tw) * -10deg))", willChange: "transform", ...(rm ? (stageVars as React.CSSProperties) : {}) }}>
                  {p.angles.map((a, i) =>
                    a.src ? (
                      // eslint-disable-next-line @next/next/no-img-element -- V5 layered story stage
                      <img
                        key={i}
                        src={a.src}
                        alt={`${p.model}, ${ALT[i]}`}
                        loading={i === 0 ? "eager" : "lazy"}
                        style={{ position: "absolute", left: POS[i].left, top: "6%", width: POS[i].width, height: "82%", objectFit: "contain", opacity: `var(--o${i})`, ...(a.cutout ? {} : { background: "#FFFFFF", borderRadius: 18 }) }}
                      />
                    ) : null,
                  )}
                </div>
              </div>
              {rm ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>
                  {p.angles.map((a, i) => (
                    <figure key={i} style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6, padding: 8, borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(var(--lh-haze-rgb),.18)" }}>
                      {a.src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.src} alt={`${p.model}, ${LABELS[i].toLowerCase()} view`} loading="lazy" style={{ width: "100%", aspectRatio: "16/10", objectFit: "contain" }} />
                      ) : null}
                      <figcaption style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--lh-on-dark-2)", textAlign: "center" }}>{LABELS[i]}</figcaption>
                    </figure>
                  ))}
                </div>
              ) : null}
              <div style={{ position: "relative", height: 2, background: "rgba(255,255,255,.14)", borderRadius: 2 }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "calc(var(--sp) * 100%)", background: "linear-gradient(90deg,var(--lh-action),var(--lh-electric))", borderRadius: 2, boxShadow: "0 0 12px rgba(var(--lh-electric-rgb),.7)" }} />
              </div>
            </div>

            <div className="v5-story-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "safe center", minWidth: 0, minHeight: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <h2 className="v5-story-h2" style={{ margin: 0, fontFamily: "var(--font-display)", lineHeight: 1, letterSpacing: "-.045em", fontWeight: 700, textWrap: "balance" }}>
                  Find your next machine.
                </h2>
                <span className="v5-story-sub" style={{ fontSize: "clamp(15px,1.1vw,17px)", color: "var(--lh-on-dark-2)" }}>
                  {p.model} · {p.config}
                </span>
              </div>
              <div role="group" aria-label="Story chapters" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 6 }}>
                {LABELS.map((label, i) => {
                  const on = ci === i;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => goCh(i)}
                      aria-pressed={on}
                      style={{ minHeight: 44, padding: "6px 8px", borderRadius: 12, border: `1px solid ${on ? "rgba(var(--lh-electric-rgb),.75)" : "rgba(var(--lh-haze-rgb),.2)"}`, background: on ? "rgba(var(--lh-action-rgb),.38)" : "rgba(255,255,255,.04)", color: on ? "#FFFFFF" : "var(--lh-on-dark-2)", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 1, cursor: "pointer", transition: "background .25s ease,border-color .25s ease,color .25s ease" }}
                    >
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em" }}>0{i + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
                {p.rows.map((r, i) => {
                  const hot = ci === i && !rm;
                  return (
                    <div
                      key={r.k}
                      className="v5-story-spec"
                      style={{ display: "flex", flexDirection: "column", gap: 5, borderRadius: 14, background: "rgba(255,255,255,.05)", border: `1px solid ${hot ? "rgba(var(--lh-electric-rgb),.7)" : "rgba(var(--lh-haze-rgb),.18)"}`, boxShadow: hot ? "0 0 30px -10px rgba(var(--lh-electric-rgb),.7)" : "none", opacity: `var(--l${i})`, transform: `translate3d(calc((1 - var(--l${i})) * 28px),0,0)`, transition: "border-color .3s ease,box-shadow .3s ease" }}
                    >
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--lh-electric)" }}>{r.k}</span>
                      <span style={{ fontSize: "clamp(14px,1.05vw,16px)", fontWeight: 600, lineHeight: 1.3 }}>{r.v}</span>
                      <span style={{ height: 2, borderRadius: 2, background: "linear-gradient(90deg,var(--lh-action),var(--lh-electric))", transformOrigin: "0 50%", transform: `scaleX(var(--l${i}))` }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 12px 12px 18px", borderRadius: 18, background: "linear-gradient(100deg,rgba(var(--lh-action-rgb),.3),rgba(var(--lh-iris-rgb),.24))", border: "1px solid rgba(var(--lh-haze-rgb),.35)", opacity: "var(--l4)", transform: "translate3d(0,calc((1 - var(--l4)) * 20px),0)", pointerEvents: live ? "auto" : "none" }}>
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700 }}>{p.priceText}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--lh-electric-text)" }}>{p.stockText}</span>
                </span>
                <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={href} tabIndex={live ? 0 : -1} className="v5-hov-bd-electric" style={{ height: 46, padding: "0 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,.3)", color: "#FFFFFF", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                    Details
                  </Link>
                  {purchasable ? (
                    <button
                      type="button"
                      tabIndex={live ? 0 : -1}
                      className="v5-hov-white-ice"
                      onClick={() => {
                        add({ variantId: p.variantId, handle: p.handle, title: p.title, unitPricePaisa: p.pricePaisa, quantity: 1, imageUrl: p.angles[0]?.src ?? undefined, maxPerOrder: p.maxPerOrder, model: p.model, config: p.config });
                        openCartDrawer();
                      }}
                      style={{ height: 46, padding: "0 20px", border: 0, borderRadius: 999, background: "#FFFFFF", color: "var(--lh-ink)", fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      Add to cart
                    </button>
                  ) : null}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
