"use client";

import Image from "next/image";
import { useState } from "react";

type Img = { url: string; alt: string; position: number };

export function ProductGallery({ images, title }: { images: Img[]; title: string }) {
  const [active, setActive] = useState(0);
  const primary = images[active] || images[0];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-[var(--lh-radius-frame)] bg-[var(--lh-titanium)]">
        {primary ? (
          <Image
            src={primary.url}
            alt={primary.alt || title}
            fill
            className="object-contain p-8"
            sizes="(max-width:1024px) 100vw, 50vw"
            priority
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--lh-ink-2)]">No image</div>
        )}
      </div>
      {images.length > 1 ? (
        <ul className="mt-4 grid grid-cols-5 gap-2">
          {images.slice(0, 8).map((img, i) => (
            <li key={`${img.position}-${i}`}>
              <button
                type="button"
                onClick={() => setActive(i)}
                className={`relative aspect-square w-full overflow-hidden rounded-xl bg-[var(--lh-ice)] ring-2 ${
                  i === active ? "ring-[var(--lh-action)]" : "ring-transparent"
                }`}
                aria-label={`Image ${i + 1}`}
                aria-pressed={i === active}
              >
                <Image src={img.url} alt="" fill className="object-contain p-2" sizes="80px" unoptimized />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
