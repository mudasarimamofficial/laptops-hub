import type { Metadata } from "next";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader, type ChromeData } from "@/components/storefront/site-header";
import { fmtPkr, getV5Catalog, v5Menu } from "@/lib/catalog/v5";
import { contentVisibility } from "@/lib/content/pages";
import { publicLinks, supportHref, type Visibility } from "@/lib/content/links";
import { isPrelaunch, siteMode } from "@/lib/site-url";
import { PrelaunchNotice } from "@/components/storefront/prelaunch-notice";
import { CompareTray } from "@/components/storefront/compare-tray";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { Toast } from "@/components/storefront/v5/toast";
import "../globals.css";

export const metadata: Metadata = {
  title: {
    default: "Laptops HUB",
    template: "%s · Laptops HUB",
  },
  description:
    // V5 approved hero copy.
    "Laptops from Dell, HP, Lenovo and more, with the processor, memory, storage and display listed on every page. Filter by spec, then compare up to four side by side.",
  // Pre-launch: noindex but followable, matching the X-Robots-Tag header (next.config.ts).
  robots: isPrelaunch() ? { index: false, follow: true } : { index: true, follow: true },
};

import {
  getPublishedNavigation,
  sanitizePublicFooterColumns,
  sanitizePublicNavLinks,
  type NavigationConfig,
} from "@/lib/content/navigation";

/** Header/footer data: V5 menu counts, the mega-menu feature (first listed laptop), public content links. */
async function loadChrome(vis: Visibility, navConfig: NavigationConfig): Promise<ChromeData> {
  const support = supportHref(vis);
  const publicNav = sanitizePublicNavLinks(navConfig.headerNav, vis);
  try {
    const P = await getV5Catalog();
    const p = P.find((x) => x.comp && x.cat !== "tablet" && x.avail);
    return {
      menu: v5Menu(P)
        .map((g) => ({ ...g, items: publicLinks(g.items, vis) }))
        .filter((g) => g.items.length > 0),
      supportHref: support,
      guidesPublic: Object.values(vis.articles).some(Boolean),
      totalCount: P.length,
      navLinks: publicNav,
      megaFeat: p
        ? {
            href: "/products/" + encodeURIComponent(p.h),
            img: p.imgs[0]?.u ?? null,
            model: p.model,
            priceText: fmtPkr(p.pricePaisa),
            stockText: (p.cond ? p.cond + " " : "") + p.badge.toUpperCase(),
          }
        : null,
    };
  } catch {
    return {
      menu: [],
      megaFeat: null,
      totalCount: 0,
      supportHref: support,
      guidesPublic: Object.values(vis.articles).some(Boolean),
      navLinks: publicNav,
    };
  }
}

/** Storefront layout: owns all public chrome. /admin has its own layout in app/(admin) and never renders this. */
export default async function StorefrontLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const mode = siteMode();
  // Restricted pre-launch: no storefront chrome and no catalog query (the header's mega menu shows a product photo).
  if (mode === "restricted") {
    return (
      <main id="main" className="flex-1">
        {children}
      </main>
    );
  }
  const [vis, navConfig] = await Promise.all([contentVisibility(), getPublishedNavigation()]);
  const chrome = await loadChrome(vis, navConfig);
  const publicFooterCols = sanitizePublicFooterColumns(navConfig.footerColumns, vis);
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      {mode === "prelaunch" ? <PrelaunchNotice /> : null}
      <SiteHeader chrome={chrome} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter totalCount={chrome.totalCount} vis={vis} footerCols={publicFooterCols} />
      <CompareTray />
      <CartDrawer />
      <Toast />
    </>
  );
}
