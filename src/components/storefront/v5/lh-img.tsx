"use client";

import { useState } from "react";

/**
 * V5 `LHImg.dc.html`: absolutely fills its tile; renders nothing for a missing or failed URL so the tile
 * background shows instead of a broken image.
 */
export function LHImg({
  src,
  alt = "",
  pad = "0",
  blend = "normal",
  eager = false,
}: {
  src: string | null | undefined;
  alt?: string;
  pad?: string;
  blend?: "normal" | "multiply";
  eager?: boolean;
}) {
  const [bad, setBad] = useState<string | null>(null);
  const ok = typeof src === "string" && /^https?:/.test(src) && bad !== src;
  return (
    <span style={{ position: "absolute", inset: 0, display: "block" }}>
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element -- V5 tile markup; remote catalog CDN
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setBad(src)}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", padding: pad, mixBlendMode: blend, boxSizing: "border-box" }}
        />
      ) : null}
    </span>
  );
}
