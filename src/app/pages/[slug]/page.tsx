import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ContentPage } from "@/components/content/content-page";
import { getContentPage } from "@/lib/content/pages";
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
  return { title: page.title, description: page.intro, alternates: canonicalFor(`/pages/${slug}`), robots: robotsFor(page.preview) };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) notFound();
  return <ContentPage page={page} kind="page" />;
}
