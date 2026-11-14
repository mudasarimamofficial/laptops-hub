import type { Metadata } from "next";
import { NotFoundView } from "@/components/storefront/v5/not-found-view";
import StorefrontLayout from "./(storefront)/layout";
import "./globals.css";

// Unmatched URLs (static, server-rendered 404). The shared root layout has no chrome, so this page wraps the V5 404
// in the storefront layout explicitly. Unmatched /admin/* URLs never reach this: app/(admin)/admin/[...missing]
// renders the admin 404 instead.
export const metadata: Metadata = { title: "Page not found · Laptops HUB", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <StorefrontLayout>
      <NotFoundView title="This page doesn’t exist" msg="The link may be out of date. Try the catalog or search for a model." />
    </StorefrontLayout>
  );
}
