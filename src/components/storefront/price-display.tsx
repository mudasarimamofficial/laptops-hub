import { fmtPkr } from "@/lib/catalog/v5-model";
import type { PricedUnit } from "@/lib/commerce/pricing";

/** List + selling price with optional compact badge. */
export function PriceDisplay({
  priced,
  size = "md",
  showBadge = true,
}: {
  priced: PricedUnit;
  size?: "sm" | "md" | "lg";
  showBadge?: boolean;
}) {
  const sellSize = size === "lg" ? 34 : size === "sm" ? 16 : 21;
  const hasDeal = priced.discountPaisa > 0 && priced.sellingPaisa < priced.listPaisa;
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
      <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "6px 10px", alignItems: "baseline" }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: sellSize,
            fontWeight: 700,
            letterSpacing: "-.02em",
            color: "var(--lh-ink,#102039)",
            whiteSpace: "nowrap",
          }}
        >
          {fmtPkr(priced.sellingPaisa)}
        </span>
        {hasDeal ? (
          <span
            style={{
              fontSize: size === "lg" ? 15 : 12,
              color: "var(--lh-ink-2,#52637B)",
              textDecoration: "line-through",
              whiteSpace: "nowrap",
            }}
          >
            {fmtPkr(priced.listPaisa)}
          </span>
        ) : null}
        {hasDeal && showBadge && priced.percentOff != null ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".04em",
              textTransform: "uppercase",
              padding: "3px 8px",
              borderRadius: 999,
              background: "#EAF3FE",
              color: "#1748B5",
              border: "1px solid #BCD0F2",
              whiteSpace: "nowrap",
            }}
          >
            {priced.percentOff}% OFF
          </span>
        ) : null}
      </span>
      {hasDeal && size === "lg" ? (
        <span style={{ fontSize: 13, color: "var(--lh-ink-2,#52637B)" }}>
          You save {fmtPkr(priced.discountPaisa)}
        </span>
      ) : null}
    </span>
  );
}
