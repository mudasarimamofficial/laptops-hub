import Link from "next/link";

/** Slim sitewide promo bar — shown only when an active automatic campaign requests it. */
export function PromoAnnouncement({
  text,
  href = "/collections/all",
  ctaLabel = "Shop now",
}: {
  text: string;
  href?: string;
  /** Theme editor → Header & footer → Promotion bar button. */
  ctaLabel?: string;
}) {
  if (!text.trim()) return null;
  return (
    <div
      role="region"
      aria-label="Store promotion"
      className="lh-promo-bar"
      style={{
        background: "linear-gradient(90deg, #0A1730 0%, #1748B5 55%, #2159D4 100%)",
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.02em",
        textAlign: "center",
        padding: "9px 14px",
        lineHeight: 1.35,
      }}
    >
      <Link href={href} style={{ color: "inherit", textDecoration: "none" }}>
        {text.trim()}
        <span aria-hidden="true" className="lh-promo-cta" style={{ marginLeft: 8, opacity: 0.85 }}>
          → {ctaLabel}
        </span>
      </Link>
    </div>
  );
}
