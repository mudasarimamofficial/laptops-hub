import type { Metadata } from "next";

/**
 * /compare shows the visitor's own comparison tray (stored in their browser), so it has no shareable content of its
 * own: keep it out of search results (links stay followable) and out of the sitemap.
 */
export const metadata: Metadata = {
  title: "Compare laptops",
  robots: { index: false, follow: true },
  alternates: { canonical: "/compare" },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
