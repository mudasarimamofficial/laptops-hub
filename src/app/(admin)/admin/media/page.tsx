import Image from "next/image";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminMediaLibraryPage() {
  await requireStaffPage(["owner", "admin", "manager", "editor"]);
  const supabase = createServiceClient();
  const { count: total } = await supabase.from("product_media").select("id", { count: "exact", head: true });
  const { count: pending } = await supabase
    .from("product_media")
    .select("id", { count: "exact", head: true })
    .eq("approval", "pending");
  const { data } = await supabase
    .from("product_media")
    .select("id, url, alt, position, approval, products(handle, title)")
    .order("created_at", { ascending: false })
    .limit(48);

  return (
    <>
      <AdminPageHeader
        title="Media library"
        description={`${total ?? 0} product image references · ${pending ?? 0} rights pending. External Shopify CDN URLs are stored as references — not auto-approved.`}
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Media" }]}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {(data || []).map((m) => {
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
                  <Link href={`/admin/products/${product.handle}`} className="block font-medium text-[var(--lh-action)] hover:underline">
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
    </>
  );
}
