import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { adminProductCounts } from "@/lib/catalog/queries";
import { PendingBlock } from "@/components/ui/pending-block";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let counts = { total: 0, active: 0, draft: 0, media: 0 };
  let staff = false;
  try {
    if (user) {
      const { data: membership } = await supabase
        .from("admin_memberships")
        .select("role, is_active")
        .eq("user_id", user.id)
        .maybeSingle();
      staff = Boolean(membership?.is_active);
    }
    counts = await adminProductCounts();
  } catch {
    /* schema may not be applied yet */
  }

  return (
    <div className="lh-container py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em]">Overview</h1>
      <p className="mt-2 text-sm text-[var(--lh-ink-2)]">
        Signed in: {user?.email ?? "no"} · Staff membership: {staff ? "yes" : "no"}
      </p>

      {!user ? (
        <div className="mt-6">
          <PendingBlock title="Sign in required">
            <Link href="/admin/login" className="text-[var(--lh-action)]">
              Go to admin login
            </Link>
          </PendingBlock>
        </div>
      ) : !staff ? (
        <div className="mt-6">
          <PendingBlock title="No staff membership">
            Bootstrap the first owner via audited SQL insert into <code>admin_memberships</code> for your auth user id.
            There is no public self-registration for admin.
          </PendingBlock>
        </div>
      ) : null}

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
        <li><Link href="/admin/orders">Orders &amp; COD collection</Link></li>
        <li><Link href="/admin/products">Catalog</Link></li>
        <li><Link href="/admin/settings">Store settings / shipping</Link></li>
        <li><Link href="/admin/inquiries">Inquiries</Link></li>
      </ul>
    </div>
  );
}
