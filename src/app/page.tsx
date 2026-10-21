import { CinematicHero } from "@/components/storefront/home/cinematic-hero";
import { ProductStory } from "@/components/storefront/home/product-story";
import {
  BrandSection,
  BudgetSection,
  ChromebookSection,
  CompareTeaser,
  FeaturedSection,
} from "@/components/storefront/home/home-sections";
import { PendingBlock } from "@/components/ui/pending-block";
import { listAllPublicProducts, countPublicProducts, getPublicProductByHandle } from "@/lib/catalog/queries";
import { COLLECTION_DEFS } from "@/lib/collections/definitions";

export const revalidate = 60;

export default async function HomePage() {
  let products: Awaited<ReturnType<typeof listAllPublicProducts>> = [];
  let count = 0;
  let story = await getPublicProductByHandle(
    "dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage",
  ).catch(() => null);
  const chromebook = await getPublicProductByHandle("hp-chromebook-14-g5-4-32").catch(() => null);
  let catalogError: string | null = null;

  try {
    [products, count] = await Promise.all([listAllPublicProducts(), countPublicProducts()]);
  } catch (e) {
    catalogError = e instanceof Error ? e.message : "Catalog unavailable";
  }

  if (!story && products[0]) story = products[0];

  const laptopCount = products.filter((p) => COLLECTION_DEFS.find((c) => c.slug === "laptops")?.match(p)).length;
  const accessoryCount = products.filter((p) => COLLECTION_DEFS.find((c) => c.slug === "accessories")?.match(p)).length;

  const brandSlugs = ["dell", "hp", "lenovo", "apple", "microsoft"] as const;
  const brands = brandSlugs
    .map((slug) => {
      const def = COLLECTION_DEFS.find((c) => c.slug === slug)!;
      return { slug, name: def.title, count: products.filter(def.match).length };
    })
    .filter((b) => b.count > 0);

  const featured = [
    ...products.filter((p) => p.featured),
    ...products.filter(
      (p) => !p.featured && COLLECTION_DEFS.find((c) => c.slug === "laptops")?.match(p),
    ),
  ]
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
    .slice(0, 8);
  const heroImg = story?.images[0];

  const storySpecs = story
    ? [
        { k: "CPU", v: String(story.specs.cpu || story.specs.processor || "See product page") },
        { k: "RAM", v: String(story.specs.ram || "See product page") },
        { k: "STORAGE", v: String(story.specs.storage || story.specs.sto || "See product page") },
        { k: "DISPLAY", v: String(story.specs.size || story.specs.screen || "See product page") },
      ]
    : [];

  return (
    <>
      <CinematicHero
        totalCount={count || products.length}
        laptopCount={laptopCount}
        accessoryCount={accessoryCount}
        heroImageUrl={heroImg?.url}
        heroAlt={heroImg?.alt || story?.title}
      />

      {story ? (
        <ProductStory
          handle={story.handle}
          title={story.title}
          model={String(story.specs.model || story.title.split(" - ")[0] || "Latitude 7420")}
          config={String(story.specs.config || `${story.specs.ram || ""} · ${story.specs.storage || story.specs.sto || ""}`.trim())}
          pricePaisa={story.pricePaisa}
          variantId={story.variantId}
          specs={storySpecs}
          images={story.images.map((img) => ({ src: img.url, alt: img.alt || story!.title }))}
        />
      ) : null}

      {catalogError ? (
        <div className="lh-container py-12">
          <PendingBlock title="Catalog temporarily unavailable">{catalogError}</PendingBlock>
        </div>
      ) : (
        <>
          <BrandSection brands={brands} />
          <FeaturedSection products={featured} />
          <BudgetSection />
          <ChromebookSection
            product={chromebook}
            blurb={
              chromebook
                ? `The ${chromebook.title} is in the catalog. Specs that are not yet owner-verified stay blank rather than invented.`
                : "Chromebook listings appear here when published in the catalog."
            }
          />
          <CompareTeaser />
        </>
      )}

      <section className="lh-content pb-[var(--lh-section)]">
        <PendingBlock title="Policies & store contact">
          Shipping, returns, warranty and store contact details remain pending owner approval. We will not invent
          business claims. Configure them in admin CMS before public launch.
        </PendingBlock>
      </section>
    </>
  );
}
