"use client";

import Link from "next/link";
import { useRef } from "react";
import type { PublicReel } from "@/lib/content/reels";

/**
 * "Generation Laptops HUB" reels row, built from V5 tokens and the NewGenRow scroll pattern (no new visual language).
 * Rendered only when published, rights-cleared reels exist. Videos never autoplay, load nothing until the shopper
 * presses play (`preload="none"`), and are served from our own links — no third-party player or tracker.
 */
export function ReelsSection({ reels }: { reels: PublicReel[] }) {
  const row = useRef<HTMLDivElement>(null);
  if (!reels.length) return null;
  const btn = { width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--lh-border)", background: "#FFFFFF", cursor: "pointer", display: "grid", placeItems: "center" } as const;
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
            Generation Laptops HUB
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
        {reels.map((r) => (
          <figure key={r.id} data-testid="reel" style={{ margin: 0, scrollSnapAlign: "start", display: "flex", flexDirection: "column", gap: 10 }}>
            <video
              controls
              playsInline
              preload="none"
              poster={r.posterUrl || undefined}
              aria-label={r.title}
              style={{ width: "100%", aspectRatio: "9 / 16", objectFit: "cover", borderRadius: 20, background: "var(--lh-navy)", border: "1px solid var(--lh-border)" }}
            >
              <source src={r.videoUrl} />
            </video>
            <figcaption style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--lh-ink)" }}>{r.title}</span>
              {r.caption ? <span style={{ fontSize: 14, lineHeight: 1.5, color: "var(--lh-ink-2)" }}>{r.caption}</span> : null}
              {r.productHandle ? (
                <Link href={`/products/${encodeURIComponent(r.productHandle)}`} style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontWeight: 600, fontSize: 14, color: "var(--lh-action)" }}>
                  View this laptop →
                </Link>
              ) : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
