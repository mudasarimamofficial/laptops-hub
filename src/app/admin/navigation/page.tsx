import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { requireStaffPage } from "@/lib/auth/staff";
import { contentVisibility, PAGE_SLUGS, ARTICLE_SLUGS } from "@/lib/content/pages";
import { MANDATORY_POLICY_SLUGS, isLinkPublic } from "@/lib/content/links";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const HEADER_NAV = [
  { label: "Dell", href: "/collections/dell", type: "collection" },
  { label: "HP", href: "/collections/hp", type: "collection" },
  { label: "Lenovo", href: "/collections/lenovo", type: "collection" },
  { label: "Chromebooks", href: "/collections/chromebooks", type: "collection", isNew: true },
  { label: "Accessories", href: "/collections/accessories", type: "collection" },
  { label: "Guides", href: "/guides", type: "guides" },
  { label: "Support", href: "/pages/faq", type: "content" },
];

const FOOTER_COLUMNS = [
  {
    title: "Shop",
    links: [
      { label: "All products", href: "/collections/all", type: "catalog" },
      { label: "Laptops", href: "/collections/laptops", type: "collection" },
      { label: "Gaming laptops", href: "/collections/gaming-laptops", type: "collection" },
      { label: "MacBooks", href: "/collections/macbooks", type: "collection" },
      { label: "Chromebooks", href: "/collections/chromebooks", type: "collection" },
      { label: "Tablets & smart devices", href: "/collections/tablets", type: "collection" },
      { label: "Accessories", href: "/collections/accessories", type: "collection" },
    ],
  },
  {
    title: "By brand & spec",
    links: [
      { label: "Dell", href: "/collections/dell", type: "collection" },
      { label: "HP", href: "/collections/hp", type: "collection" },
      { label: "Lenovo", href: "/collections/lenovo", type: "collection" },
      { label: "Core i5", href: "/collections/core-i5", type: "collection" },
      { label: "Core i7", href: "/collections/core-i7", type: "collection" },
      { label: "16GB RAM", href: "/collections/ram-16gb", type: "collection" },
      { label: "Touchscreen", href: "/collections/touchscreen", type: "collection" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Buying guides", href: "/guides", type: "guides" },
      { label: "How to choose", href: "/pages/how-to-choose", type: "content" },
      { label: "Condition guide", href: "/pages/condition-guide", type: "content" },
      { label: "FAQ", href: "/pages/faq", type: "content" },
      { label: "Order inquiries", href: "/pages/order-inquiries", type: "content" },
      { label: "Contact us", href: "/pages/contact", type: "content" },
    ],
  },
  {
    title: "Policies",
    links: [
      { label: "Shipping & delivery", href: "/pages/shipping", type: "policy" },
      { label: "Returns & refunds", href: "/pages/returns", type: "policy" },
      { label: "Warranty", href: "/pages/warranty", type: "policy" },
      { label: "Privacy policy", href: "/pages/privacy", type: "policy" },
      { label: "Terms & conditions", href: "/pages/terms", type: "policy" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Laptops HUB", href: "/pages/about", type: "content" },
      { label: "Why Laptops HUB", href: "/pages/why-laptops-hub", type: "content" },
      { label: "Compare", href: "/compare", type: "feature" },
      { label: "Cart", href: "/cart", type: "feature" },
    ],
  },
];

export default async function AdminNavigationPage() {
  await requireStaffPage(["owner", "admin", "editor"]);
  const vis = await contentVisibility(true);

  const publicPageCount = Object.values(vis.pages).filter(Boolean).length;
  const publicArticleCount = Object.values(vis.articles).filter(Boolean).length;
  const mandatoryReady = MANDATORY_POLICY_SLUGS.every((slug) => vis.pages[slug]);

  return (
    <>
      <AdminPageHeader
        title="Navigation"
        description="Customer storefront navigation menus, header links, footer columns, and real-time publication status."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Navigation" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/content"
              className="inline-flex rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-2 text-sm font-semibold hover:bg-[var(--adm-surface-2)]"
            >
              Manage pages
            </Link>
            <Link
              href="/admin/collections"
              className="inline-flex rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-2 text-sm font-semibold hover:bg-[var(--adm-surface-2)]"
            >
              Manage collections
            </Link>
            <Link
              href="/admin/online-store"
              className="inline-flex rounded-lg bg-[var(--lh-action)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--lh-action-hover)]"
            >
              Customize theme
            </Link>
          </div>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]">
          <p className="text-xs uppercase tracking-wider text-[var(--adm-ink-2)]">Header primary menu</p>
          <p className="mt-2 text-2xl font-bold">{HEADER_NAV.length} items</p>
          <p className="mt-1 text-xs text-[var(--adm-ink-2)]">Desktop brand bar & mobile drawer</p>
        </div>
        <div className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]">
          <p className="text-xs uppercase tracking-wider text-[var(--adm-ink-2)]">Footer columns</p>
          <p className="mt-2 text-2xl font-bold">5 columns · 28 links</p>
          <p className="mt-1 text-xs text-[var(--adm-ink-2)]">Shop, brands, help, policies, company</p>
        </div>
        <div className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]">
          <p className="text-xs uppercase tracking-wider text-[var(--adm-ink-2)]">Policy gate status</p>
          <p className="mt-2 text-2xl font-bold">
            {mandatoryReady ? (
              <span className="text-[var(--adm-success)]">5/5 Public</span>
            ) : (
              <span className="text-[var(--adm-warning)]">
                {MANDATORY_POLICY_SLUGS.filter((s) => vis.pages[s]).length}/5 Approved
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-[var(--adm-ink-2)]">
            {publicPageCount} pages & {publicArticleCount} articles live
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-4 text-xs text-[var(--adm-ink-2)]">
        <p className="font-semibold text-[var(--adm-ink)]">Customer protection invariant</p>
        <p className="mt-1">
          Links to policy and content pages are governed by <code>isLinkPublic()</code>. If a policy or guide is not published, its link is automatically withheld from public navigation so visitors never encounter broken links or 404s.
        </p>
      </div>

      <div className="space-y-8">
        <div className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]">
          <div className="border-b border-[var(--adm-divider)] p-5">
            <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--adm-ink)]">
              Header primary navigation
            </h2>
            <p className="text-xs text-[var(--adm-ink-2)]">
              Displayed on viewport ≥1180px and in the slide-out navigation drawer on smaller viewports.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--adm-divider)] bg-[var(--adm-surface-2)] text-[11px] uppercase tracking-wider text-[var(--adm-ink-2)]">
                <tr>
                  <th className="px-5 py-3">Menu label</th>
                  <th className="px-5 py-3">Destination URL</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Storefront status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--adm-divider)]">
                {HEADER_NAV.map((item) => {
                  const isPublic = isLinkPublic(item.href, vis);
                  return (
                    <tr key={item.href} className="hover:bg-[var(--adm-surface-2)]">
                      <td className="px-5 py-3 font-medium">
                        {item.label}
                        {item.isNew ? (
                          <span className="ml-2 rounded bg-[var(--lh-signal)] px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                            New
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 font-[family-name:var(--font-mono)] text-xs text-[var(--adm-ink-2)]">
                        {item.href}
                      </td>
                      <td className="px-5 py-3 capitalize text-xs text-[var(--adm-ink-2)]">
                        {item.type}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={isPublic ? "active" : "draft"}>
                          {isPublic ? "Visible to public" : "Gated (draft)"}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {item.type === "collection" ? (
                          <Link
                            href={`/admin/collections/${item.href.replace("/collections/", "")}`}
                            className="font-semibold text-[var(--lh-action)] hover:underline"
                          >
                            Edit collection
                          </Link>
                        ) : item.type === "content" ? (
                          <Link
                            href="/admin/content"
                            className="font-semibold text-[var(--lh-action)] hover:underline"
                          >
                            Edit page
                          </Link>
                        ) : (
                          <Link
                            href={item.href}
                            target="_blank"
                            rel="noopener"
                            className="font-semibold text-[var(--lh-action)] hover:underline"
                          >
                            View
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--adm-ink)]">
            Footer navigation columns
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FOOTER_COLUMNS.map((col) => (
              <div
                key={col.title}
                className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]"
              >
                <div className="border-b border-[var(--adm-divider)] bg-[var(--adm-surface-2)] px-4 py-3">
                  <h3 className="font-semibold text-sm text-[var(--adm-ink)]">{col.title}</h3>
                </div>
                <ul className="divide-y divide-[var(--adm-divider)] text-xs">
                  {col.links.map((link) => {
                    const isPublic = isLinkPublic(link.href, vis);
                    return (
                      <li key={link.href} className="flex items-center justify-between px-4 py-2.5">
                        <div className="min-w-0 pr-2">
                          <p className="truncate font-medium text-[var(--adm-ink)]">{link.label}</p>
                          <p className="truncate font-[family-name:var(--font-mono)] text-[11px] text-[var(--adm-ink-2)]">
                            {link.href}
                          </p>
                        </div>
                        <StatusBadge status={isPublic ? "active" : "draft"}>
                          {isPublic ? "Visible" : "Hidden"}
                        </StatusBadge>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
