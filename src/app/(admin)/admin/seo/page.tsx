import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "SEO", robots: { index: false, follow: false } };

const missing = (v: string | null | undefined) => !v || !v.trim();

/**
 * Search appearance checklist: public products and collections without their own search title or description
 * (search engines then fall back to the product title/summary). Links go to where each is edited.
 */
export default async function AdminSeoPage() {
  await requireStaffPage(["owner", "admin", "manager", "editor"]);
  const sb = createServiceClient();
  const [{ data: products }, { data: collections }] = await Promise.all([
    sb.from("products").select("handle, title, seo_title, seo_description").eq("status", "active").is("deleted_at", null).order("title").limit(2000),
    sb.from("collections").select("slug, title, seo_title, seo_description").eq("published", true).is("deleted_at", null).order("title"),
  ]);
  const pGaps = (products || []).filter((p) => missing(p.seo_title) || missing(p.seo_description));
  const cGaps = (collections || []).filter((c) => missing(c.seo_title) || missing(c.seo_description));

  const section = (
    title: string,
    total: number,
    gaps: { key: string; title: string; href: string; noTitle: boolean; noDesc: boolean }[],
  ) => (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">
        {title}: {total - gaps.length} of {total} complete
      </h2>
      {gaps.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--adm-ink-2)]">Nothing missing.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--adm-border)] rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-white text-sm">
          {gaps.slice(0, 100).map((g) => (
            <li key={g.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <Link href={g.href} className="font-medium hover:underline">
                {g.title}
              </Link>
              <span className="text-xs text-[var(--adm-ink-2)]">
                Missing: {[g.noTitle ? "search title" : "", g.noDesc ? "search description" : ""].filter(Boolean).join(", ")}
              </span>
            </li>
          ))}
          {gaps.length > 100 ? <li className="px-4 py-2 text-xs text-[var(--adm-ink-2)]">…and {gaps.length - 100} more.</li> : null}
        </ul>
      )}
    </section>
  );

  return (
    <>
      <AdminPageHeader
        title="SEO"
        description="How products and collections appear in Google. Missing fields fall back to the product name and summary, which is fine but less precise."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "SEO" }]}
      />
      <p className="text-sm">
        The <a href="/sitemap.xml" className="text-[var(--lh-action)] underline" target="_blank" rel="noreferrer">sitemap</a> lists every public product,
        collection, published page and guide automatically; drafts and hidden pages are left out. Page titles and descriptions for policy and
        information pages are edited in <Link href="/admin/content" className="text-[var(--lh-action)] underline">Content</Link>.
      </p>
      {section(
        "Products",
        products?.length ?? 0,
        pGaps.map((p) => ({ key: p.handle, title: p.title, href: `/admin/products/${p.handle}`, noTitle: missing(p.seo_title), noDesc: missing(p.seo_description) })),
      )}
      {section(
        "Collections",
        collections?.length ?? 0,
        cGaps.map((c) => ({ key: c.slug, title: c.title, href: `/admin/collections/${c.slug}`, noTitle: missing(c.seo_title), noDesc: missing(c.seo_description) })),
      )}
    </>
  );
}
