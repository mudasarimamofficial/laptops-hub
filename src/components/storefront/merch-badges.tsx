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

/**
 * Two deliberately different looks: the data-backed "Top seller" carries a small flame (animated only when motion is
 * allowed); editorial picks use a plain outlined star so they never read as a sales claim.
 */
export function MerchBadgePill({ badge }: { badge: MerchBadge }) {
  const top = badge.kind === "top_seller";
  return (
    <span
      data-testid="merch-badge"
      data-kind={badge.kind}
      title={top ? "Based on recent confirmed orders" : "Chosen by the Laptops HUB team"}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", padding: "5px 10px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0, background: top ? "#FFF4EC" : "#FFFFFF", border: `1px solid ${top ? "#F6C3A0" : "#BCD0F2"}`, color: top ? "#9A3A06" : "#1748B5" }}
    >
      {top ? (
        <svg className="lh-flame" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#E8590C" d="M12 2c1 3.5-1.2 5.2-2.6 7C8 10.8 7 12.4 7 14.6 7 18 9.2 21 12 21s5-3 5-6.4c0-2.2-1-3.7-2-5 .1 1.6-.5 2.9-1.6 3.4.4-3.2-.4-7.4-1.4-11z" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
        </svg>
      )}
      {badgeLabel(badge)}
    </span>
  );
}

/** Badge for a given product, or nothing. */
export function MerchBadgeFor({ handle }: { handle: string }) {
  const b = useMerchBadge(handle);
  return b ? <MerchBadgePill badge={b} /> : null;
}
