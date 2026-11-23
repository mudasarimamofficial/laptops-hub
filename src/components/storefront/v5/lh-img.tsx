"use client";

import { useState } from "react";
import { imageSrcSet, sizedImage } from "@/lib/catalog/image-url";

/**
 * V5 `LHImg.dc.html`: absolutely fills its tile; renders nothing for a missing or failed URL so the tile
 * background shows instead of a broken image.
 * When `displayWidth` is set and the CDN supports resize, request a container-aware asset + srcset.
 */
export function LHImg({
  src,
  alt = "",
  pad = "0",
  blend = "normal",
  eager = false,
  displayWidth = 640,
  sizes,
  priority = false,
}: {
  src: string | null | undefined;
  alt?: string;
  pad?: string;
  blend?: "normal" | "multiply";
  eager?: boolean;
  /** Approximate CSS width of the tile; used to pick a Shopify CDN width. */
  displayWidth?: number;
  sizes?: string;
  /** LCP-critical images: eager + fetchPriority high. */
  priority?: boolean;
}) {
  const [bad, setBad] = useState<string | null>(null);
  const ok = typeof src === "string" && /^https?:/.test(src) && bad !== src;
  const base = ok ? sizedImage(src!, Math.min(1600, Math.max(160, Math.round(displayWidth * 2)))) : null;
  const srcSet = ok
    ? imageSrcSet(src!, [
        Math.round(displayWidth),
        Math.round(displayWidth * 1.5),
        Math.round(displayWidth * 2),
        Math.round(displayWidth * 3),
      ])
    : undefined;
  return (
    <span style={{ position: "absolute", inset: 0, display: "block" }}>
      {ok && base ? (
        // eslint-disable-next-line @next/next/no-img-element -- V5 tile markup; remote catalog CDN
        <img
          src={base}
          srcSet={srcSet}
          sizes={sizes || `${displayWidth}px`}
          alt={alt}
          loading={priority || eager ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onError={() => setBad(src!)}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "contain",
            padding: pad,
            mixBlendMode: blend,
            boxSizing: "border-box",
          }}
        />
      ) : null}
    </span>
  );
}
