import type { Page } from "@playwright/test";

type Node = Record<string, unknown>;

/**
 * All JSON-LD nodes on the page, with `@graph` arrays flattened. The storefront layout emits a site-wide
 * Organization/WebSite block before any page-specific block, and product pages use `@graph`
 * (BreadcrumbList + Product), so tests must not read "the first script" and expect a Product.
 */
export async function jsonLdNodes(page: Page): Promise<Node[]> {
  const texts = await page.locator('script[type="application/ld+json"]').allTextContents();
  const out: Node[] = [];
  for (const t of texts) {
    let data: unknown;
    try {
      data = JSON.parse(t);
    } catch {
      continue;
    }
    for (const item of Array.isArray(data) ? data : [data]) {
      if (!item || typeof item !== "object") continue;
      const graph = (item as Node)["@graph"];
      if (Array.isArray(graph)) out.push(...(graph.filter((g) => g && typeof g === "object") as Node[]));
      else out.push(item as Node);
    }
  }
  return out;
}

/** The page's Product node, or null when the page has none. */
export async function productJsonLd(page: Page): Promise<Node | null> {
  return (await jsonLdNodes(page)).find((n) => n["@type"] === "Product") ?? null;
}
