import type { PublicProduct } from "@/types/catalog";
import type { V5Product } from "@/lib/catalog/v5-model";

/** Build unique product SEO title/description from verified facts only — never invents warranty, ratings, or delivery. */
export function productSeoDefaults(p: {
  title: string;
  brand?: string | null;
  model?: string | null;
  config?: string | null;
  category?: string | null;
  condition?: string | null;
  intro?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
}): { title: string; description: string } {
  const title =
    (p.seoTitle && p.seoTitle.trim()) ||
    [p.brand, p.model || p.title, p.config].filter(Boolean).join(" · ").slice(0, 70) ||
    p.title;

  const fromIntro = (p.intro || "").split(/\n\s*\n/)[0]?.trim() || "";
  const description =
    (p.seoDescription && p.seoDescription.trim()) ||
    (
      fromIntro ||
      [
        p.model || p.title,
        p.config,
        p.condition ? `${p.condition} condition` : null,
        p.category ? `in ${p.category}` : null,
        "listed with verified specifications at Laptops HUB.",
      ]
        .filter(Boolean)
        .join(", ")
    ).slice(0, 160);

  return { title: title.slice(0, 70), description: description.slice(0, 160) };
}

export function productSeoFromPublic(p: PublicProduct): { title: string; description: string } {
  return productSeoDefaults({
    title: p.title,
    brand: p.manufacturer,
    model: p.title,
    category: p.category,
    intro: p.descriptionSafe,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
  });
}

export function productSeoFromV5(p: V5Product & { seoTitle?: string | null; seoDescription?: string | null }): {
  title: string;
  description: string;
} {
  return productSeoDefaults({
    title: p.t,
    brand: p.brand,
    model: p.model,
    config: p.config,
    category: p.catLabel,
    condition: p.cond,
    intro: p.intro,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
  });
}
