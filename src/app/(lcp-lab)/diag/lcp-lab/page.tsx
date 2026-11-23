import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLcpLabEnabled } from "@/lib/diag/lcp-lab-gate";
import { renderLabMode } from "@/components/storefront/home/lcp-lab-variants";
import { LAB_MODES, isLabMode } from "@/lib/diag/lcp-lab-modes";

export const metadata: Metadata = {
  title: "LCP lab",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ mode?: string }> };

export default async function LcpLabPage({ searchParams }: Props) {
  if (!isLcpLabEnabled()) notFound();
  const { mode: raw = "A" } = await searchParams;
  const mode = isLabMode(raw) ? raw : "A";
  const body = renderLabMode(mode);
  if (!body) notFound();
  return (
    <>
      <header style={{ fontFamily: "monospace", fontSize: 12, padding: "8px 16px", background: "#102039", color: "#fff" }}>
        LCP lab mode={mode} · gated diagnostic · not production homepage
      </header>
      {body}
      <nav style={{ fontFamily: "monospace", fontSize: 11, padding: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {LAB_MODES.map((m) => (
          <a key={m} href={`/diag/lcp-lab?mode=${encodeURIComponent(m)}`} style={{ color: "#2159D4" }}>
            {m}
          </a>
        ))}
        <a href="/diag/lcp-lab-chrome?mode=A" style={{ color: "#2159D4" }}>
          chrome-A
        </a>
        <a href="/" style={{ color: "#2159D4" }}>
          G-prod-home
        </a>
        <a href="/collections/laptops" style={{ color: "#2159D4" }}>
          control-coll
        </a>
      </nav>
    </>
  );
}
