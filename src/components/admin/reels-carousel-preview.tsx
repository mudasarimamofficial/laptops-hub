"use client";

import type { PublicReel } from "@/lib/content/reels";
import { displayTag } from "@/lib/content/reels";

/**
 * Merchant-only carousel preview (drafts allowed). Not embedded on the public storefront.
 */
export function ReelsCarouselPreview({
  reels,
  heading = "Generation Laptops HUB — admin preview",
}: {
  reels: PublicReel[];
  heading?: string;
}) {
  if (!reels.length) {
    return (
      <p className="rounded-[var(--adm-radius-lg)] border border-dashed border-[var(--adm-border)] bg-[var(--adm-surface)] p-6 text-sm text-[var(--adm-ink-2)]">
        No reels to preview yet. Add or restore presets below.
      </p>
    );
  }

  return (
    <section aria-labelledby="reels-admin-preview" data-testid="reels-admin-preview" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="reels-admin-preview" className="font-semibold text-[var(--adm-ink)]">
          {heading}
        </h2>
        <p className="text-xs text-[var(--adm-ink-2)]">
          Staff preview only — drafts stay private until published with confirmed rights.
        </p>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollSnapType: "x mandatory" }}>
        {reels.map((r) => {
          const tag = displayTag(r.tag);
          return (
            <figure
              key={r.id}
              className="w-[220px] shrink-0 scroll-snap-align-start"
              style={{ scrollSnapAlign: "start" }}
            >
              <div className="relative aspect-[9/16] overflow-hidden rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-black">
                {r.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.avatarUrl}
                    alt=""
                    className="absolute left-3 top-3 z-10 h-8 w-8 rounded-full border border-white/40 object-cover"
                  />
                ) : null}
                <video
                  controls
                  playsInline
                  preload="metadata"
                  poster={r.posterUrl || undefined}
                  className="h-full w-full object-cover"
                  src={r.videoUrl}
                >
                  {r.hlsUrl ? <source src={r.hlsUrl} type="application/x-mpegURL" /> : null}
                  <source src={r.videoUrl} />
                </video>
              </div>
              <figcaption className="mt-2 space-y-0.5">
                <p className="text-sm font-semibold text-[var(--adm-ink)]">{r.title}</p>
                {tag ? <p className="font-mono text-xs text-[var(--adm-ink-2)]">{tag}</p> : null}
                {r.linkPath || r.productHandle ? (
                  <p className="text-xs text-[var(--adm-ink-2)]">
                    Link: {r.productHandle ? `/products/${r.productHandle}` : r.linkPath}
                  </p>
                ) : null}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
