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
  title: "LCP lab hero in chrome",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

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

/** Same CinematicHero as /diag/lcp-lab-real-hero, but under storefront chrome. */
export default async function LcpLabHeroInChromePage() {
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
  if (!mainP) return <p style={{ padding: 24 }}>No catalog</p>;
  const main = shot(mainP, "main");
  return (
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
  );
}
