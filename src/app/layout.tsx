import type { Metadata } from "next";
import { fontVariables } from "@/fonts";
import { siteUrl } from "@/lib/site-url";
import { AuthHashSessionBridge } from "@/components/auth/auth-hash-session-bridge";

// Minimal shared root: <html>/<body> and self-hosted fonts only. It renders NO storefront or admin chrome.
// Layout ownership is split below it: app/(storefront)/layout.tsx owns all public chrome (header, footer, compare
// tray, cart drawer, toast, V5 CSS); app/(admin)/layout.tsx owns the merchant console (admin CSS, no public chrome,
// no catalog/mega-menu queries). A single root keeps not-found boundaries server-rendered.
export const metadata: Metadata = { metadataBase: new URL(siteUrl()) };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-PK" className={fontVariables}>
      <body className="flex min-h-screen flex-col antialiased">
        <AuthHashSessionBridge />
        {children}
      </body>
    </html>
  );
}
