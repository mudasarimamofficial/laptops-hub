import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ContentPage } from "@/components/content/content-page";
import { getContentPage, PAGE_SLUGS } from "@/lib/content/pages";
import { canonicalFor, robotsFor } from "@/lib/site-url";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return PAGE_SLUGS.map((slug) => ({ slug }));
}

// Unpublished (gated) and preview-only content is never indexed.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getContentPage(slug);
  if (!page) return { title: "Not found", robots: { index: false } };
  return { title: page.title, description: page.mode === "gated" ? undefined : page.intro, alternates: canonicalFor(`/pages/${slug}`), robots: robotsFor(page.mode === "gated" || page.preview) };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const page = await getContentPage(slug);
  if (!page) notFound();
  return <ContentPage page={page} kind="page" />;
}
