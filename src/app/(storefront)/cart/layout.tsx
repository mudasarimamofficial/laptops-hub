import type { Metadata } from "next";

/**
 * /cart shows the visitor's own cart (stored in their browser), so it has no shareable content of its own: keep it
 * out of search results (links stay followable), like /compare, /checkout and /track-order. robots.txt already
 * disallows crawling it; this also covers links Google finds elsewhere.
 */
export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false, follow: true },
  alternates: { canonical: "/cart" },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
