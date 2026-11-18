import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/staff";
import { REVIEW_STAFF_ROLES } from "@/lib/content/admin-roles";
import { createServiceClient } from "@/lib/supabase/server";
import { ReviewModeration } from "@/components/admin/review-moderation";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { EmptyState } from "@/components/admin/ui/empty-state";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reviews", robots: { index: false, follow: false } };

const TABS = [
  ["pending", "Waiting"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
] as const;
type Tab = (typeof TABS)[number][0];

/** Customer reviews: nothing is public until approved here. Reviews are shown exactly as written. */
export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaffPage(REVIEW_STAFF_ROLES);
  const sp = await searchParams;
  const tab: Tab = TABS.some(([k]) => k === sp.status) ? (sp.status as Tab) : "pending";
  const sb = createServiceClient();
  const [{ data }, { count: waiting }] = await Promise.all([
    sb
      .from("product_reviews")
      .select("id, author_name, rating, title, body, status, reviewer_email, created_at, moderation_note, products(handle, title)")
      .eq("status", tab)
      .order("created_at", { ascending: tab === "pending" })
      .limit(100),
    sb.from("product_reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const rows = data || [];

  return (
    <>
      <AdminPageHeader
        title="Reviews"
        description="Customer product reviews appear on the product page only after you approve them. Approve honest reviews (good or bad); reject spam, abuse or personal data. Staff cannot rewrite customer text. Storefront Google-listing testimonials are managed separately and keep their source attribution."
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Reviews" }]}
      />

      <nav aria-label="Review type" className="mb-4 flex flex-wrap gap-2 text-sm">
        <span aria-current="page" className="rounded-full border border-[var(--adm-action)] bg-[var(--adm-info-bg)] px-3 py-1 font-semibold">
          Product reviews
        </span>
        <Link
          href="/admin/reviews/testimonials"
          className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-1"
          data-testid="reviews-testimonials-tab"
        >
          Store testimonials (homepage)
        </Link>
      </nav>

      <nav aria-label="Review status" className="mb-6 flex flex-wrap gap-2 text-sm">
        {TABS.map(([k, l]) => (
          <Link
            key={k}
            href={`/admin/reviews?status=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${
              tab === k
                ? "border-[var(--adm-action)] bg-[var(--adm-info-bg)] font-semibold"
                : "border-[var(--adm-border)] bg-[var(--adm-surface)]"
            }`}
          >
            {l}
            {k === "pending" && waiting ? ` (${waiting})` : ""}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          title={tab === "pending" ? "No reviews waiting" : "Nothing in this status"}
          description={
            tab === "pending"
              ? "When shoppers leave a product review, it appears here for approval before it can show publicly."
              : "Switch status tabs to see approved or rejected reviews."
          }
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const p = r.products as { handle?: string; title?: string } | null;
            return (
              <li
                key={r.id}
                data-testid="review-row"
                className="space-y-2 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-[var(--adm-shadow)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-[var(--adm-ink)]">
                    <span aria-label={`${r.rating} out of 5`}>
                      {"★".repeat(r.rating)}
                      {"☆".repeat(5 - r.rating)}
                    </span>{" "}
                    · {r.author_name}
                  </p>
                  <p className="text-xs text-[var(--adm-ink-2)]">{new Date(r.created_at).toLocaleString("en-PK")}</p>
                </div>
                {p?.handle ? (
                  <p className="text-xs">
                    <Link href={`/products/${p.handle}`} className="font-medium text-[var(--adm-action)]" target="_blank">
                      {p.title || p.handle}
                    </Link>
                    <span className="text-[var(--adm-ink-2)]"> · product page</span>
                  </p>
                ) : null}
                {r.title ? <p className="text-sm font-medium text-[var(--adm-ink)]">{r.title}</p> : null}
                <p className="whitespace-pre-wrap text-sm text-[var(--adm-ink)]">{r.body}</p>
                {r.reviewer_email ? <p className="text-xs text-[var(--adm-ink-2)]">Email (private): {r.reviewer_email}</p> : null}
                {r.moderation_note ? <p className="text-xs text-[var(--adm-ink-2)]">Note: {r.moderation_note}</p> : null}
                <ReviewModeration id={r.id} status={r.status} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
