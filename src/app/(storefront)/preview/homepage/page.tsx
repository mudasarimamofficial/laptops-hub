import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomePageView } from "@/components/storefront/home/home-page-view";
import { PreviewBar } from "@/components/storefront/home/preview-bar";
import { loadHomepagePreview, publishedThemesEnabled } from "@/lib/content/homepage-preview-server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Homepage preview",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Staff-only full homepage preview, rendered inside the real storefront layout (header, footer, map after the
 * footer) by the same renderer as the public homepage. `?v=draft` (default) | `published` | `default`.
 * Anyone who is not owner/admin/editor gets a plain 404; the response is never cached (next.config.ts headers).
 */
export default async function HomepagePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; embed?: string }>;
}) {
  const { v, embed } = await searchParams;
  const src = await loadHomepagePreview(v);
  if (!src) notFound();
  return (
    <>
      {embed === "1" ? null : <PreviewBar src={src} flagOn={publishedThemesEnabled()} />}
      <HomePageView sections={src.sections} />
    </>
  );
}
