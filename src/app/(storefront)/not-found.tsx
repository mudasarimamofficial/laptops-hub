import type { Metadata } from "next";
import { NotFoundView } from "@/components/storefront/v5/not-found-view";
import { getPublishedThemeGlobals } from "@/lib/content/published-homepage";

// The 404 page renders under the root layout; without its own robots it inherits "index, follow".
export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: true } };

/** Text from the theme editor (Page not found); V5 defaults until the merchant publishes changes. */
export default async function NotFound() {
  const c = await getPublishedThemeGlobals();
  return <NotFoundView title={c.nfTitle} msg={c.nfText} buttonLabel={c.nfButton} buttonHref={c.nfButtonHref} />;
}
