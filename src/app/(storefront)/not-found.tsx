import type { Metadata } from "next";
import { NotFoundView } from "@/components/storefront/v5/not-found-view";

// The 404 page renders under the root layout; without its own robots it inherits "index, follow".
export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: true } };

export default function NotFound() {
  return <NotFoundView title="This page doesn’t exist" msg="The link may be out of date. Try the catalog or search for a model." />;
}
