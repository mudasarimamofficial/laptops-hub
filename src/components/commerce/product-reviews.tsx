import type { ProductReviews as Data } from "@/lib/catalog/reviews-server";
import { ReviewForm } from "@/components/commerce/review-form";

const h2 = { margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(26px,2.6vw,36px)", letterSpacing: "-.03em", fontWeight: 700 } as const;

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span aria-hidden="true" style={{ color: "var(--lh-signal)", fontSize: size, letterSpacing: 2 }}>
      {"★".repeat(Math.round(value))}
      <span style={{ color: "var(--lh-border)" }}>{"★".repeat(5 - Math.round(value))}</span>
    </span>
  );
}

/** Product reviews: approved customer reviews only. With none, an honest empty state — no placeholder ratings. */
export function ProductReviews({ handle, model, data }: { handle: string; model: string; data: Data }) {
  const shown = data.reviews.slice(0, 20);
  return (
    <section aria-labelledby="pdp-reviews" data-testid="pdp-reviews" style={{ marginTop: 64, display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <h2 id="pdp-reviews" style={h2}>
          Customer reviews
        </h2>
        {data.count && data.average !== null ? (
          <p data-testid="review-summary" style={{ margin: 0, display: "flex", alignItems: "center", gap: 10, fontSize: 15, color: "var(--lh-ink)" }}>
            <Stars value={data.average} />
            <span>
              <strong>{data.average.toFixed(1)}</strong> out of 5 · {data.count} {data.count === 1 ? "review" : "reviews"}
            </span>
          </p>
        ) : null}
      </div>
      {shown.length ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,320px),1fr))", gap: 16 }}>
          {shown.map((r) => (
            <li key={r.id} data-testid="review" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 20, borderRadius: 20, border: "1px solid var(--lh-border)", background: "#FFFFFF" }}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span role="img" aria-label={`${r.rating} out of 5 stars`}>
                  <Stars value={r.rating} size={14} />
                </span>
                <time dateTime={r.date} style={{ fontSize: 12, color: "var(--lh-ink-2)" }}>
                  {new Date(r.date).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" })}
                </time>
              </span>
              {r.title ? <strong style={{ fontSize: 15 }}>{r.title}</strong> : null}
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--lh-ink)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.body}</p>
              <span style={{ fontSize: 13, color: "var(--lh-ink-2)" }}>— {r.author}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, fontSize: 15, color: "var(--lh-ink-2)" }}>No reviews yet for the {model}.</p>
      )}
      <ReviewForm handle={handle} />
    </section>
  );
}
