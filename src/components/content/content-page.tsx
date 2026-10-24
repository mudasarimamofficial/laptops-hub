import Link from "next/link";
import { V5ProductCard } from "@/components/commerce/product-card";
import { ContactForm, FaqList, TocButtons } from "@/components/content/content-client";
import { getV5Catalog, V5_COLS, v5Card, type V5Product } from "@/lib/catalog/v5";
import { V5_CONTENT } from "@/lib/content/v5-content";
import { supportHref, unlinkUnpublished } from "@/lib/content/links";
import { contentVisibility, type ResolvedContent } from "@/lib/content/pages";
import type { V5Block } from "@/lib/content/types";

/** Port of the V5 `isPage` view (content pages, guides index and articles). */

const mono = { fontFamily: "var(--font-mono)" } as const;
const PEND_TAG = "BEING FINALISED";

type Ctx = { P: V5Product[]; tok: Record<string, number>; current: string; isArticle: boolean };

function fill(s: string, tok: Record<string, number>) {
  return String(s || "").replace(/\{(\w+)\}/g, (m, k) => (tok[k] != null ? String(tok[k]) : m));
}

function Block({ b, i, ctx, pageSlug }: { b: V5Block; i: number; ctx: Ctx; pageSlug: string }) {
  switch (b.t) {
    case "h2":
      return (
        <h2 id={`sec-${i}`} style={{ margin: "22px 0 0", fontFamily: "var(--font-display)", fontSize: "clamp(22px,2.2vw,30px)", lineHeight: 1.15, letterSpacing: "-.03em", fontWeight: 700 }}>
          {fill(b.v, ctx.tok)}
        </h2>
      );
    case "p":
      return <p style={{ margin: 0, maxWidth: "68ch", fontSize: 16, lineHeight: 1.7, color: "var(--lh-ink-2)", textWrap: "pretty" }}>{fill(b.v, ctx.tok)}</p>;
    case "list":
      return (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 2, maxWidth: "68ch" }}>
          {b.items.map((li) => (
            <li key={li} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "9px 0", borderBottom: "1px solid var(--lh-divider)", fontSize: 16, lineHeight: 1.55, color: "var(--lh-ink)" }}>
              <span aria-hidden="true" style={{ flexShrink: 0, width: 6, height: 6, marginTop: 9, borderRadius: "50%", background: "var(--lh-electric)" }} />
              {fill(li, ctx.tok)}
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <dl style={{ margin: 0, borderRadius: 18, background: "#FFFFFF", border: "1px solid var(--lh-border)", overflow: "hidden", maxWidth: 760 }}>
          {b.rows.map((r) => (
            <div key={r.k} style={{ display: "grid", gridTemplateColumns: "minmax(110px,30%) minmax(0,1fr)", gap: 16, padding: "13px 18px", borderBottom: "1px solid var(--lh-divider)" }}>
              <dt style={{ ...mono, fontSize: 12, letterSpacing: ".04em", color: "var(--lh-action)", paddingTop: 2 }}>{r.k}</dt>
              <dd style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--lh-ink)" }}>{fill(r.v, ctx.tok)}</dd>
            </div>
          ))}
        </dl>
      );
    case "pending":
      // V5 customer view (ownerReview off): no internal checklist, only a contact route.
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "clamp(18px,2.4vw,26px)", borderRadius: 20, background: "var(--lh-warning-bg)", border: "1.5px dashed #E2BF83", maxWidth: 760 }}>
          <span style={{ ...mono, fontSize: 11, letterSpacing: ".12em", color: "var(--lh-warning)" }}>{PEND_TAG}</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, color: "var(--lh-ink)" }}>{fill(b.v, ctx.tok)} will be published here</span>
          <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--lh-ink)" }}>We haven’t published this information yet. Contact us and we’ll answer directly.</span>
          {pageSlug !== "contact" ? (
            <Link href="/pages/contact" className="v5-hov-bd-action" style={{ alignSelf: "flex-start", height: 44, padding: "0 18px", borderRadius: 999, background: "#FFFFFF", border: "1px solid var(--lh-border)", color: "var(--lh-ink)", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", whiteSpace: "nowrap", flexShrink: 0 }}>
              Contact us
            </Link>
          ) : null}
        </div>
      );
    case "faq":
      return (
        <FaqList
          items={b.items.map((x) => ({
            q: x.q,
            a: x.pending ? "We haven’t published this answer yet. Ask us directly through the contact page." : fill(x.a || "", ctx.tok),
            pend: !!x.pending,
          }))}
        />
      );
    case "links":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,170px),1fr))", gap: 10 }}>
          {b.items.map((lk) => (
            <Link key={lk.col} href={`/collections/${lk.col}`} className="v5-hov-bd-action" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 14, background: "#FFFFFF", border: "1px solid var(--lh-border)", color: "var(--lh-ink)", fontWeight: 600, fontSize: 15, transition: "border-color .2s ease" }}>
              <span>{lk.label}</span>
              <span style={{ ...mono, fontSize: 12, fontWeight: 500, color: "var(--lh-action)" }}>{lk.soon ? "Soon" : V5_COLS[lk.col] ? ctx.P.filter(V5_COLS[lk.col].f).length : 0}</span>
            </Link>
          ))}
        </div>
      );
    case "cta":
      return (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap", padding: "clamp(22px,3vw,32px)", borderRadius: 24, backgroundColor: "var(--lh-navy)", backgroundImage: "radial-gradient(60% 90% at 100% 100%,rgba(var(--lh-iris-rgb),.4),transparent 70%),radial-gradient(50% 80% at 0% 0%,rgba(var(--lh-action-rgb),.35),transparent 70%)", color: "#FFFFFF" }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-.02em" }}>{b.v}</span>
            <span style={{ fontSize: 15, color: "var(--lh-on-dark-2)" }}>{b.sub}</span>
          </span>
          <span style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href={b.a.href} className="v5-hov-white-ice" style={{ height: 48, padding: "0 22px", borderRadius: 999, background: "#FFFFFF", color: "var(--lh-ink)", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
              {b.a.label}
            </Link>
            <Link href={b.b.href} className="v5-hov-bd-electric" style={{ height: 48, padding: "0 20px", borderRadius: 999, border: "1px solid rgba(255,255,255,.3)", color: "#FFFFFF", fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
              {b.b.label}
            </Link>
          </span>
        </div>
      );
    case "products": {
      const c = V5_COLS[b.col];
      if (!c) return null;
      const l = ctx.P.filter(c.f);
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700 }}>Matching products: {c.t}</span>
            <Link href={`/collections/${b.col}`} style={{ fontWeight: 700, fontSize: 14, color: "var(--lh-action)" }}>
              View all {l.length} →
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,240px),1fr))", gap: 16 }}>
            {[...l]
              .sort((x, y) => x.i - y.i)
              .slice(0, 4)
              .map((p) => (
                <V5ProductCard key={p.h} item={v5Card(p)} />
              ))}
          </div>
        </div>
      );
    }
    case "articles":
      return <ArticleCards exclude={ctx.isArticle ? ctx.current : null} />;
    case "form":
      return <ContactForm />;
  }
}

async function ArticleCards({ exclude }: { exclude: string | null }) {
  const vis = await contentVisibility();
  const list = V5_CONTENT.articles.filter((a) => a.slug !== exclude && vis.articles[a.slug]);
  if (!list.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,280px),1fr))", gap: 16, marginTop: 10 }}>
      {list.map((ar) => (
        <Link key={ar.slug} href={`/guides/${ar.slug}`} className="v5-hov-article" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 22, borderRadius: 20, background: "linear-gradient(160deg,#FFFFFF 40%,var(--lh-ice) 100%)", border: "1px solid var(--lh-border)", color: "var(--lh-ink)", transition: "border-color .2s ease,transform .2s ease" }}>
          <span style={{ display: "flex", justifyContent: "space-between", gap: 10, ...mono, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--lh-action)" }}>
            <span>{ar.kicker}</span>
            <span style={{ color: "var(--lh-ink-2)" }}>{ar.read} read</span>
          </span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.2 }}>{ar.title}</span>
          <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--lh-ink-2)", textWrap: "pretty" }}>{ar.intro}</span>
          <span style={{ marginTop: "auto", fontSize: 14, fontWeight: 700, color: "var(--lh-action)" }}>Read guide →</span>
        </Link>
      ))}
    </div>
  );
}

/** CMS HTML: ids on h2 for the TOC, then rendered with V5 block typography (`.v5-cms` in v5.css). */
function cmsWithToc(html: string) {
  const toc: { id: string; label: string }[] = [];
  let n = 0;
  const out = html.replace(/<h2>([\s\S]*?)<\/h2>/gi, (_m, inner: string) => {
    const id = `sec-cms-${n++}`;
    toc.push({ id, label: inner.replace(/<[^>]+>/g, "").trim() });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html: out, toc };
}

export async function ContentPage({ page, kind }: { page: ResolvedContent; kind: "page" | "guides" | "article" }) {
  const P = await getV5Catalog().catch(() => [] as V5Product[]);
  const lapCount = P.filter(V5_COLS.laptops.f).length;
  const tok = {
    laptops: lapCount,
    products: P.length,
    total: P.length,
    dell: P.filter(V5_COLS.dell.f).length,
    hp: P.filter(V5_COLS.hp.f).length,
    lenovo: P.filter(V5_COLS.lenovo.f).length,
    used: P.filter((p) => p.cond === "Used").length,
    nocond: P.filter((p) => !p.cond).length,
  };
  const ctx: Ctx = { P, tok, current: page.slug, isArticle: kind === "article" };
  const vis = await contentVisibility(true);

  const crumbs = [{ label: "Home", href: "/" }];
  if (kind === "page" && page.slug !== "faq") crumbs.push({ label: "Help", href: supportHref(vis) });
  if (kind === "article") crumbs.push({ label: "Guides", href: "/guides" });

  const blocks = [...page.blocks];
  if (kind === "article" && page.mode !== "gated") blocks.push({ t: "articles" });
  const cms = page.html ? cmsWithToc(unlinkUnpublished(page.html, vis)) : null;
  const toc = cms ? cms.toc : blocks.flatMap((b, i) => (b.t === "h2" ? [{ id: `sec-${i}`, label: fill(b.v, tok) }] : []));

  // Header tag: V5 status tags only in (non-production) preview. Public pages are complete, so never tagged.
  const tag = page.preview
    ? page.v5Status === "pending"
      ? { text: PEND_TAG, warn: true }
      : page.v5Status === "draft"
        ? { text: "DRAFT · EDITORIAL REVIEW" + (page.read ? " · " + page.read.toUpperCase() : ""), warn: false }
        : null
    : null;

  const isArt = kind !== "page";
  // Side navigation lists only public pages (preview: all, with V5 status marks).
  const side = isArt
    ? V5_CONTENT.articles
        .filter((a) => page.preview || vis.articles[a.slug])
        .map((a) => ({ label: a.title, href: `/guides/${a.slug}`, pend: false }))
    : Object.entries(V5_CONTENT.pages)
        .filter(([k]) => page.preview || vis.pages[k])
        .map(([k, p]) => ({ label: p.title, href: `/pages/${k}`, pend: page.preview && p.status === "pending" }));
  const currentHref = kind === "page" ? `/pages/${page.slug}` : kind === "article" ? `/guides/${page.slug}` : "/guides";

  return (
    <>
      <section data-screen-label="Page" style={{ background: "radial-gradient(40% 120% at 100% 0%,rgba(var(--lh-action-rgb),.10),transparent 70%),linear-gradient(180deg,var(--lh-ice),var(--lh-canvas))", borderBottom: "1px solid var(--lh-border)", color: "var(--lh-ink)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px clamp(16px,3vw,32px) 40px", display: "flex", flexDirection: "column", gap: 14 }}>
          <nav aria-label="Breadcrumb" style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 13, color: "var(--lh-ink-2)" }}>
            {crumbs.map((cr) => (
              <span key={cr.href} style={{ display: "contents" }}>
                <Link href={cr.href} style={{ color: "var(--lh-ink-2)" }}>
                  {cr.label}
                </Link>
                <span aria-hidden="true">/</span>
              </span>
            ))}
            <span aria-current="page" style={{ color: "var(--lh-ink)" }}>
              {page.title}
            </span>
          </nav>
          <span style={{ display: "flex", alignItems: "center", gap: 10, ...mono, fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--lh-ink-2)" }}>
            <span style={{ width: 12, height: 2, background: "var(--lh-signal)" }} />
            {page.kicker}
          </span>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(34px,4.4vw,60px)", lineHeight: 1.02, letterSpacing: "-.045em", fontWeight: 700, textWrap: "balance", maxWidth: "20ch" }}>{page.title}</h1>
          <p style={{ margin: 0, maxWidth: "60ch", fontSize: "clamp(16px,1.2vw,19px)", lineHeight: 1.55, color: "var(--lh-ink-2)", textWrap: "pretty" }}>{fill(page.intro, tok)}</p>
          {tag ? (
            <span style={{ display: "block", width: "fit-content", maxWidth: "100%", padding: "7px 12px", borderRadius: 999, background: tag.warn ? "var(--lh-warning-bg)" : "#FFFFFF", border: tag.warn ? "1px solid #F1D9AE" : "1px solid var(--lh-border)", color: tag.warn ? "var(--lh-warning)" : "var(--lh-ink-2)", ...mono, fontSize: 11, lineHeight: 1.4, letterSpacing: ".08em", whiteSpace: "nowrap" }}>
              {tag.text}
            </span>
          ) : null}
        </div>
      </section>
      <section className="v5-page-cols" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px clamp(16px,3vw,32px) 96px", display: "grid", gap: "clamp(28px,4vw,64px)", alignItems: "start", color: "var(--lh-ink)" }}>
        <article style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          {cms ? <div className="v5-cms" dangerouslySetInnerHTML={{ __html: cms.html }} /> : null}
          {blocks.map((b, i) => (
            <Block key={i} b={b} i={i} ctx={ctx} pageSlug={page.slug} />
          ))}
        </article>
        <aside aria-label="Page navigation" className="v5-page-aside" style={{ top: 96, display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>
          {toc.length > 1 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ ...mono, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--lh-action)", marginBottom: 6 }}>On this page</span>
              <TocButtons items={toc} />
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: 18, borderRadius: 18, background: "#FFFFFF", border: "1px solid var(--lh-border)" }}>
            <span style={{ ...mono, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--lh-action)", marginBottom: 8 }}>{isArt ? "Guides" : "Help & policies"}</span>
            {side.map((sl) => {
              const cur = sl.href === currentHref;
              return (
                <Link
                  key={sl.href}
                  href={sl.href}
                  aria-current={cur ? "page" : undefined}
                  className="v5-hov-ice"
                  style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 10px", margin: "0 -10px", borderRadius: 8, fontSize: 14, fontWeight: cur ? 700 : 500, color: "var(--lh-ink)", background: cur ? "var(--lh-ice)" : "transparent" }}
                >
                  <span>{sl.label}</span>
                  {sl.pend ? <span style={{ ...mono, fontSize: 10, color: "var(--lh-warning)" }}>SOON</span> : null}
                </Link>
              );
            })}
          </div>
        </aside>
      </section>
    </>
  );
}
