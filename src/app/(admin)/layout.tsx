import type { Metadata, Viewport } from "next";
import "../admin.css";

// Merchant admin layout. Independent of app/(storefront)/layout.tsx: no SiteHeader/SiteFooter/CompareTray/
// CartDrawer/Toast, no V5 storefront CSS, no public catalog/mega-menu queries.
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Laptops HUB Admin" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: "#0b1528" };

export default function AdminGroupLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
