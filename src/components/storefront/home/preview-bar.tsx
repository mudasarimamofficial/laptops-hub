import Link from "next/link";
import type { PreviewMode, PreviewSource } from "@/lib/content/homepage-preview-server";

const MODES: { mode: PreviewMode; label: string }[] = [
  { mode: "draft", label: "Draft" },
  { mode: "published", label: "Published" },
  { mode: "default", label: "V5 default" },
];

/**
 * Staff-only banner above a previewed template: what is shown, how it compares with what customers see, and the
 * way back to the editor. Only rendered by the /preview/* routes (which answer 404 to everyone but staff).
 * `kind` names the template ("homepage", "product", …) and prefixes the test ids; `basePath` is the preview route.
 */
export function PreviewBar({
  src,
  flagOn,
  kind = "homepage",
  title = "Homepage",
  basePath = "/preview/homepage",
}: {
  src: PreviewSource;
  flagOn: boolean;
  kind?: string;
  title?: string;
  basePath?: string;
}) {
  const live = flagOn
    ? "Customers see the published version (published themes are switched on)."
    : `Customers see the V5 default: published themes are switched off, so publishing does not change the live ${title.toLowerCase()} yet.`;
  const sep = basePath.includes("?") ? "&" : "?";
  const shown =
    src.mode === "default"
      ? "the built-in V5 default layout"
      : src.missing
        ? src.mode === "draft"
          ? "no saved draft yet, so the V5 default layout"
          : "nothing published yet, so the V5 default layout"
        : src.mode === "draft"
          ? "the saved draft"
          : `the published version ${src.versionLabel ?? ""}`.trim();
  return (
    <div
      data-testid={`${kind}-preview-bar`}
      role="region"
      aria-label={`${title} preview`}
      style={{ background: "var(--lh-navy)", color: "#fff", fontSize: 13, lineHeight: 1.45 }}
    >
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "10px clamp(16px,3vw,32px)", display: "flex", flexWrap: "wrap", gap: "8px 16px", alignItems: "center" }}>
        <p style={{ margin: 0, flex: "1 1 320px" }}>
          <strong>Draft preview only — customers cannot see this page.</strong> Showing{" "}
          <span data-testid={`${kind}-preview-shown`}>{shown}</span>. {live} Links open the live store.
        </p>
        <nav aria-label="Compare versions" style={{ display: "flex", gap: 6 }}>
          {MODES.map((m) => (
            <Link
              key={m.mode}
              href={`${basePath}${sep}v=${m.mode}`}
              aria-current={m.mode === src.mode ? "page" : undefined}
              data-testid={`${kind}-preview-mode-${m.mode}`}
              style={{
                padding: "5px 10px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,.35)",
                background: m.mode === src.mode ? "#fff" : "transparent",
                color: m.mode === src.mode ? "var(--lh-navy)" : "#fff",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {m.label}
            </Link>
          ))}
        </nav>
        <Link href="/admin/online-store" target="_top" data-testid={`${kind}-preview-back`} style={{ color: "#fff", fontWeight: 700, textDecoration: "underline" }}>
          Back to editor
        </Link>
      </div>
    </div>
  );
}
