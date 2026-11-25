import type { PublicProduct } from "@/types/catalog";
import type { V5Product } from "@/lib/catalog/v5-model";
import {
  collapseAdjacentDuplicateWords,
  formatProductDisplayName,
  formatProductSeoTitleParts,
} from "@/lib/catalog/product-display-name";

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
  const generated = formatProductSeoTitleParts({
    brand: p.brand,
    model: p.model,
    title: p.title,
    config: p.config,
  });
  const title =
    (p.seoTitle && collapseAdjacentDuplicateWords(p.seoTitle.trim())) ||
    generated.slice(0, 70) ||
    p.title;

  const displayName = formatProductDisplayName(p.brand, p.model || p.title);
  const fromIntro = (p.intro || "").split(/\n\s*\n/)[0]?.trim() || "";
  const description =
    (p.seoDescription && p.seoDescription.trim()) ||
    (
      fromIntro ||
      [
        displayName,
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

/**
 * Products whose search titles are identical (case-insensitive). Google treats them as competing copies of one page,
 * so Admin → SEO lists them for the merchant to tell apart (a distinct SEO title) or archive a true duplicate.
 * Largest groups first; nothing is changed automatically.
 */
export function sharedSearchTitles<T>(items: T[], titleOf: (item: T) => string): { title: string; items: T[] }[] {
  const groups = new Map<string, { title: string; items: T[] }>();
  for (const item of items) {
    const title = titleOf(item).trim();
    if (!title) continue;
    const key = title.toLowerCase();
    const g = groups.get(key);
    if (g) g.items.push(item);
    else groups.set(key, { title, items: [item] });
  }
  return [...groups.values()].filter((g) => g.items.length > 1).sort((a, b) => b.items.length - a.items.length || a.title.localeCompare(b.title));
}
