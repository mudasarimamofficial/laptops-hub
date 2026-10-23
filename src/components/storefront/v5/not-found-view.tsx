import Link from "next/link";

/** V5 `notFound` view. */
export function NotFoundView({ title, msg }: { title: string; msg: string }) {
  return (
    <section style={{ maxWidth: 720, margin: "0 auto", padding: "120px 24px", textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".14em", color: "var(--lh-ink-2)" }}>404</span>
      <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 34, letterSpacing: "-.03em", fontWeight: 700 }}>{title}</h1>
      <p style={{ margin: 0, color: "var(--lh-ink-2)" }}>{msg}</p>
      <Link href="/collections/all" style={{ height: 48, padding: "0 24px", borderRadius: 999, background: "var(--lh-grad-action)", color: "#FFFFFF", fontWeight: 700, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
        Browse all products
      </Link>
    </section>
  );
}
