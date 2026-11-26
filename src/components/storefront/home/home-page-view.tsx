import { Fragment, type ReactNode } from "react";
import { CinematicHero, type HeroShot } from "@/components/storefront/home/cinematic-hero";
import { StoreReviews } from "@/components/storefront/home/store-reviews";
import { getPublishedTestimonials } from "@/lib/content/testimonials-server";
import { reviewsSettings } from "@/lib/content/home-sections";
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
import { getContactSocial } from "@/lib/content/contact-social-server";
import { enabledPhones, telHref } from "@/lib/content/contact-social";
import { homeCopy } from "@/lib/content/home-copy";
import { contentVisibility } from "@/lib/content/pages";
import { getStorefrontPresentation } from "@/lib/content/storefront-presentation-server";
import { getPublishedReels } from "@/lib/content/reels-server";
import { ReelsSection } from "@/components/storefront/home/reels-section";
import { getMerchBadges, getSocialProofSettings } from "@/lib/content/social-proof-server";
import { cpuFmt, fmtPkr, getV5Catalog, ord, stoFmt, v5Card, v5Link, type V5Product } from "@/lib/catalog/v5";
import { merchantAlt } from "@/lib/catalog/v5-model";
import { formatProductDisplayName } from "@/lib/catalog/product-display-name";
import { getActiveAutomaticDiscount } from "@/lib/commerce/discounts-server";
import { priceWithCampaign } from "@/lib/commerce/pricing";
import { normalizeHomepageLayout, sectionNumbers } from "@/lib/content/homepage-layout";
import type { SectionInstance, SectionType } from "@/lib/content/site-builder-schema";
import {
  HERO_IMAGE_PRESETS,
  HOMEPAGE_DEFAULT_HANDLES,
  mergeHomepageImageDefaults,
  resolveHeroPresentationImage,
  resolveStoryAngleImage,
  type StoryAngle,
} from "@/lib/content/homepage-image-presets";

/** V5 hero / story products — defaults; a theme layout may override them. */
const DEFAULT_HM = HOMEPAGE_DEFAULT_HANDLES.dell;
const DEFAULT_H1 = HOMEPAGE_DEFAULT_HANDLES.hp;
const DEFAULT_H2 = HOMEPAGE_DEFAULT_HANDLES.lenovo;

const href = (p: V5Product) => "/products/" + encodeURIComponent(p.h);

function heroShot(
  p: V5Product,
  slot: keyof typeof HERO_IMAGE_PRESETS,
  settings?: Record<string, unknown> | null,
): HeroShot {
  const resolved = resolveHeroPresentationImage({
    slot,
    productHandle: p.h,
    settings,
    catalogImageUrl: p.imgs[0]?.u || null,
  });
  const displayName = formatProductDisplayName(p.brand, p.model);
  return {
    href: href(p),
    label: resolved.alt || displayName,
    name: displayName,
    src: resolved.src,
    cutout: resolved.cutout,
  };
}

/**
 * The V5 homepage (everything between the header and the footer), rendered from an ordered section layout.
 * Used by the public homepage (published layout, or `null` → the approved V5 default) and by the staff-only preview
 * (draft / published / default), so the preview is the real storefront rendering, not an approximation.
 * The store map is the last section of every layout but is rendered after the footer (`@after` slot).
 */
export async function HomePageView({ sections }: { sections: SectionInstance[] | null }) {
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

  const [pres, reels, social, testimonials, vis, merchBadges, campaign, contact] = await Promise.all([
    getStorefrontPresentation(),
    getPublishedReels(),
    getSocialProofSettings(),
    getPublishedTestimonials(),
    contentVisibility(),
    getMerchBadges(),
    getActiveAutomaticDiscount().catch(() => null),
    getContactSocial(),
  ]);
  /** Active selling price (campaign applied once). Catalog list prices stay untouched. */
  const sellFmt = (listPaisa: number) => fmtPkr(priceWithCampaign(listPaisa, campaign).sellingPaisa);

  // Without a theme layout every setting stays at the approved V5 defaults (exactly the original composition).
  const fromTheme = sections != null;
  const layout = normalizeHomepageLayout(sections);
  const of = (type: SectionType) => layout.find((s) => s.type === type);
  const heroSec = fromTheme ? layout.find((s) => s.type === "v5_cinematic_hero" && s.enabled) : undefined;
  const storySec = fromTheme ? layout.find((s) => s.type === "v5_product_story" && s.enabled) : undefined;
  const heroSettings = heroSec?.settings
    ? mergeHomepageImageDefaults(heroSec.settings as Record<string, unknown>, "v5_cinematic_hero")
    : null;
  const storySettings = storySec?.settings
    ? mergeHomepageImageDefaults(storySec.settings as Record<string, unknown>, "v5_product_story")
    : null;
  const heroHandles = Array.isArray(heroSettings?.productHandles)
    ? (heroSettings!.productHandles as string[])
    : [];
  const HM_HANDLE = heroHandles[0] || DEFAULT_HM;
  const H1_HANDLE = heroHandles[1] || DEFAULT_H1;
  const H2_HANDLE = heroHandles[2] || DEFAULT_H2;
  const storyHandle =
    typeof storySettings?.productHandle === "string" ? String(storySettings.productHandle) : HM_HANDLE;

  // Ported from V5 renderVals() (home branch).
  const get = (h: string) => P.find((p) => p.h === h);
  const stock = P.filter((p) => p.comp && p.cat !== "tablet" && p.avail);
  const lapN = stock.length;
  const accN = P.filter((p) => p.cat === "accessory").length;
  const brandN = new Set(stock.map((p) => p.brand)).size;
  const HM = get(storyHandle) || get(HM_HANDLE) || stock[0];
  const H1 = get(H1_HANDLE) || stock[1];
  const H2 = get(H2_HANDLE) || stock[2];
  const nums = sectionNumbers(layout);
  const presFor = (type: SectionType) => (nums[type] ? { ...pres, sectionNumber: nums[type] } : pres);
  const reviewsCfg = reviewsSettings(fromTheme ? of("v5_store_reviews")?.settings : undefined);
  /** Merchant copy of a section (published layout only; otherwise the approved V5 text). */
  const copyFor = (type: SectionType) => homeCopy(type, fromTheme ? of(type)?.settings : undefined);

  const hs = HM.specs;
  const os = hs["Operating system"];
  const storyRows = [
    ["DISPLAY", hs.Display ? hs.Display.replace(" Display", "") : null],
    // V5 shows the cleaned processor line for the 7420; other fallbacks derive it from the listing.
    ["PROCESSOR", HM.h === DEFAULT_HM ? "Core i5-1145G7 · 11th gen" : HM.cpu ? cpuFmt(HM.cpu) + (HM.gen ? " · " + ord(HM.gen) + " gen" : "") : null],
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
      ? {
          href: href(c),
          model: formatProductDisplayName(c.brand, c.model),
          img: c.imgs[0]?.u ?? null,
          alt: formatProductDisplayName(c.brand, c.model) + (c.config ? ", " + c.config : ""),
          priceText: sellFmt(c.pricePaisa),
        }
      : { href: "/collections/chromebooks", model: "Chromebooks", img: null, alt: "", priceText: "" },
  };

  const promoP = stock.filter((p) => p.specs.Display).sort((a, b) => (b.gen || 0) - (a.gen || 0) || b.pricePaisa - a.pricePaisa)[0] || P[0];
  const promo = {
    href: href(promoP),
    img: promoP.imgs[0]?.u ?? null,
    alt: merchantAlt(promoP.imgs[0]?.a, promoP.t) || formatProductDisplayName(promoP.brand, promoP.model),
    brand: promoP.brand,
    model: promoP.model,
    config: promoP.config,
    priceText: sellFmt(promoP.pricePaisa),
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
      ["Price", (p) => sellFmt(p.pricePaisa)],
    ];
    cmpDemo = {
      a: { model: formatProductDisplayName(a.brand, a.model), img: a.imgs[0]?.u ?? null },
      b: { model: formatProductDisplayName(b.brand, b.model), img: b.imgs[0]?.u ?? null },
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
      fromText: l.length
        ? fmtPkr(Math.min(...l.map((p) => priceWithCampaign(p.pricePaisa, campaign).sellingPaisa)))
        : "",
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
  const reelsBlock = reels.length ? (
    <ReelsSection
      reels={reels}
      heading={social.reels.heading}
      subtitle={social.reels.subtitle}
      autoplayMuted={social.reels.autoplayMuted}
    />
  ) : (
    <section
      aria-labelledby="reels-placeholder-title"
      data-testid="reels-placeholder"
      style={{ maxWidth: 1360, margin: "0 auto", padding: "clamp(40px,5vw,72px) clamp(16px,3vw,32px) 0" }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".12em", color: "var(--lh-ink-2)" }}>
        <span style={{ width: 12, height: 2, background: "var(--lh-signal)" }} />
        REELS
      </span>
      <h2 id="reels-placeholder-title" style={{ margin: "10px 0 0", fontFamily: "var(--font-display)", fontSize: "clamp(28px,3vw,44px)", letterSpacing: "-.035em", fontWeight: 700 }}>
        {social.reels.heading}
      </h2>
      <p style={{ marginTop: 12, maxWidth: 42 + "rem", fontSize: 15, lineHeight: 1.55, color: "var(--lh-ink-2)" }}>
        Short videos will appear here once published with confirmed media rights. Nothing is hidden as live content until then.
      </p>
    </section>
  );

  const render: Record<SectionType, () => ReactNode> = {
    v5_cinematic_hero: () => {
      const heroMain = get(HM_HANDLE) || HM;
      return (
        <CinematicHero
          pres={pres}
          totalCount={P.length}
          chromebookCount={P.filter((p) => p.cat === "chromebook").length}
          laptopCount={lapN}
          accCount={accN}
          main={{
            ...heroShot(heroMain, "main", heroSettings),
            priceText: sellFmt(heroMain.pricePaisa),
            stockText: stockText(heroMain),
            chips: heroMain.chips,
          }}
          side1={H1 ? heroShot(H1, "side1", heroSettings) : null}
          side2={H2 ? heroShot(H2, "side2", heroSettings) : null}
          copy={copyFor("v5_cinematic_hero")}
        />
      );
    },
    v5_product_story: () => (
      <ProductStory
        pres={presFor("v5_product_story")}
        handle={HM.h}
        title={HM.t}
        model={formatProductDisplayName(HM.brand, HM.model)}
        config={HM.config}
        priceText={sellFmt(HM.pricePaisa)}
        stockText={stockText(HM)}
        pricePaisa={HM.pricePaisa}
        variantId={HM.variantId}
        maxPerOrder={HM.maxPerOrder}
        available={HM.avail}
        hasOptions={HM.hasOptions}
        angles={(["front", "left", "right", "rear"] as StoryAngle[]).map((angle, i) => {
          const resolved = resolveStoryAngleImage({
            angle,
            productHandle: HM.h,
            settings: storySettings,
            catalogImageUrl: HM.imgs[i]?.u || null,
          });
          return { src: resolved.src, cutout: resolved.cutout };
        })}
        rows={storyRows}
        copy={copyFor("v5_product_story")}
      />
    ),
    v5_chromebook: () => <ChromebookSection cb={cb} pres={presFor("v5_chromebook")} copy={copyFor("v5_chromebook")} />,
    v5_brand_grid: () => <BrandSection tiles={brandTiles} pres={presFor("v5_brand_grid")} copy={copyFor("v5_brand_grid")} />,
    v5_featured_products: () => {
      // Prefer staff-assigned Featured badges; fill remaining slots from available catalog stock.
      const featuredHandles = new Set(
        Object.entries(merchBadges)
          .filter(([, b]) => b.kind === "featured")
          .map(([h]) => h),
      );
      const featuredFirst = [
        ...stock.filter((p) => featuredHandles.has(p.h)),
        ...stock.filter((p) => !featuredHandles.has(p.h)),
      ].slice(0, 8);
      return (
        <FeaturedSection
          cards={featuredFirst.map(v5Card)}
          laptopCount={lapN}
          brandTotal={brandN}
          accCount={accN}
          pres={presFor("v5_featured_products")}
          copy={copyFor("v5_featured_products")}
        />
      );
    },
    v5_promo: () => <PromoSection promo={promo} pres={presFor("v5_promo")} copy={copyFor("v5_promo")} />,
    v5_spec_filters: () => <SpecSection links={quickLinks} pres={presFor("v5_spec_filters")} copy={copyFor("v5_spec_filters")} />,
    v5_new_gen: () => (
      <NewGenSection
        pres={presFor("v5_new_gen")}
        cards={[...newGen].sort((x, y) => (y.gen ?? 0) - (x.gen ?? 0) || x.i - y.i).slice(0, 10).map(v5Card)}
        count={newGen.length}
        copy={copyFor("v5_new_gen")}
      />
    ),
    v5_budget_bands: () => <BudgetSection tiles={["under-40k", "40k-60k", "over-60k"].map((id) => v5Link(P, id))} pres={presFor("v5_budget_bands")} copy={copyFor("v5_budget_bands")} />,
    v5_compare_demo: () => <CompareDemoSection demo={cmpDemo} pres={presFor("v5_compare_demo")} copy={copyFor("v5_compare_demo")} />,
    // Published store testimonials only; nothing renders when there are none.
    v5_store_reviews: () =>
      testimonials.length ? (
        <StoreReviews
          reviews={testimonials}
          heading={reviewsCfg.heading}
          intro={reviewsCfg.intro}
          googleProfileUrl={reviewsCfg.googleProfileUrl}
        />
      ) : null,
    v5_home_inquiry: () => (
      <HomeInquirySection
        // Same phone list as the footer (Admin → Settings → Contact & social), so one edit updates both.
        phones={enabledPhones(contact).map((p) => ({ display: p.display, href: telHref(p.tel) }))}
        privacyHref={vis.pages.privacy ? "/pages/privacy" : null}
        showSectionNumbers={pres.showSectionNumbers}
        sectionNumber={nums.v5_home_inquiry}
        copy={copyFor("v5_home_inquiry")}
      />
    ),
    v5_store_map: () => null, // rendered after the footer
    rich_text: () => null,
    image_banner: () => null,
  };

  return (
    <>
      {layout.map((s) => (
        <Fragment key={s.type}>
          {s.enabled ? render[s.type]() : null}
          {/* Published, rights-cleared reels (admin → Reels) follow the featured laptops, as in V5. */}
          {s.type === "v5_featured_products" ? reelsBlock : null}
        </Fragment>
      ))}
    </>
  );
}
