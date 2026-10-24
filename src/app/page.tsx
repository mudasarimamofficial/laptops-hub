import { CinematicHero, type HeroShot } from "@/components/storefront/home/cinematic-hero";
import { ProductStory } from "@/components/storefront/home/product-story";
import { ChromebookSection } from "@/components/storefront/home/home-client";
import {
  BrandSection,
  BudgetSection,
  CompareDemoSection,
  FeaturedSection,
  NewGenSection,
  PromoSection,
  SpecSection,
  type CmpDemo,
} from "@/components/storefront/home/home-sections";
import { PendingBlock } from "@/components/ui/pending-block";
import { HomeInquirySection } from "@/components/storefront/home/home-inquiry";
import { confirmedPhones, telHref } from "@/lib/business";
import { contentVisibility } from "@/lib/content/pages";
import { cpuFmt, fmtPkr, getV5Catalog, ord, stoFmt, v5Card, v5Link, type V5Product } from "@/lib/catalog/v5";
import { cutoutUrl } from "@/lib/catalog/v5-media";

export const revalidate = 60;

/** V5 hero / story products. */
const HM_HANDLE = "dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage";
const H1_HANDLE = "hp-probook-640-g2-core-i5-6th-gen-8gb-ram-256gb-storage";
const H2_HANDLE = "lenovo-thinkpad-t580-core-i5-8th-gen-16gb-ram-512gb-storage";

const href = (p: V5Product) => "/products/" + encodeURIComponent(p.h);

function shot(p: V5Product, cutHandle: string, file: string): HeroShot {
  const cut = p.h === cutHandle ? cutoutUrl(file) : null;
  return { href: href(p), label: p.model, src: cut || p.imgs[0]?.u || null, cutout: !!cut };
}

export default async function HomePage() {
  let P: V5Product[] = [];
  try {
    P = await getV5Catalog();
  } catch {
    P = [];
  }
  if (!P.length) {
    return (
      <div className="lh-container py-12">
        <PendingBlock title="Catalog temporarily unavailable" label="Please try again">The product catalog could not be loaded. Please try again shortly.</PendingBlock>
      </div>
    );
  }

  // Ported from V5 renderVals() (home branch).
  const get = (h: string) => P.find((p) => p.h === h);
  const stock = P.filter((p) => p.comp && p.cat !== "tablet" && p.avail);
  const lapN = stock.length;
  const accN = P.filter((p) => p.cat === "accessory").length;
  const brandN = new Set(stock.map((p) => p.brand)).size;
  const HM = get(HM_HANDLE) || stock[0];
  const H1 = get(H1_HANDLE) || stock[1];
  const H2 = get(H2_HANDLE) || stock[2];
  const hs = HM.specs;
  const os = hs["Operating system"];
  const storyRows = [
    ["DISPLAY", hs.Display ? hs.Display.replace(" Display", "") : null],
    // V5 shows the cleaned processor line for the 7420; other fallbacks derive it from the listing.
    ["PROCESSOR", HM.h === HM_HANDLE ? "Core i5-1145G7 · 11th gen" : HM.cpu ? cpuFmt(HM.cpu) + (HM.gen ? " · " + ord(HM.gen) + " gen" : "") : null],
    ["MEMORY · STORAGE", (HM.ramN ? HM.ramN + "GB RAM" : "") + (HM.stoN ? " · " + stoFmt(HM.stoN) : "")],
    ["GRAPHICS · OS", [hs.Graphics, os].filter(Boolean).join(" · ")],
  ]
    .filter((r): r is [string, string] => !!r[1])
    .map(([k, v]) => ({ k, v }));
  const stockText = (p: V5Product) => p.cond || "Condition not listed";

  const cbL = P.filter((p) => p.cat === "chromebook");
  const c = cbL[0];
  const cb = {
    text: c
      ? "The " + c.model + " is in the catalog" + (c.config ? " with " + c.config : "") + ". Further models will appear here as they are listed in the store."
      : "No Chromebooks are listed right now. Ask us what you are looking for.",
    countText: cbL.length + (cbL.length === 1 ? " CHROMEBOOK" : " CHROMEBOOKS") + " LISTED",
    p: c
      ? { href: href(c), model: c.model, img: c.imgs[0]?.u ?? null, alt: c.model + (c.config ? ", " + c.config : ""), priceText: fmtPkr(c.pricePaisa) }
      : { href: "/collections/chromebooks", model: "Chromebooks", img: null, alt: "", priceText: "" },
  };

  const promoP = stock.filter((p) => p.specs.Display).sort((a, b) => (b.gen || 0) - (a.gen || 0) || b.pricePaisa - a.pricePaisa)[0] || P[0];
  const promo = {
    href: href(promoP),
    img: promoP.imgs[0]?.u ?? null,
    alt: promoP.imgs[0]?.a ?? "",
    brand: promoP.brand,
    model: promoP.model,
    config: promoP.config,
    priceText: fmtPkr(promoP.pricePaisa),
    rows: (
      [
        ["Processor", promoP.specs.Processor],
        ["Display", promoP.specs.Display],
        ["Graphics", promoP.specs.Graphics],
        ["OS", promoP.specs["Operating system"]],
      ] as [string, string | undefined][]
    )
      .filter((r): r is [string, string] => !!r[1])
      .map(([k, v]) => ({ k, v })),
  };

  let cmpDemo: CmpDemo | null = null;
  const a = stock[0];
  const b = stock.find((x) => x.brand !== a?.brand) || stock[1];
  if (a && b) {
    const R: [string, (p: V5Product) => string][] = [
      ["Processor", (p) => (p.cpu ? "Core " + p.cpu + (p.gen ? " · " + ord(p.gen) : "") : "—")],
      ["Memory", (p) => (p.ramN ? p.ramN + "GB" : "—")],
      ["Storage", (p) => (p.stoN ? stoFmt(p.stoN) : "—")],
      ["Screen", (p) => (p.size ? p.size + '"' : "—")],
      ["Price", (p) => fmtPkr(p.pricePaisa)],
    ];
    cmpDemo = {
      a: { model: a.model, img: a.imgs[0]?.u ?? null },
      b: { model: b.model, img: b.imgs[0]?.u ?? null },
      rows: R.map(([k, f]) => ({ k, a: f(a), b: f(b), diff: f(a) !== f(b) })),
    };
  }

  const tints = [
    "radial-gradient(90% 70% at 100% 0%,rgba(var(--lh-action-rgb),.12),transparent 70%)",
    "radial-gradient(90% 70% at 100% 0%,rgba(var(--lh-electric-rgb),.14),transparent 70%)",
    "radial-gradient(90% 70% at 100% 0%,rgba(33,89,212,.10),transparent 70%)",
  ];
  const brandTiles = ["Dell", "HP", "Lenovo"].map((name, bi) => {
    const l = stock.filter((p) => p.brand === name);
    const lines = [...new Set(l.map((p) => (p.model.match(/Latitude|XPS|EliteBook|ProBook|ThinkPad/) || [])[0]).filter(Boolean))];
    return {
      name,
      count: l.length,
      fromText: l.length ? fmtPkr(Math.min(...l.map((p) => p.pricePaisa))) : "",
      lines: lines.length ? lines.join(", ") + " models" : "Laptops",
      img: l[0]?.imgs[0]?.u ?? null,
      tint: tints[bi],
      href: "/collections/" + name.toLowerCase(),
    };
  });

  const quickLinks = ["core-i5", "core-i7", "ram-16gb", "gen-10-plus", "touchscreen", "screen-15", "screen-13", "ram-8gb"].map((id) => {
    const l = v5Link(P, id);
    const n = Number(l.count);
    return { ...l, bar: Math.max(4, Math.round((n / lapN) * 100)) + "%", share: Math.round((n / lapN) * 100) + "% of laptops" };
  });
  const newGen = P.filter((p) => (p.gen ?? 0) >= 10);

  return (
    <>
      <CinematicHero
        totalCount={P.length}
        chromebookCount={P.filter((p) => p.cat === "chromebook").length}
        laptopCount={lapN}
        accCount={accN}
        main={{ ...shot(HM, HM_HANDLE, "dell7420-0.png"), priceText: fmtPkr(HM.pricePaisa), stockText: stockText(HM), chips: HM.chips }}
        side1={H1 ? shot(H1, H1_HANDLE, "hp640g2-0.png") : null}
        side2={H2 ? shot(H2, H2_HANDLE, "t580-0.png") : null}
      />
      <ProductStory
        handle={HM.h}
        title={HM.t}
        model={HM.model}
        config={HM.config}
        priceText={fmtPkr(HM.pricePaisa)}
        stockText={stockText(HM)}
        pricePaisa={HM.pricePaisa}
        variantId={HM.variantId}
        maxPerOrder={HM.maxPerOrder}
        available={HM.avail}
        angles={[0, 1, 2, 3].map((i) => {
          const cut = HM.h === HM_HANDLE ? cutoutUrl(`dell7420-${i}.png`) : null;
          return { src: cut || HM.imgs[i]?.u || null, cutout: !!cut };
        })}
        rows={storyRows}
      />
      <ChromebookSection cb={cb} />
      <BrandSection tiles={brandTiles} />
      <FeaturedSection cards={stock.slice(0, 8).map(v5Card)} laptopCount={lapN} brandTotal={brandN} accCount={accN} />
      <PromoSection promo={promo} />
      <SpecSection links={quickLinks} />
      <NewGenSection cards={[...newGen].sort((x, y) => (y.gen ?? 0) - (x.gen ?? 0) || x.i - y.i).slice(0, 10).map(v5Card)} count={newGen.length} />
      <BudgetSection tiles={["under-40k", "40k-60k", "over-60k"].map((id) => v5Link(P, id))} />
      <CompareDemoSection demo={cmpDemo} />
      <HomeInquirySection phones={confirmedPhones().map((p) => ({ display: p.display, href: telHref(p) }))} privacyHref={(await contentVisibility()).pages.privacy ? "/pages/privacy" : null} />
    </>
  );
}
