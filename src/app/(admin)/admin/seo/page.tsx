import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { SeoHomeForm } from "@/components/admin/seo-home-form";
import { SEO_DEFAULTS_KEY, parseSeoDefaults } from "@/lib/content/seo-defaults";
import { getContactSocial } from "@/lib/content/contact-social-server";
import { siteUrl } from "@/lib/site-url";
import { postalAddress } from "@/lib/seo/site-jsonld";

export const dynamic = "force-dynamic";
export const metadata = { title: "SEO", robots: { index: false, follow: false } };

const missing = (v: string | null | undefined) => !v || !v.trim();

/**
 * Merchant SEO checklist: products/collections missing search title or description.
 * Does not claim Google has indexed anything — only that metadata is filled for crawlers.
 */
export default async function AdminSeoPage() {
  const staff = await requireStaffPage(["owner", "admin", "manager", "editor"]);
  const sb = createServiceClient();
  const [{ data: products }, { data: collections }, { data: seoRow }, contact] = await Promise.all([
    sb.from("products").select("handle, title, seo_title, seo_description").eq("status", "active").is("deleted_at", null).order("title").limit(2000),
    sb.from("collections").select("slug, title, seo_title, seo_description").eq("published", true).is("deleted_at", null).order("title"),
    sb.from("store_settings").select("value").eq("key", SEO_DEFAULTS_KEY).maybeSingle(),
    getContactSocial(),
  ]);
  const seo = parseSeoDefaults(seoRow?.value);
  const origin = siteUrl();
  const canEdit = ["owner", "admin", "manager"].includes(staff.role);
  const address = postalAddress(contact.address, contact.businessName);
  const phones = contact.phones.filter((p) => p.enabled).map((p) => p.display);
  const socials = contact.social.filter((x) => x.enabled && x.url);
  const pGaps = (products || []).filter((p) => missing(p.seo_title) || missing(p.seo_description));
  const cGaps = (collections || []).filter((c) => missing(c.seo_title) || missing(c.seo_description));
  const productTotal = products?.length ?? 0;
  const collectionTotal = collections?.length ?? 0;

  return (
    <>
      <AdminPageHeader
        title="Search appearance"
        description="Fill search titles and descriptions so Google can show clearer results. Completing this checklist does not guarantee indexing or ranking."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "SEO" }]}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <AdminCard title="Products ready">
          <p className="text-2xl font-bold text-[var(--adm-ink)]">
            {productTotal - pGaps.length}
            <span className="text-base font-normal text-[var(--adm-ink-2)]"> / {productTotal}</span>
          </p>
          <p className="mt-1 text-xs text-[var(--adm-ink-2)]">Active products with search title and description</p>
        </AdminCard>
        <AdminCard title="Collections ready">
          <p className="text-2xl font-bold text-[var(--adm-ink)]">
            {collectionTotal - cGaps.length}
            <span className="text-base font-normal text-[var(--adm-ink-2)]"> / {collectionTotal}</span>
          </p>
          <p className="mt-1 text-xs text-[var(--adm-ink-2)]">Published collections with search metadata</p>
        </AdminCard>
        <AdminCard title="What this does not do">
          <ul className="list-disc space-y-1 pl-4 text-xs text-[var(--adm-ink-2)]">
            <li>Does not submit URLs to Google Search Console</li>
            <li>Does not force re-crawl or guarantee rankings</li>
            <li>Drafts and hidden pages stay out of the public sitemap</li>
          </ul>
        </AdminCard>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <AdminCard
          title="Homepage search appearance"
          description="The title and description Google may show for your homepage. Your brand and city help people find the official site."
        >
          <SeoHomeForm initial={{ homeTitle: seo.homeTitle, homeDescription: seo.homeDescription }} origin={origin} canEdit={canEdit} />
        </AdminCard>
        <AdminCard
          title="Business identity for search"
          description="Search engines read these from Contact & Social (one place to edit). Structured data uses only these facts: no ratings, opening hours or map pins are added."
        >
          <dl className="space-y-2 text-sm" data-testid="seo-identity">
            <div>
              <dt className="text-xs text-[var(--adm-ink-2)]">Name</dt>
              <dd>{contact.businessName}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--adm-ink-2)]">Address</dt>
              <dd>
                {contact.address || "—"}
                {address && typeof address === "string" ? (
                  <span className="block text-xs text-[var(--adm-ink-2)]">
                    Shown as plain text: end the address with “, City, Pakistan” to publish a structured postal address.
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--adm-ink-2)]">Phones</dt>
              <dd>{phones.length ? phones.join(" · ") : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--adm-ink-2)]">Email</dt>
              <dd>{contact.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--adm-ink-2)]">Social profiles (linked as the same business)</dt>
              <dd>{socials.length ? socials.map((x) => x.label).join(" · ") : "—"}</dd>
            </div>
          </dl>
          <Link href="/admin/settings#contact-social" className="mt-3 inline-block text-sm font-semibold text-[var(--adm-action)] underline">
            Edit in Contact &amp; Social
          </Link>
        </AdminCard>
      </div>

      <AdminCard
        title="Google Search Console"
        description="Search Console is Google's own report of which pages are indexed and why others are not. This admin cannot see that data."
      >
        <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--adm-ink-2)]">
          <li>
            Sign in to{" "}
            <a href="https://search.google.com/search-console" className="font-semibold text-[var(--adm-action)] underline" target="_blank" rel="noreferrer">
              Google Search Console
            </a>{" "}
            with the business Google account and open the <strong>laptopshub.pk</strong> property.
          </li>
          <li>
            Under Sitemaps, submit <code className="rounded bg-[var(--adm-surface-2)] px-1">{origin}/sitemap.xml</code> (once; Google rereads it).
          </li>
          <li>Use URL Inspection on a page you changed to ask Google to recrawl it. Indexing and ranking are decided by Google.</li>
        </ol>
      </AdminCard>

      <div className="mt-6" />

      <AdminCard
        title="Where to edit"
        description="Policy and information page titles live under Content. Product and collection search fields open from the lists below."
      >
        <p className="text-sm text-[var(--adm-ink-2)]">
          Public{" "}
          <a href="/sitemap.xml" className="font-semibold text-[var(--adm-action)] underline" target="_blank" rel="noreferrer">
            sitemap.xml
          </a>{" "}
          lists live products, collections, published pages and guides. Edit policy pages in{" "}
          <Link href="/admin/content" className="font-semibold text-[var(--adm-action)] underline">
            Content
          </Link>
          . Blog SEO is set on each post under{" "}
          <Link href="/admin/blog" className="font-semibold text-[var(--adm-action)] underline">
            Blog
          </Link>
          .
        </p>
      </AdminCard>

      <GapSection
        title="Products missing search metadata"
        gaps={pGaps.map((p) => ({
          key: p.handle,
          title: p.title,
          href: `/admin/products/${p.handle}`,
          noTitle: missing(p.seo_title),
          noDesc: missing(p.seo_description),
        }))}
        emptyLabel="All listed products have a search title and description."
      />

      <GapSection
        title="Collections missing search metadata"
        gaps={cGaps.map((c) => ({
          key: c.slug,
          title: c.title,
          href: `/admin/collections/${c.slug}`,
          noTitle: missing(c.seo_title),
          noDesc: missing(c.seo_description),
        }))}
        emptyLabel="All listed collections have a search title and description."
      />
    </>
  );
}

function GapSection({
  title,
  gaps,
  emptyLabel,
}: {
  title: string;
  gaps: { key: string; title: string; href: string; noTitle: boolean; noDesc: boolean }[];
  emptyLabel: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--adm-ink)]">{title}</h2>
      {gaps.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--adm-ink-2)]">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--adm-border)] rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] text-sm shadow-[var(--adm-shadow)]">
          {gaps.slice(0, 100).map((g) => (
            <li key={g.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <Link href={g.href} className="font-medium text-[var(--adm-action)] hover:underline">
                {g.title}
              </Link>
              <span className="text-xs text-[var(--adm-ink-2)]">
                Missing: {[g.noTitle ? "search title" : "", g.noDesc ? "search description" : ""].filter(Boolean).join(", ")}
              </span>
            </li>
          ))}
          {gaps.length > 100 ? (
            <li className="px-4 py-2 text-xs text-[var(--adm-ink-2)]">…and {gaps.length - 100} more.</li>
          ) : null}
        </ul>
      )}
    </section>
  );
}
