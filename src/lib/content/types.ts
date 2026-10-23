/** V5 structured content blocks (`data/lh-content.js` block types). */
export type V5Block =
  | { t: "h2"; v: string }
  | { t: "p"; v: string }
  | { t: "list"; items: string[] }
  | { t: "table"; rows: { k: string; v: string }[] }
  | { t: "pending"; v: string }
  | { t: "faq"; items: { q: string; a?: string; pending?: boolean }[] }
  | { t: "links"; items: { label: string; col: string; soon?: boolean }[] }
  | { t: "cta"; v: string; sub: string; a: { label: string; href: string }; b: { label: string; href: string } }
  | { t: "form" }
  | { t: "products"; col: string }
  | { t: "articles" };

export type V5Status = "ready" | "draft" | "pending";

export type V5Page = { title: string; kicker: string; status: V5Status; intro: string; read?: string; blocks: V5Block[] };
export type V5Article = V5Page & { slug: string };
export type V5ContentData = { pages: Record<string, V5Page>; articles: V5Article[] };
