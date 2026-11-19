"use client";

import { createContext, useContext } from "react";
import { badgeLabel, type MerchBadge, type MerchBadgeMap } from "@/lib/content/social-proof";

const Ctx = createContext<MerchBadgeMap>({});

/** Server-computed badges (data-backed top sellers + scheduled editorial picks), keyed by product handle. */
export function MerchBadgeProvider({ badges, children }: { badges: MerchBadgeMap; children: React.ReactNode }) {
  return <Ctx.Provider value={badges}>{children}</Ctx.Provider>;
}

export function useMerchBadge(handle: string): MerchBadge | null {
  return useContext(Ctx)[handle] ?? null;
}

function FlameIcon({ soft }: { soft?: boolean }) {
  return (
    <svg className="lh-flame" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill={soft ? "#FFD8B5" : "#FFE7C2"}
        d="M12 2c1 3.5-1.2 5.2-2.6 7C8 10.8 7 12.4 7 14.6 7 18 9.2 21 12 21s5-3 5-6.4c0-2.2-1-3.7-2-5 .1 1.6-.5 2.9-1.6 3.4.4-3.2-.4-7.4-1.4-11z"
      />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
    </svg>
  );
}

/**
 * Distinct from category chips (outlined “Laptop”).
 * - Top seller: warm filled chip + flame (sales-backed only).
 * - Featured + flame: premium fire accent (editorial 🔥 Featured).
 * - Other editorial: solid navy + star so they never read as sales claims.
 */
export function MerchBadgePill({ badge }: { badge: MerchBadge }) {
  const top = badge.kind === "top_seller";
  const featuredFlame = badge.kind === "featured" && (badge.icon ?? "flame") === "flame";
  const fire = top || featuredFlame;

  const style: React.CSSProperties = fire
    ? featuredFlame
      ? {
          background: "linear-gradient(135deg, #C2410C 0%, #EA580C 55%, #F97316 100%)",
          border: "1px solid rgba(255, 237, 213, 0.35)",
          color: "#FFF7ED",
          boxShadow: "0 1px 2px rgba(154, 58, 6, 0.28)",
        }
      : {
          background: "#9A3A06",
          border: "1px solid transparent",
          color: "#FFFFFF",
          boxShadow: "0 1px 2px rgba(10,23,48,.12)",
        }
    : {
        background: "var(--lh-navy, #0A1730)",
        border: "1px solid transparent",
        color: "#FFFFFF",
        boxShadow: "0 1px 2px rgba(10,23,48,.12)",
      };

  return (
    <span
      data-testid="merch-badge"
      data-kind={badge.kind}
      data-icon={fire ? "flame" : "star"}
      title={top ? "Based on recent confirmed orders" : "Chosen by the Laptops HUB team"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".04em",
        textTransform: "uppercase",
        padding: "5px 10px",
        borderRadius: 6,
        whiteSpace: "nowrap",
        flexShrink: 0,
        ...style,
      }}
    >
      {fire ? <FlameIcon soft={top} /> : <StarIcon />}
      {badgeLabel(badge)}
    </span>
  );
}

/** Badge for a given product, or nothing. */
export function MerchBadgeFor({ handle }: { handle: string }) {
  const b = useMerchBadge(handle);
  return b ? <MerchBadgePill badge={b} /> : null;
}
