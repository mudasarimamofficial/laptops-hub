/** Pre-launch bar above the V5 header (SITE_PRELAUNCH=1). Scrolls away with the page; the header stays sticky. */
export function PrelaunchNotice() {
  return (
    <div role="note" aria-label="Pre-launch notice" style={{ background: "var(--lh-navy)", color: "#FFFFFF" }}>
      <p
        className="lh-container"
        style={{ margin: "0 auto", minHeight: 36, padding: "8px 0", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "4px 12px", fontSize: 13, lineHeight: 1.4, textAlign: "center" }}
      >
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--lh-electric)" }}>
          Pre-launch
        </span>
        <span>Laptops HUB is preparing to launch. Online ordering is not available yet.</span>
      </p>
    </div>
  );
}
