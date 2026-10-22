import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Sora } from "next/font/google";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader, type ChromeData } from "@/components/storefront/site-header";
import { fmtPkr, getV5Catalog, v5Menu } from "@/lib/catalog/v5";
import { siteUrl } from "@/lib/site-url";
import { CompareTray } from "@/components/storefront/compare-tray";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { Toast } from "@/components/storefront/v5/toast";
import "./globals.css";

// V5 font set and weights (Google Fonts request in the V5 <helmet>), self-hosted for deterministic metrics.
const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-hanken", display: "swap" });
const sora = Sora({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-sora", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Laptops HUB",
    template: "%s · Laptops HUB",
  },
  description:
    // V5 approved hero copy.
    "Laptops from Dell, HP, Lenovo and more, with the processor, memory, storage and display listed on every page. Filter by spec, then compare up to four side by side.",
  robots: { index: true, follow: true },
};

/** Header/footer data: V5 menu counts and the mega-menu feature (first listed laptop). */
async function loadChrome(): Promise<ChromeData> {
  try {
    const P = await getV5Catalog();
    const p = P.find((x) => x.comp && x.cat !== "tablet" && x.avail);
    return {
      menu: v5Menu(P),
      totalCount: P.length,
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
    return { menu: [], megaFeat: null, totalCount: 0 };
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const chrome = await loadChrome();
  return (
    <html lang="en-PK" className={`${hanken.variable} ${sora.variable} ${jetbrains.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <SiteHeader chrome={chrome} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter totalCount={chrome.totalCount} />
        <CompareTray />
        <CartDrawer />
        <Toast />
      </body>
    </html>
  );
}
