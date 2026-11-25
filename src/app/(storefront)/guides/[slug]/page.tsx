import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ogDefaults } from "@/lib/seo/og";
import { ContentPage } from "@/components/content/content-page";
import { getArticle } from "@/lib/content/pages";
import { canonicalFor, robotsFor, siteUrl } from "@/lib/site-url";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo/content-jsonld";
import { jsonLdScript, SHARE_IMAGE_PATH } from "@/lib/seo/site-jsonld";

// Publication is checked on every request (see src/lib/content/pages.ts).
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const a = await getArticle(slug, true);
  return a && (a.mode !== "gated" || a.preview) ? a : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await load(slug);
  if (!a) return { title: "Not found", robots: { index: false } }; // overrides the layout default (Next adds its own noindex too)
  // Admin → Blog search title/description/share image when set; otherwise the guide's own title and intro.
  const title = a.article?.seoTitle || a.title;
  const description = a.article?.seoDescription || a.intro;
  const image = a.article?.image || SHARE_IMAGE_PATH;
  return {
    title,
    description,
    alternates: canonicalFor(`/guides/${slug}`),
    robots: robotsFor(a.preview),
    openGraph: {
      ...(await ogDefaults()),
      type: "article",
      url: `/guides/${slug}`,
      title,
      description,
      images: [{ url: image }],
      ...(a.article?.publishedAt ? { publishedTime: a.article.publishedAt } : {}),
      ...(a.article?.modifiedAt ? { modifiedTime: a.article.modifiedAt } : {}),
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const a = await load(slug);
  if (!a) notFound();
  const origin = siteUrl();
  const path = `/guides/${slug}`;
  const ld = [
    articleJsonLd(origin, path, a.article?.seoTitle || a.title, a.article?.seoDescription || a.intro, a.article),
    breadcrumbJsonLd(origin, [
      { name: "Home", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: a.title, path },
    ]),
  ];
  return (
    <>
      {a.preview ? null : <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(ld) }} />}
      <ContentPage page={a} kind="article" />
    </>
  );
}
