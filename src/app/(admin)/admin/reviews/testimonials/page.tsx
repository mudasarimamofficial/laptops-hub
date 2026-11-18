import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { TestimonialManager, type AdminTestimonial, type AuditEntry } from "@/components/admin/testimonial-manager";
import { adminSearchTerm } from "@/lib/admin/search-term";
import {
  TESTIMONIAL_APPROVE_ROLES,
  TESTIMONIAL_EDIT_ROLES,
  TESTIMONIAL_SOURCES,
  TESTIMONIAL_STATUSES,
} from "@/lib/content/testimonials";

export const dynamic = "force-dynamic";
export const metadata = { title: "Store testimonials", robots: { index: false, follow: false } };

const SORTS = {
  updated: { label: "Recently changed", col: "updated_at", asc: false },
  display: { label: "Homepage order", col: "sort_order", asc: true },
  review_date: { label: "Review date", col: "review_date", asc: false },
} as const;

type SP = { status?: string; source?: string; q?: string; sort?: string };

/** Store testimonials for the homepage reviews carousel: add, check, approve, hide — with provenance and history. */
export default async function TestimonialsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const staff = await requireStaffPage(TESTIMONIAL_EDIT_ROLES);
  const sp = await searchParams;
  const status = (TESTIMONIAL_STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status! : "";
  const source = (TESTIMONIAL_SOURCES as readonly string[]).includes(sp.source ?? "") ? sp.source! : "";
  const sortKey = (sp.sort && sp.sort in SORTS ? sp.sort : "updated") as keyof typeof SORTS;
  const q = adminSearchTerm(sp.q ?? "");
  const sb = createServiceClient();

  let query = sb
    .from("store_testimonials")
    .select(
      "id, author_name, rating, body, review_date, source, source_url, avatar_url, avatar_permission, consent_confirmed, verification_note, status, show_on_homepage, featured, sort_order, published_at, updated_at",
    )
    .order(SORTS[sortKey].col, { ascending: SORTS[sortKey].asc, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  if (source) query = query.eq("source", source);
  if (q) query = query.or(`author_name.ilike.%${q}%,body.ilike.%${q}%`);

  const [{ data, error }, { data: counts }] = await Promise.all([query, sb.from("store_testimonials").select("status")]);
  if (error) console.error("testimonials list failed", error.code);
  const rows = (data ?? []) as AdminTestimonial[];
  const ids = rows.map((r) => r.id);
  const { data: logs } = ids.length
    ? await sb
        .from("audit_logs")
        .select("entity_id, action, actor_user_id, created_at")
        .eq("entity_type", "store_testimonials")
        .in("entity_id", ids)
        .order("created_at", { ascending: false })
        .limit(600)
    : { data: [] };
  const history: Record<string, AuditEntry[]> = {};
  for (const l of logs ?? []) (history[l.entity_id as string] ??= []).push(l as AuditEntry);
  const byStatus = (s: string) => (counts ?? []).filter((c) => c.status === s).length;

  return (
    <>
      <AdminPageHeader
        title="Store testimonials"
        description={
          "Reviews of the store shown in the full-width “What our customers say” section on the homepage. Only published entries are public, and each shows where it came from."
        }
        breadcrumbs={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/reviews", label: "Reviews" },
          { label: "Store testimonials" },
        ]}
      />
      <nav aria-label="Review type" className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/reviews" className="rounded-full border border-[var(--adm-border)] bg-white px-3 py-1">
          Product reviews
        </Link>
        <span aria-current="page" className="rounded-full border border-[var(--adm-action)] bg-[var(--adm-info-bg)] px-3 py-1 font-semibold">
          Store testimonials
        </span>
      </nav>
      {error ? (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Testimonials could not be loaded. Try again in a moment.
        </p>
      ) : null}
      <TestimonialManager
        rows={rows}
        history={history}
        canApprove={TESTIMONIAL_APPROVE_ROLES.includes(staff.role)}
        filters={{ status, source, q: sp.q ?? "", sort: sortKey }}
        sorts={Object.entries(SORTS).map(([value, v]) => ({ value, label: v.label }))}
        counts={{ draft: byStatus("draft"), pending: byStatus("pending"), published: byStatus("published"), hidden: byStatus("hidden") }}
      />
    </>
  );
}
