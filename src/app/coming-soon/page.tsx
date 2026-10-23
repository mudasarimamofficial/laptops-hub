import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Wordmark } from "@/components/storefront/site-header";
import { siteMode } from "@/lib/site-url";

/** Restricted pre-launch (SITE_PRELAUNCH=restricted): every storefront route is rewritten here (src/middleware.ts). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Laptops HUB — preparing to launch" },
  description: "Laptops HUB is preparing to launch. Online ordering is not available yet.",
  robots: { index: false, follow: true },
};

export default function ComingSoon() {
  if (siteMode() !== "restricted") notFound();
  return (
    <section
      aria-labelledby="cs-title"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "clamp(56px, 7vw, 96px) clamp(16px, 3vw, 32px)",
        background: "radial-gradient(1200px 600px at 50% -10%, var(--lh-ice), var(--lh-canvas) 60%)",
        color: "var(--lh-ink)",
      }}
    >
      <div style={{ width: "min(100%, 640px)", textAlign: "center" }}>
        <p style={{ display: "inline-flex", alignItems: "center", gap: 7, margin: 0 }}>
          <Wordmark size={28} />
        </p>
        <p
          style={{ margin: "40px 0 0", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--lh-action)" }}
        >
          Preparing to launch
        </p>
        <h1
          id="cs-title"
          style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(32px, 5vw, 52px)", lineHeight: 1.08, letterSpacing: "-.035em", textWrap: "balance" }}
        >
          Our online store is on its way.
        </h1>
        <p style={{ margin: "20px auto 0", maxWidth: 520, fontSize: 17, lineHeight: 1.6, color: "var(--lh-ink-2)" }}>
          Laptops HUB is getting everything ready for launch. Online ordering is not available yet — please check back
          soon.
        </p>
        <div aria-hidden="true" style={{ margin: "40px auto 0", width: 64, height: 4, borderRadius: 4, background: "linear-gradient(90deg, var(--lh-signal), var(--lh-action))" }} />
      </div>
    </section>
  );
}
