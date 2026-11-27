import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { ogDefaults } from "@/lib/seo/og";
import { ContentPage } from "@/components/content/content-page";
import { getContentPage, getContentRedirect } from "@/lib/content/pages";
import { canonicalFor, robotsFor } from "@/lib/site-url";

// Publication (and legal approval) is checked on every request: a withdrawn policy is never served from a cache.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/** Public page, or null when it does not exist or is not published (gated pages are not public: 404). */
async function load(slug: string) {
  const page = await getContentPage(slug, true);
  return page && (page.mode !== "gated" || page.preview) ? page : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) return { title: "Not found", robots: { index: false } }; // overrides the layout default (Next adds its own noindex too)
  // G19: search fields from Admin → Content win; otherwise the page title and introduction (as before).
  const title = page.seo?.title || page.title;
  const description = page.seo?.description || page.intro || undefined;
  return {
    title,
    description,
    alternates: canonicalFor(`/pages/${slug}`),
    robots: robotsFor(page.preview),
    openGraph: { ...(await ogDefaults()), type: "website", url: `/pages/${slug}`, title, description },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) {
    // G19: an address that was changed in admin points to the page's current address (308, keeps search ranking).
    const to = await getContentRedirect(slug).catch(() => null);
    if (to && to !== slug) permanentRedirect(`/pages/${to}`);
    notFound();
  }
  return <ContentPage page={page} kind="page" />;
}
