import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

async function staffSafeCounts() {
  const supabase = createServiceClient();
  const { count: total } = await supabase.from("products").select("id", { count: "exact", head: true });
  const { count: active } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  const { count: draft } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft");
  const { count: media } = await supabase.from("product_media").select("id", { count: "exact", head: true });
  return {
    total: total ?? 0,
    active: active ?? 0,
    draft: draft ?? 0,
    media: media ?? 0,
  };
}

export default async function AdminHomePage() {
  const staff = await requireStaffPage();
  const counts = await staffSafeCounts();

  return (
    <div className="lh-container py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em]">Overview</h1>
      <p className="mt-2 text-sm text-[var(--lh-ink-2)]">
        {staff.email} · role <strong>{staff.role}</strong>
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Products", counts.total],
          ["Public active", counts.active],
          ["Drafts", counts.draft],
          ["Media rows", counts.media],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-5">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider text-[var(--lh-ink-2)]">
              {label}
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <ul className="mt-10 space-y-2 text-sm font-semibold text-[var(--lh-action)]">
        <li>
          <Link href="/admin/orders">Orders &amp; COD collection</Link>
        </li>
        <li>
          <Link href="/admin/products">Catalog</Link>
        </li>
        <li>
          <Link href="/admin/content">Content pages</Link>
        </li>
        <li>
          <Link href="/admin/settings">Store settings / shipping</Link>
        </li>
        <li>
          <Link href="/admin/inquiries">Inquiries</Link>
        </li>
      </ul>
    </div>
  );
}
