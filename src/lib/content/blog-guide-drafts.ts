import { V5_CONTENT } from "@/lib/content/v5-content";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type Block = Record<string, unknown>;

/** Convert frozen V5 guide blocks into staff-editable HTML (products embeds omitted — collection links stay in catalog). */
export function blocksToGuideHtml(intro: string, blocks: Block[]): string {
  const parts: string[] = [];
  if (intro.trim()) parts.push(`<p>${esc(intro.trim())}</p>`);
  for (const b of blocks) {
    const t = String(b.t || "");
    if (t === "h2" && typeof b.v === "string") parts.push(`<h2>${esc(b.v)}</h2>`);
    else if (t === "p" && typeof b.v === "string") parts.push(`<p>${esc(b.v)}</p>`);
    else if (t === "list" && Array.isArray(b.items)) {
      parts.push(`<ul>${b.items.map((item) => `<li>${esc(String(item))}</li>`).join("")}</ul>`);
    } else if (t === "table" && Array.isArray(b.rows)) {
      const rows = b.rows as { k?: string; v?: string }[];
      parts.push(
        `<table><tbody>${rows
          .map((r) => `<tr><th scope="row">${esc(String(r.k || ""))}</th><td>${esc(String(r.v || ""))}</td></tr>`)
          .join("")}</tbody></table>`,
      );
    }
    // Skip `products` / `links` embeds — they depend on live collection IDs and are not safe to invent.
  }
  return parts.join("\n");
}

export type GuideDraftSeed = {
  slug: string;
  title: string;
  excerpt: string;
  bodyHtml: string;
};

/** Four factual guide drafts from approved V5 template copy. Never auto-published. */
export function guideDraftSeeds(): GuideDraftSeed[] {
  return (V5_CONTENT.articles || []).map((a) => ({
    slug: a.slug,
    title: a.title,
    excerpt: (a.intro || "").slice(0, 300),
    bodyHtml: blocksToGuideHtml(a.intro || "", (a.blocks || []) as Block[]),
  }));
}
