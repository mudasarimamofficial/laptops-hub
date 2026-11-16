"use client";

import { useState } from "react";
import { useHydrated } from "@/lib/ui/use-hydrated";
import {
  HERO_IMAGE_PRESETS,
  STORY_ANGLE_PRESETS,
} from "@/lib/content/homepage-image-presets";
import type { SectionInstance } from "@/lib/content/site-builder-schema";

type DraftPayload = {
  sections?: SectionInstance[];
  viewport?: string;
};

type DraftRead = { parsed: DraftPayload | null; err: string | null };

/** One-shot read of the draft handed over by the Customize editor (then cleared so it cannot be replayed). */
let draftCache: DraftRead | null = null; // StrictMode may invoke the initializer twice; read storage once.
function readDraftOnce(): DraftRead {
  if (typeof window === "undefined") return { parsed: null, err: null };
  if (draftCache) return draftCache;
  draftCache = readDraftFromStorage();
  return draftCache;
}
function readDraftFromStorage(): DraftRead {
  try {
    const raw = localStorage.getItem("lh-theme-draft-preview");
    if (!raw) return { parsed: null, err: "No draft preview found. Open Customize and click “Open draft preview” again." };
    localStorage.removeItem("lh-theme-draft-preview");
    return { parsed: JSON.parse(raw) as DraftPayload, err: null };
  } catch {
    return { parsed: null, err: "Draft preview payload could not be read." };
  }
}

export default function OnlineStoreDraftPreviewPage() {
  const hydrated = useHydrated();
  if (!hydrated) {
    return <p className="p-6 text-sm text-[var(--adm-ink-2,#667)]">Loading draft preview…</p>;
  }
  return <DraftPreview />;
}

function DraftPreview() {
  const [{ parsed, err }] = useState(readDraftOnce);

  const hero = parsed?.sections?.find((s) => s.type === "v5_cinematic_hero");
  const story = parsed?.sections?.find((s) => s.type === "v5_product_story");
  const angles = (story?.settings?.angleImages as Record<string, string>) || {};
  const width = parsed?.viewport === "mobile" ? 390 : parsed?.viewport === "tablet" ? 768 : 1100;

  return (
    <div className="min-h-screen bg-[var(--adm-surface-2,#f4f6f8)] p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--adm-ink-2,#667)]">
        Draft preview only — not the public storefront
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold">Homepage draft</h1>
      {err ? (
        <p className="mt-4 text-sm text-[var(--adm-danger,#b00)]" role="alert">
          {err}
        </p>
      ) : null}

      <div className="mx-auto mt-6" style={{ maxWidth: width }}>
        <section className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Cinematic hero</h2>
          <div className="mt-3 flex flex-wrap gap-4">
            {(["main", "side1", "side2"] as const).map((slot) => {
              const key = slot === "main" ? "mainImageUrl" : slot === "side1" ? "side1ImageUrl" : "side2ImageUrl";
              const url = String(hero?.settings?.[key] || HERO_IMAGE_PRESETS[slot].imageUrl);
              return (
                <div key={slot}>
                  <p className="text-xs font-semibold">{HERO_IMAGE_PRESETS[slot].brand}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="mt-1 h-28 w-auto object-contain" />
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Product story angles</h2>
          <div className="mt-3 flex flex-wrap gap-4">
            {(["front", "left", "right", "rear"] as const).map((angle) => {
              const url = angles[angle] || STORY_ANGLE_PRESETS[angle].imageUrl;
              return (
                <div key={angle}>
                  <p className="text-xs font-semibold uppercase">{angle}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="mt-1 h-24 w-auto object-contain" />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
