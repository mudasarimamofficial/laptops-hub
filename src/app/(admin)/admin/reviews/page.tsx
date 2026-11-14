import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/staff";
import { REVIEW_STAFF_ROLES } from "@/lib/content/admin-roles";
import { createServiceClient } from "@/lib/supabase/server";
import { ReviewModeration } from "@/components/admin/review-moderation";

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
    <div className="lh-container py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Reviews</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--lh-ink-2)]">
        Customer reviews appear on the product page only after you approve them. Approve honest reviews, good or bad; reject spam, abuse or
        personal data. Reviews cannot be edited or written by staff.
      </p>
      <nav aria-label="Review status" className="mt-4 flex flex-wrap gap-2 text-sm">
        {TABS.map(([k, l]) => (
          <Link
            key={k}
            href={`/admin/reviews?status=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${tab === k ? "border-[var(--lh-action)] bg-[var(--lh-ice)] font-semibold" : "border-[var(--lh-border)] bg-white"}`}
          >
            {l}
            {k === "pending" && waiting ? ` (${waiting})` : ""}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="mt-6 text-[var(--lh-ink-2)]">{tab === "pending" ? "No reviews waiting." : "None."}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => {
            const p = r.products as { handle?: string; title?: string } | null;
            return (
              <li key={r.id} data-testid="review-row" className="space-y-2 rounded-xl border border-[var(--lh-border)] bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    <span aria-label={`${r.rating} out of 5`}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span> · {r.author_name}
                  </p>
                  <p className="text-xs text-[var(--lh-ink-2)]">{new Date(r.created_at).toLocaleString("en-PK")}</p>
                </div>
                {p?.handle ? (
                  <p className="text-xs">
                    <Link href={`/products/${p.handle}`} className="text-[var(--lh-action)]" target="_blank">
                      {p.title || p.handle}
                    </Link>
                  </p>
                ) : null}
                {r.title ? <p className="text-sm font-medium">{r.title}</p> : null}
                <p className="whitespace-pre-wrap text-sm">{r.body}</p>
                {r.reviewer_email ? <p className="text-xs text-[var(--lh-ink-2)]">Email (private): {r.reviewer_email}</p> : null}
                {r.moderation_note ? <p className="text-xs text-[var(--lh-ink-2)]">Note: {r.moderation_note}</p> : null}
                <ReviewModeration id={r.id} status={r.status} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
