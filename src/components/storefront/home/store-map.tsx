"use client";

import { useEffect, useRef, useState } from "react";
import type { MapSettings } from "@/lib/content/home-sections";
import s from "./store-map.module.css";

/**
 * "Visit our store" — the store's Google Map after the footer, uncovered by it as the visitor reaches the end of the
 * homepage (see store-map.module.css). The iframe is mounted only when the section is close to the viewport (or on
 * "Show map" when the owner chose click-to-load), so Google content is never part of the initial page load.
 * The reveal itself is pure CSS; an IntersectionObserver (not a scroll listener) only adds a gentle settle-in of the
 * panel and map as they come into view.
 */
export function StoreMap({ cfg }: { cfg: MapSettings }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [requested, setRequested] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const load = cfg.clickToLoad ? requested : near;

  useEffect(() => {
    // The sticky section is pinned (behind the page) from the first paint, so its own visibility says nothing.
    // A zero-height sentinel at its natural position in the flow tells how far the footer has uncovered it.
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNear(true);
      setRevealed(true);
      return;
    }
    const nearIo = new IntersectionObserver(([e]) => (e.isIntersecting || e.boundingClientRect.top < 0) && setNear(true), {
      // Symmetric margin: a fast jump (End key, scrollbar drag) can carry the sentinel from below the viewport to above
      // it in one frame on phones, where the stacked map is taller than the bottom margin; it must still load.
      rootMargin: "600px 0px 600px 0px",
    });
    const revealIo = new IntersectionObserver(([e]) => setRevealed(e.isIntersecting || e.boundingClientRect.top < 0), {
      rootMargin: "0px 0px -30% 0px",
    });
    nearIo.observe(el);
    revealIo.observe(el);
    return () => {
      nearIo.disconnect();
      revealIo.disconnect();
    };
  }, []);

  const style = {
    "--panel-opacity": revealed ? 1 : 0.001,
    "--panel-shift": revealed ? "0px" : "28px",
    "--map-scale": revealed ? 1 : 1.06,
  } as React.CSSProperties;

  // Keyboard users: the browser only scrolls a focused element "into view" geometrically, but while the reveal is
  // partway the footer still covers the map, so focus would be hidden under it. The map is the last thing on the
  // page, so moving focus into it scrolls to the end, where it is fully uncovered (WCAG 2.4.11 Focus Not Obscured).
  // Only while the map is actually pinned: as an ordinary section (phones, short screens) focus must not jump.
  const uncoverOnFocus = (e: React.FocusEvent<HTMLElement>) => {
    if (getComputedStyle(e.currentTarget).position !== "sticky") return;
    const end = document.documentElement.scrollHeight - window.innerHeight;
    if (window.scrollY < end - 1) window.scrollTo({ top: end, behavior: "instant" });
  };

  const iframe = (
    <iframe
      src={cfg.embedSrc}
      title="Map showing the Laptops HUB store in Bahawalpur (Google Maps)"
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
      data-testid="store-map-iframe"
    />
  );

  return (
    <>
    <div ref={sentinel} aria-hidden="true" data-testid="store-map-sentinel" style={{ height: 0 }} />
    <section
      className={s.section}
      data-map-reveal={cfg.revealEffect ? "on" : "off"}
      data-testid="store-map"
      aria-labelledby="store-map-title"
      style={style}
      onFocus={uncoverOnFocus}
    >
      <div className={s.frameWrap}>
        <div className={s.frame}>
          {load ? (
            iframe
          ) : (
            <div className={s.placeholder}>
              {cfg.clickToLoad ? (
                <button type="button" className={s.primary} data-testid="store-map-load" onClick={() => setRequested(true)}>
                  Show map
                  <span className="sr-only"> (loads Google Maps)</span>
                </button>
              ) : null}
            </div>
          )}
          {!cfg.clickToLoad ? <noscript>{iframe}</noscript> : null}
        </div>
      </div>
      <div className={s.panel}>
        <span className={s.eyebrow}>LOCATION</span>
        <h2 id="store-map-title" className={s.title}>
          {cfg.heading}
        </h2>
        {cfg.intro ? <p className={s.text}>{cfg.intro}</p> : null}
        <p className={s.place}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          Laptops HUB · Bahawalpur
        </p>
        <div className={s.actions}>
          <a className={s.primary} href={cfg.mapsUrl} target="_blank" rel="noopener" data-testid="store-map-open">
            Open in Google Maps
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          {cfg.clickToLoad && !requested ? (
            <button type="button" className={s.secondary} onClick={() => setRequested(true)}>
              Show map here
            </button>
          ) : null}
        </div>
        <p className={s.note}>Directions, opening hours and contact details are on our Google listing.</p>
      </div>
    </section>
    </>
  );
}
