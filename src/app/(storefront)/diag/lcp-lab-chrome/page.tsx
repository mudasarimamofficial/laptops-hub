import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLcpLabEnabled } from "@/lib/diag/lcp-lab-gate";
import { ModeA, ModeAFont, ModeB, ModeC } from "@/components/storefront/home/lcp-lab-variants";

export const metadata: Metadata = {
  title: "LCP lab (storefront chrome)",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ mode?: string }> };

/** Same lab surfaces, but wrapped by production storefront header/footer/cart chrome. */
export default async function LcpLabChromePage({ searchParams }: Props) {
  if (!isLcpLabEnabled()) notFound();
  const { mode = "A" } = await searchParams;
  const body = mode === "A-font" ? <ModeAFont /> : mode === "B" ? <ModeB /> : mode === "C" ? <ModeC /> : <ModeA />;
  return (
    <div>
      <p style={{ fontFamily: "monospace", fontSize: 12, padding: 12, background: "#102039", color: "#fff", margin: 0 }}>
        LCP lab + storefront chrome · mode={mode}
      </p>
      {body}
    </div>
  );
}
