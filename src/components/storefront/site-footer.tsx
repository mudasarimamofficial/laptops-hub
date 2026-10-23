import Link from "next/link";
import { Wordmark } from "@/components/storefront/site-header";

/** V5 `footerCols`. */
const FOOTER_COLS = [
  {
    title: "Shop",
    links: [
      { label: "All products", href: "/collections/all" },
      { label: "Laptops", href: "/collections/laptops" },
      { label: "Gaming laptops", href: "/collections/gaming-laptops" },
      { label: "MacBooks", href: "/collections/macbooks" },
      { label: "Chromebooks", href: "/collections/chromebooks" },
      { label: "Tablets & smart devices", href: "/collections/tablets" },
      { label: "Accessories", href: "/collections/accessories" },
    ],
  },
  {
    title: "By brand & spec",
    links: [
      { label: "Dell", href: "/collections/dell" },
      { label: "HP", href: "/collections/hp" },
      { label: "Lenovo", href: "/collections/lenovo" },
      { label: "Core i5", href: "/collections/core-i5" },
      { label: "Core i7", href: "/collections/core-i7" },
      { label: "16GB RAM", href: "/collections/ram-16gb" },
      { label: "Touchscreen", href: "/collections/touchscreen" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Buying guides", href: "/guides" },
      { label: "How to choose", href: "/pages/how-to-choose" },
      { label: "Condition guide", href: "/pages/condition-guide" },
      { label: "FAQ", href: "/pages/faq" },
      { label: "Order inquiries", href: "/pages/order-inquiries" },
      { label: "Contact us", href: "/pages/contact" },
    ],
  },
  {
    title: "Policies",
    links: [
      { label: "Shipping & delivery", href: "/pages/shipping" },
      { label: "Returns & refunds", href: "/pages/returns" },
      { label: "Warranty", href: "/pages/warranty" },
      { label: "Privacy policy", href: "/pages/privacy" },
      { label: "Terms & conditions", href: "/pages/terms" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Laptops HUB", href: "/pages/about" },
      { label: "Why Laptops HUB", href: "/pages/why-laptops-hub" },
      { label: "Compare", href: "/compare" },
      { label: "Cart", href: "/cart" },
    ],
  },
];

export function SiteFooter({ totalCount }: { totalCount: number }) {
  return (
    <footer
      style={{
        position: "relative",
        backgroundColor: "var(--lh-navy)",
        backgroundImage:
          "radial-gradient(40% 80% at 100% 0%,rgba(var(--lh-iris-rgb),.2),transparent 70%),radial-gradient(30% 60% at 0% 100%,rgba(var(--lh-electric-rgb),.14),transparent 70%)",
        color: "var(--lh-on-dark-2)",
        marginTop: "auto",
      }}
    >
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "0 clamp(16px,3vw,32px)" }}>
        <div style={{ height: 2, background: "linear-gradient(90deg,var(--lh-signal) 0,var(--lh-signal) 64px,rgba(var(--lh-haze-rgb),.18) 64px)" }} />
      </div>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "64px clamp(16px,3vw,32px) 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 36 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Link href="/" aria-label="Laptops HUB home" style={{ display: "flex", alignItems: "center", gap: 7, color: "#FFFFFF" }}>
            <Wordmark size={22} onDark />
          </Link>
          <span style={{ fontSize: 14, lineHeight: 1.55, maxWidth: "30ch", color: "var(--lh-on-dark-2)" }}>
            Used Dell, HP and Lenovo laptops. Prices in PKR. Chromebook collection in preparation.
          </span>
        </div>
        {FOOTER_COLS.map((col) => (
          <div key={col.title} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--lh-electric-text)" }}>{col.title}</span>
            {col.links.map((l) => (
              <Link key={l.href} href={l.href} className="v5-hov-electric-text" style={{ fontSize: 14, color: "var(--lh-on-dark-2)" }}>
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "20px clamp(16px,3vw,32px) 32px", borderTop: "1px solid rgba(255,255,255,.08)", fontSize: 12, color: "var(--lh-on-dark-3)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span>© Laptops HUB</span>
        <span style={{ fontFamily: "var(--font-mono)" }}>{totalCount} products in the catalog</span>
      </div>
    </footer>
  );
}
