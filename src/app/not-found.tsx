import type { Metadata } from "next";
import { NotFoundView } from "@/components/storefront/v5/not-found-view";
import StorefrontLayout from "./(storefront)/layout";
import { getPublishedThemeGlobals } from "@/lib/content/published-homepage";
import { getSeoTitleSuffix } from "@/lib/content/seo-defaults-server";
import { titleTemplate } from "@/lib/content/seo-defaults";
import "./globals.css";

// Unmatched URLs (static, server-rendered 404). The shared root layout has no chrome, so this page wraps the V5 404
// in the storefront layout explicitly. Unmatched /admin/* URLs never reach this: app/(admin)/admin/[...missing]
// renders the admin 404 instead.
// The root layout has no title template, so apply the storefront one (Settings → SEO title suffix) here.
export async function generateMetadata(): Promise<Metadata> {
  const title = titleTemplate(await getSeoTitleSuffix()).replace("%s", "Page not found");
  return { title, robots: { index: false, follow: true } };
}

/** Text from the theme editor (Page not found); V5 defaults until the merchant publishes changes. */
export default async function NotFound() {
  const c = await getPublishedThemeGlobals();
  return (
    <StorefrontLayout after={null}>
      <NotFoundView title={c.nfTitle} msg={c.nfText} buttonLabel={c.nfButton} buttonHref={c.nfButtonHref} />
    </StorefrontLayout>
  );
}
