import Image from "next/image";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { CmsMediaUploadPanel } from "@/components/admin/cms-media-upload-panel";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminMediaLibraryPage() {
  await requireStaffPage(["owner", "admin", "manager", "editor"]);
  const supabase = createServiceClient();
  const [{ count: total }, { count: pending }, { data: productMedia }, cms] = await Promise.all([
    supabase.from("product_media").select("id", { count: "exact", head: true }),
    supabase.from("product_media").select("id", { count: "exact", head: true }).eq("approval", "pending"),
    supabase
      .from("product_media")
      .select("id, url, alt, position, approval, products(handle, title)")
      .order("created_at", { ascending: false })
      .limit(36),
    supabase.from("cms_media_assets").select("id, public_url, alt, created_at").order("created_at", { ascending: false }).limit(36),
  ]);

  const cmsRows = cms.error ? [] : cms.data || [];
  const productRows = productMedia || [];
  const empty = cmsRows.length === 0 && productRows.length === 0;

  return (
    <>
      <AdminPageHeader
        title="Media library"
        description={`${cmsRows.length} CMS uploads shown · ${total ?? 0} product image references · ${pending ?? 0} product rights pending. Upload images for Blog and pages. Rights status is a record for your team — it does not hide images from customers.`}
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Media" }]}
      />

      <CmsMediaUploadPanel />

      {empty ? (
        <EmptyState
          title="No media yet"
          description="Upload a store image above, or add product images from a product page. The rights status is a record for your team: it does not hide an image from customers."
        />
      ) : null}

      {cmsRows.length ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-[var(--adm-ink)]">CMS uploads</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cmsRows.map((m) => (
              <article
                key={m.id}
                className="overflow-hidden rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]"
              >
                <div className="relative aspect-[4/3] bg-[var(--adm-surface-2)]">
                  <Image src={m.public_url} alt={m.alt || ""} fill className="object-contain" sizes="280px" unoptimized />
                </div>
                <div className="space-y-1 p-3 text-sm">
                  <StatusBadge status="published">CMS</StatusBadge>
                  <p className="text-[var(--adm-ink-2)]">{m.alt || "No alt text"}</p>
                  <p className="text-xs text-[var(--adm-ink-muted)]">{new Date(m.created_at).toLocaleString("en-PK")}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {productRows.length ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--adm-ink)]">Product image references</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {productRows.map((m) => {
              const raw = m.products as unknown;
              const product = (Array.isArray(raw) ? raw[0] : raw) as { handle: string; title: string } | null;
              return (
                <article
                  key={m.id}
                  className="overflow-hidden rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]"
                >
                  <div className="relative aspect-[4/3] bg-[var(--adm-surface-2)]">
                    <Image src={m.url} alt={m.alt || ""} fill className="object-contain" sizes="280px" unoptimized />
                  </div>
                  <div className="space-y-1 p-3 text-sm">
                    <StatusBadge status={m.approval === "approved" ? "active" : "pending"} />
                    {product ? (
                      <Link href={`/admin/products/${product.handle}`} className="block font-medium text-[var(--adm-action)] hover:underline">
                        {product.title}
                      </Link>
                    ) : (
                      <p className="text-[var(--adm-ink-2)]">Unlinked</p>
                    )}
                    <p className="truncate font-[family-name:var(--font-mono)] text-[10px] text-[var(--adm-ink-2)]" title={m.url}>
                      {m.url}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}
