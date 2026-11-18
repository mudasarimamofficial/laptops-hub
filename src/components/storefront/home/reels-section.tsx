"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicReel } from "@/lib/content/reels";
import { PremiumHorizontalCarousel, useCarouselControls } from "@/components/storefront/ui/premium-horizontal-carousel";
import { ReelShoppableModal } from "@/components/storefront/home/reel-shoppable-modal";

type Props = {
  reels: PublicReel[];
  heading?: string;
  subtitle?: string;
  autoplayMuted?: boolean;
};

function autoplayAllowed(enabled: boolean): boolean {
  if (!enabled || typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !conn?.saveData;
}

/**
 * Homepage reels: every visible card autoplays muted + loops for its full duration.
 * Click/tap opens a centered shoppable modal. Tags/hashtags are admin-only metadata.
 */
export function ReelsSection({
  reels,
  heading = "Laptops in Action",
  subtitle = "Watch, explore, and find your next laptop.",
  autoplayMuted = true,
}: Props) {
  const { viewportRef, scrollLeft, scrollRight } = useCarouselControls(560);
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const visible = useRef(new Set<string>());
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<PublicReel | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const canAutoplay = useRef(false);

  const syncPlayback = useCallback(() => {
    if (!canAutoplay.current || document.hidden || active) {
      for (const el of videos.current.values()) {
        if (!el.paused) el.pause();
      }
      return;
    }
    for (const [id, el] of videos.current) {
      if (failed.has(id)) continue;
      if (visible.current.has(id)) {
        if (el.dataset.srcAttached !== "1") {
          // Attach sources only when first visible — avoid six full downloads on load.
          const reel = reels.find((r) => r.id === id);
          if (reel) {
            el.querySelectorAll("source").forEach((s) => s.remove());
            const mp4 = document.createElement("source");
            mp4.src = reel.videoUrl;
            el.appendChild(mp4);
            if (reel.hlsUrl) {
              const hls = document.createElement("source");
              hls.src = reel.hlsUrl;
              hls.type = "application/x-mpegURL";
              el.appendChild(hls);
            }
            el.dataset.srcAttached = "1";
            el.load();
          }
        }
        el.muted = true;
        if (el.paused) {
          void el.play().catch((err: unknown) => {
            const name = err instanceof DOMException ? err.name : "";
            if (name === "NotSupportedError" || el.error || el.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
              setFailed((s) => (s.has(id) ? s : new Set(s).add(id)));
            }
          });
        }
      } else if (!el.paused) {
        el.pause();
      }
    }
  }, [active, failed, reels]);

  useEffect(() => {
    canAutoplay.current = autoplayAllowed(autoplayMuted);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.reelId;
          if (!id) continue;
          if (e.isIntersecting && e.intersectionRatio >= 0.35) visible.current.add(id);
          else visible.current.delete(id);
        }
        syncPlayback();
      },
      { threshold: [0, 0.35, 0.6, 1] },
    );
    for (const el of videos.current.values()) io.observe(el);
    const onVis = () => syncPlayback();
    document.addEventListener("visibilitychange", onVis);
    syncPlayback();
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [autoplayMuted, reels, syncPlayback]);

  if (!reels.length) return null;

  const btn = {
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "1px solid var(--lh-border)",
    background: "#FFFFFF",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
  } as const;

  return (
    <section
      aria-labelledby="reels-title"
      data-testid="reels-section"
      style={{ maxWidth: 1360, margin: "0 auto", padding: "clamp(56px,7vw,96px) clamp(16px,3vw,32px) 0" }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".12em", color: "var(--lh-ink-2)" }}>
            <span style={{ width: 12, height: 2, background: "var(--lh-signal)" }} />
            REELS
          </span>
          <h2 id="reels-title" style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(28px,3vw,44px)", letterSpacing: "-.035em", fontWeight: 700 }}>
            {heading}
          </h2>
          {subtitle ? <p style={{ margin: 0, fontSize: 16, color: "var(--lh-ink-2)", maxWidth: "42ch" }}>{subtitle}</p> : null}
        </div>
        {reels.length > 2 ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" aria-label="Scroll reels left" className="v5-hov-bd-action" style={btn} onClick={scrollLeft}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#102039" strokeWidth="2" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <button type="button" aria-label="Scroll reels right" className="v5-hov-bd-action" style={btn} onClick={scrollRight}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#102039" strokeWidth="2" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>

      <PremiumHorizontalCarousel
        viewportRef={viewportRef}
        aria-label="Laptops in action videos"
        showArrows={false}
        step={560}
        className="v5-row"
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "minmax(220px,260px)",
          gap: 18,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          scrollBehavior: "smooth",
          padding: "6px 2px 4px",
        }}
      >
        {reels.map((r) => {
          const broken = failed.has(r.id);
          return (
            <figure key={r.id} data-testid="reel" style={{ margin: 0, scrollSnapAlign: "start", display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                ref={(el) => {
                  if (el) triggerRefs.current.set(r.id, el);
                  else triggerRefs.current.delete(r.id);
                }}
                data-testid="reel-open"
                aria-label={`Open ${r.title} — shop this video`}
                onClick={(e) => {
                  returnFocusRef.current = e.currentTarget;
                  setActive(r);
                }}
                style={{
                  position: "relative",
                  aspectRatio: "9 / 16",
                  borderRadius: 20,
                  overflow: "hidden",
                  background: "var(--lh-navy)",
                  border: "1px solid var(--lh-border)",
                  padding: 0,
                  cursor: "pointer",
                  display: "block",
                  width: "100%",
                  boxShadow: "0 18px 40px -28px rgba(10,23,48,.55)",
                }}
              >
                {broken ? (
                  <span
                    role="img"
                    aria-label={`${r.title}: video unavailable`}
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "grid",
                      placeItems: "center",
                      color: "rgba(255,255,255,.75)",
                      fontSize: 14,
                      padding: 20,
                      textAlign: "center",
                    }}
                  >
                    This video is not available right now.
                  </span>
                ) : (
                  <>
                    <video
                      ref={(el) => {
                        if (el) {
                          videos.current.set(r.id, el);
                          el.addEventListener(
                            "error",
                            () => setFailed((s) => (s.has(r.id) ? s : new Set(s).add(r.id))),
                            true,
                          );
                        } else {
                          videos.current.delete(r.id);
                        }
                      }}
                      data-reel-id={r.id}
                      data-testid="reel-video"
                      muted
                      playsInline
                      loop
                      preload="none"
                      poster={r.posterUrl || undefined}
                      aria-hidden="true"
                      tabIndex={-1}
                      onError={() => setFailed((s) => (s.has(r.id) ? s : new Set(s).add(r.id)))}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                    />
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(180deg, transparent 55%, rgba(10,23,48,.35))",
                        pointerEvents: "none",
                      }}
                    />
                  </>
                )}
              </button>
              <figcaption style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: "var(--lh-ink)" }}>{r.title}</span>
                {r.caption ? <span style={{ fontSize: 14, lineHeight: 1.5, color: "var(--lh-ink-2)" }}>{r.caption}</span> : null}
              </figcaption>
            </figure>
          );
        })}
      </PremiumHorizontalCarousel>

      {active ? (
        <ReelShoppableModal
          reel={active}
          open
          onClose={() => setActive(null)}
          returnFocusRef={returnFocusRef}
        />
      ) : null}
    </section>
  );
}
