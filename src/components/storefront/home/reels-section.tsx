"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { displayTag, type PublicReel } from "@/lib/content/reels";

type Props = { reels: PublicReel[]; heading?: string; autoplayMuted?: boolean };

/** Muted autoplay is allowed only when the merchant enabled it, motion is welcome and the shopper is not saving data. */
function autoplayAllowed(enabled: boolean): boolean {
  if (!enabled || typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !conn?.saveData;
}

/**
 * "Generation Laptops HUB" reels row, built from V5 tokens and the NewGenRow scroll pattern (no new visual language).
 * Rendered only when published, rights-cleared reels exist.
 *
 * Playback: at most ONE video plays at a time — the most visible card — muted and looping, and only while the row is
 * on screen and the tab is visible. Nothing downloads until a card is about to play (`preload="none"`), so six reels
 * never mean six simultaneous downloads. Sound only after the shopper presses the sound button. With reduced motion,
 * data saver, or autoplay off in Admin, cards wait for the shopper to press play. Browsers may still block autoplay;
 * the play button always works.
 */
export function ReelsSection({ reels, heading = "Generation Laptops HUB", autoplayMuted = true }: Props) {
  const row = useRef<HTMLDivElement>(null);
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const ratios = useRef(new Map<string, number>());
  const userPaused = useRef(new Set<string>());
  const [playing, setPlaying] = useState<string | null>(null);
  const [unmuted, setUnmuted] = useState<string | null>(null);
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const playOnly = useCallback((id: string | null, sound = false) => {
    for (const [vid, el] of videos.current) {
      if (vid !== id && !el.paused) el.pause();
    }
    if (!id) return setPlaying(null);
    const el = videos.current.get(id);
    if (!el) return;
    el.muted = !sound; // set the property directly: autoplay is only permitted while muted
    el.play().then(
      () => setPlaying(id),
      (err: unknown) => {
        setPlaying(null); // autoplay refused by the browser (NotAllowedError): the play button remains
        // A missing/unsupported source can reject play() without the error event reaching React:
        // show the unavailable state rather than a dead player.
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotSupportedError" || name === "AbortError" || el.error || el.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
          setFailed((s) => (s.has(id) ? s : new Set(s).add(id)));
        }
      },
    );
  }, []);

  const pickVisible = useCallback(() => {
    // Evaluated on every visibility change (only ever runs in the browser), so a media-query change applies at once.
    if (!autoplayAllowed(autoplayMuted) || document.hidden) return;
    let best: string | null = null;
    let bestRatio = 0.6;
    for (const [id, r] of ratios.current) {
      if (r >= bestRatio && !userPaused.current.has(id) && !failed.has(id)) {
        best = id;
        bestRatio = r;
      }
    }
    // Keep a shopper-unmuted video playing while it stays visible.
    if (unmuted && (ratios.current.get(unmuted) ?? 0) >= 0.6) return;
    if (best !== playing) {
      if (unmuted && unmuted !== best) setUnmuted(null);
      playOnly(best);
    }
  }, [autoplayMuted, failed, playOnly, playing, unmuted]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.reelId;
          if (id) ratios.current.set(id, e.isIntersecting ? e.intersectionRatio : 0);
          // A video scrolled out of view always stops (and loses sound).
          if (id && e.intersectionRatio < 0.25) {
            const el = videos.current.get(id);
            if (el && !el.paused) el.pause();
          }
        }
        pickVisible();
      },
      { threshold: [0, 0.25, 0.6, 0.85, 1] },
    );
    for (const el of videos.current.values()) io.observe(el);
    const onVis = () => (document.hidden ? playOnly(null) : pickVisible());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [pickVisible, playOnly, reels]);

  if (!reels.length) return null;
  const btn = { width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--lh-border)", background: "#FFFFFF", cursor: "pointer", display: "grid", placeItems: "center" } as const;
  const ctl = { width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(255,255,255,.35)", background: "rgba(10,23,48,.55)", color: "#FFFFFF", cursor: "pointer", display: "grid", placeItems: "center", backdropFilter: "blur(6px)" } as const;
  const many = reels.length > 2;
  return (
    <section aria-labelledby="reels-title" data-testid="reels-section" style={{ maxWidth: 1360, margin: "0 auto", padding: "clamp(56px,7vw,96px) clamp(16px,3vw,32px) 0" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".12em", color: "var(--lh-ink-2)" }}>
            <span style={{ width: 12, height: 2, background: "var(--lh-signal)" }} />
            REELS
          </span>
          <h2 id="reels-title" style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(28px,3vw,44px)", letterSpacing: "-.035em", fontWeight: 700 }}>
            {heading}
          </h2>
        </div>
        {many ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" aria-label="Scroll reels left" className="v5-hov-bd-action" style={btn} onClick={() => row.current?.scrollBy({ left: -560 })}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#102039" strokeWidth="2" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <button type="button" aria-label="Scroll reels right" className="v5-hov-bd-action" style={btn} onClick={() => row.current?.scrollBy({ left: 560 })}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#102039" strokeWidth="2" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
      <div
        ref={row}
        className="v5-row"
        style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(220px,260px)", gap: 18, overflowX: "auto", scrollSnapType: "x mandatory", scrollBehavior: "smooth", padding: "6px 2px 12px", scrollbarWidth: "thin", scrollbarColor: "var(--lh-action) transparent" }}
      >
        {reels.map((r) => {
          const isPlaying = playing === r.id;
          const hasSound = unmuted === r.id;
          const broken = failed.has(r.id);
          const tag = displayTag(r.tag);
          return (
            <figure key={r.id} data-testid="reel" style={{ margin: 0, scrollSnapAlign: "start", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ position: "relative", aspectRatio: "9 / 16", borderRadius: 20, overflow: "hidden", background: "var(--lh-navy)", border: "1px solid var(--lh-border)" }}>
                {broken ? (
                  <div role="img" aria-label={`${r.title}: video unavailable`} style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,.75)", fontSize: 14, padding: 20, textAlign: "center" }}>
                    This video is not available right now.
                  </div>
                ) : (
                  <video
                    ref={(el) => {
                      if (el) {
                        videos.current.set(r.id, el);
                        el.addEventListener("error", () => setFailed((s) => (s.has(r.id) ? s : new Set(s).add(r.id))), true);
                      } else {
                        videos.current.delete(r.id);
                      }
                    }}
                    data-reel-id={r.id}
                    data-testid="reel-video"
                    muted={!hasSound}
                    playsInline
                    loop
                    preload="none"
                    poster={r.posterUrl || undefined}
                    aria-label={r.title}
                    onPause={() => setPlaying((p) => (p === r.id ? null : p))}
                    onPlay={() => setPlaying(r.id)}
                    onError={() => setFailed((s) => (s.has(r.id) ? s : new Set(s).add(r.id)))}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  >
                    {/* MP4 first — Chrome/Firefox often cannot play HLS without a library. Safari can still pick HLS when listed second. */}
                    <source src={r.videoUrl} onError={() => setFailed((s) => new Set(s).add(r.id))} />
                    {r.hlsUrl ? (
                      <source src={r.hlsUrl} type="application/x-mpegURL" onError={() => setFailed((s) => new Set(s).add(r.id))} />
                    ) : null}
                  </video>
                )}
                {(r.creatorName || tag) && !broken ? (
                  <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "40px 14px 60px", background: "linear-gradient(180deg,transparent,rgba(10,23,48,.72))", color: "#FFFFFF", display: "flex", flexDirection: "column", gap: 2, pointerEvents: "none" }}>
                    {r.creatorName ? <span style={{ fontWeight: 700, fontSize: 14 }}>{r.creatorName}</span> : null}
                    {tag ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.85 }}>{tag}</span> : null}
                  </div>
                ) : null}
                {!broken ? (
                  <div style={{ position: "absolute", right: 10, bottom: 10, display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      data-testid="reel-play"
                      aria-label={isPlaying ? `Pause ${r.title}` : `Play ${r.title}`}
                      style={ctl}
                      onClick={() => {
                        if (isPlaying) {
                          userPaused.current.add(r.id);
                          videos.current.get(r.id)?.pause();
                        } else {
                          userPaused.current.delete(r.id);
                          if (unmuted && unmuted !== r.id) setUnmuted(null);
                          playOnly(r.id, unmuted === r.id);
                        }
                      }}
                    >
                      {isPlaying ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
                      )}
                    </button>
                    <button
                      type="button"
                      data-testid="reel-sound"
                      aria-pressed={hasSound}
                      aria-label={hasSound ? `Mute ${r.title}` : `Turn on sound for ${r.title}`}
                      style={ctl}
                      onClick={() => {
                        const el = videos.current.get(r.id);
                        if (hasSound) {
                          if (el) el.muted = true;
                          return setUnmuted(null);
                        }
                        setUnmuted(r.id);
                        userPaused.current.delete(r.id);
                        playOnly(r.id, true);
                      }}
                    >
                      {hasSound ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" /></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6" /></svg>
                      )}
                    </button>
                  </div>
                ) : null}
              </div>
              <figcaption style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: "var(--lh-ink)" }}>{r.title}</span>
                {r.caption ? <span style={{ fontSize: 14, lineHeight: 1.5, color: "var(--lh-ink-2)" }}>{r.caption}</span> : null}
                {r.productHandle ? (
                  <Link href={`/products/${encodeURIComponent(r.productHandle)}`} style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontWeight: 600, fontSize: 14, color: "var(--lh-action)" }}>
                    View this laptop →
                  </Link>
                ) : r.linkPath ? (
                  <Link href={r.linkPath} style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontWeight: 600, fontSize: 14, color: "var(--lh-action)" }}>
                    Browse laptops →
                  </Link>
                ) : null}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
