import Link from "next/link";
import { Wordmark } from "@/components/storefront/site-header";
import { publicLinks, type Visibility } from "@/lib/content/links";
import type { FooterNavColumn } from "@/lib/content/navigation";
import {
  enabledPhones,
  enabledSocial,
  mailtoHref,
  telHref,
  type ContactSocialSettings,
} from "@/lib/content/contact-social";
import { IconMail, IconPhone, IconPin, IconWhatsApp, socialIcon } from "@/components/storefront/social-icons";
import { DEFAULT_THEME_GLOBALS, type ThemeGlobals } from "@/lib/content/theme-globals";

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

const monoLabel = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: ".1em",
  textTransform: "uppercase" as const,
  color: "var(--lh-electric-text)",
};

export function SiteFooter({
  totalCount,
  showCounts = false,
  vis,
  footerCols,
  contact,
  globals = DEFAULT_THEME_GLOBALS,
}: {
  totalCount: number;
  showCounts?: boolean;
  vis: Visibility;
  footerCols?: FooterNavColumn[];
  contact: ContactSocialSettings;
  /** Published site-wide copy (theme editor → Header & footer). */
  globals?: ThemeGlobals;
}) {
  const source = footerCols && footerCols.length > 0 ? footerCols : FOOTER_COLS;
  const cols = source.map((c) => ({ ...c, links: publicLinks(c.links, vis) })).filter((c) => c.links.length > 0);
  const phones = enabledPhones(contact);
  const social = enabledSocial(contact);
  const year = new Date().getFullYear();

  return (
    <footer
      data-testid="site-footer"
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

      <div
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          padding: "56px clamp(16px,3vw,32px) 28px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))",
          gap: "36px 28px",
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 360 }}>
          <Link href="/" aria-label="Laptops HUB home" style={{ display: "flex", alignItems: "center", gap: 7, color: "#FFFFFF" }}>
            <Wordmark size={22} onDark />
          </Link>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--lh-on-dark-2)" }}>
            {globals.footerTagline}
          </p>
          {social.length ? (
            <div>
              <p data-testid="footer-social-heading" style={{ ...monoLabel, margin: "0 0 12px" }}>
                {contact.socialHeading}
              </p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 10 }}>
                {social.map((s) => (
                  <li key={s.id}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${s.label} — opens in a new tab`}
                      data-testid={`footer-social-${s.id}`}
                      data-social-url={s.url}
                      className="v5-hov-bright"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        display: "grid",
                        placeItems: "center",
                        color: "#FFFFFF",
                        background: "rgba(255,255,255,.08)",
                        border: "1px solid rgba(255,255,255,.14)",
                        transition: "background .18s ease,border-color .18s ease,transform .18s ease",
                      }}
                    >
                      {socialIcon(s.id)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {cols.slice(0, 3).map((col) => (
          <div key={col.title} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <span style={monoLabel}>{col.title}</span>
            {col.links.map((l) => (
              <Link key={l.href} href={l.href} className="v5-hov-electric-text" style={{ fontSize: 14, color: "var(--lh-on-dark-2)" }}>
                {l.label}
              </Link>
            ))}
          </div>
        ))}

        <div data-testid="footer-contact" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <span style={monoLabel}>{globals.footerContactHeading}</span>
          <p style={{ margin: 0, display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.5, color: "var(--lh-on-dark-2)" }}>
            <span style={{ color: "var(--lh-electric-text)", flexShrink: 0, marginTop: 2 }}>
              <IconPin />
            </span>
            <span data-testid="footer-address">{contact.address}</span>
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {phones.map((p) => (
              <li key={p.id}>
                <a
                  href={telHref(p.tel)}
                  data-testid={`footer-phone-${p.id}`}
                  className="v5-hov-electric-text"
                  style={{ display: "inline-flex", alignItems: "center", gap: 10, minHeight: 40, fontSize: 15, fontWeight: 600, color: "#FFFFFF" }}
                >
                  <span style={{ color: "var(--lh-electric-text)" }}>
                    <IconPhone />
                  </span>
                  {p.display}
                </a>
              </li>
            ))}
          </ul>
          <a
            href={mailtoHref(contact.email)}
            data-testid="footer-email"
            className="v5-hov-electric-text"
            style={{ display: "inline-flex", alignItems: "center", gap: 10, minHeight: 40, fontSize: 14, color: "#FFFFFF", wordBreak: "break-all" }}
          >
            <span style={{ color: "var(--lh-electric-text)", flexShrink: 0 }}>
              <IconMail />
            </span>
            {contact.email}
          </a>
          {contact.whatsapp.generalUrl ? (
            <a
              href={contact.whatsapp.generalUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="footer-whatsapp"
              className="v5-hov-bright"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                minHeight: 44,
                padding: "0 14px",
                width: "fit-content",
                borderRadius: 999,
                background: "rgba(37,211,102,.16)",
                border: "1px solid rgba(37,211,102,.45)",
                color: "#FFFFFF",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              <IconWhatsApp size={18} />
              {globals.footerWhatsappLabel}
            </a>
          ) : null}
        </div>
      </div>

      {cols.length > 3 ? (
        <div
          style={{
            maxWidth: 1360,
            margin: "0 auto",
            padding: "0 clamp(16px,3vw,32px) 24px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
            gap: 24,
          }}
        >
          {cols.slice(3).map((col) => (
            <div key={col.title} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <span style={monoLabel}>{col.title}</span>
              {col.links.map((l) => (
                <Link key={l.href} href={l.href} className="v5-hov-electric-text" style={{ fontSize: 14, color: "var(--lh-on-dark-2)" }}>
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <div
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          padding: "18px clamp(16px,3vw,32px) 28px",
          borderTop: "1px solid rgba(255,255,255,.08)",
          fontSize: 12,
          color: "var(--lh-on-dark-3)",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span>
          © {year} {contact.businessName}
        </span>
        {showCounts ? <span style={{ fontFamily: "var(--font-mono)" }}>{totalCount} products in the catalog</span> : null}
      </div>
    </footer>
  );
}
