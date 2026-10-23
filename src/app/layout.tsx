import type { Metadata } from "next";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";
import { CompareTray } from "@/components/storefront/compare-tray";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Laptops HUB",
    template: "%s · Laptops HUB",
  },
  description:
    "Independent Pakistan electronics store. Laptops, Chromebooks, accessories. Cash on Delivery only.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-PK">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Sora:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="flex min-h-screen flex-col antialiased"
        style={
          {
            ["--font-sora" as string]: '"Sora"',
            ["--font-hanken" as string]: '"Hanken Grotesk"',
            ["--font-jetbrains" as string]: '"JetBrains Mono"',
          } as React.CSSProperties
        }
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <CompareTray />
        <CartDrawer />
      </body>
    </html>
  );
}
