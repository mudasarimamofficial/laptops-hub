import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLcpLabEnabled } from "@/lib/diag/lcp-lab-gate";
import { CinematicHero, type HeroShot } from "@/components/storefront/home/cinematic-hero";
import { fmtPkr, getV5Catalog, type V5Product } from "@/lib/catalog/v5";
import { formatProductDisplayName } from "@/lib/catalog/product-display-name";
import {
  HERO_IMAGE_PRESETS,
  HOMEPAGE_DEFAULT_HANDLES,
  resolveHeroPresentationImage,
} from "@/lib/content/homepage-image-presets";
import { DEFAULT_STOREFRONT_PRESENTATION } from "@/lib/content/storefront-presentation";

export const metadata: Metadata = {
  title: "LCP lab real hero",
  robots: { index: false, follow: false },
};

function shot(p: V5Product, slot: keyof typeof HERO_IMAGE_PRESETS): HeroShot {
  const resolved = resolveHeroPresentationImage({
    slot,
    productHandle: p.h,
    settings: null,
    catalogImageUrl: p.imgs[0]?.u || null,
  });
  const displayName = formatProductDisplayName(p.brand, p.model);
  return {
    href: "/products/" + encodeURIComponent(p.h),
    label: resolved.alt || displayName,
    name: displayName,
    src: resolved.src,
    cutout: resolved.cutout,
  };
}

/** Mode G-hero: production CinematicHero alone (no story/reels), minimal layout. */
export default async function LcpLabRealHeroPage() {
  if (!isLcpLabEnabled()) notFound();
  let P: V5Product[] = [];
  try {
    P = await getV5Catalog();
  } catch {
    P = [];
  }
  const byH = Object.fromEntries(P.map((p) => [p.h, p]));
  const mainP = byH[HOMEPAGE_DEFAULT_HANDLES.dell] || P[0];
  const s1 = byH[HOMEPAGE_DEFAULT_HANDLES.hp] || null;
  const s2 = byH[HOMEPAGE_DEFAULT_HANDLES.lenovo] || null;
  if (!mainP) {
    return <p style={{ padding: 24 }}>No catalog products available for hero lab.</p>;
  }
  const main = shot(mainP, "main");
  return (
    <>
      <p style={{ fontFamily: "monospace", fontSize: 12, padding: 12, background: "#102039", color: "#fff", margin: 0 }}>
        LCP lab · real CinematicHero only · no below-fold homepage sections
      </p>
      <CinematicHero
        totalCount={P.length}
        chromebookCount={P.filter((p) => p.cat === "chromebook").length}
        laptopCount={P.filter((p) => p.cat !== "accessory" && p.cat !== "tablet").length}
        accCount={P.filter((p) => p.cat === "accessory").length}
        main={{
          ...main,
          priceText: fmtPkr(mainP.pricePaisa),
          stockText: mainP.cond || "Condition not listed",
          chips: mainP.chips,
        }}
        side1={s1 ? shot(s1, "side1") : null}
        side2={s2 ? shot(s2, "side2") : null}
        pres={DEFAULT_STOREFRONT_PRESENTATION}
      />
    </>
  );
}
