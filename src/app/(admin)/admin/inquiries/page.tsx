import { requireStaffPage } from "@/lib/auth/staff";
import { INQUIRY_STAFF_ROLES } from "@/lib/auth/inquiry-roles";
import { createServiceClient } from "@/lib/supabase/server";
import { InquiryStatus } from "@/components/admin/inquiry-status";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { EmptyState } from "@/components/admin/ui/empty-state";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/** Contact-page and homepage inquiries with everything staff need to reply (tap-to-call, email, full message). */
export default async function AdminInquiriesPage() {
  await requireStaffPage(INQUIRY_STAFF_ROLES);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("contact_inquiries")
    .select("id, name, phone, email, subject, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = data || [];
  const open = rows.filter((i) => i.status !== "closed").length;

  return (
    <div>
      <AdminPageHeader
        title="Inquiries"
        description={rows.length ? `${open} not closed · newest first (latest 100)` : "Messages from the contact form and homepage."}
        breadcrumbs={[{ href: "/admin", label: "Overview" }, { label: "Inquiries" }]}
      />
      {rows.length === 0 ? (
        <EmptyState title="No inquiries yet" description="When customers submit the contact or homepage form, messages appear here for follow-up." />
      ) : (
        <ul className="space-y-3">
          {rows.map((i) => (
            <li
              key={i.id}
              data-testid="inquiry"
              className="space-y-2 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-[var(--adm-shadow)]"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{i.name}</p>
                <p className="text-xs text-[var(--adm-ink-2)]">{new Date(i.created_at).toLocaleString("en-PK")}</p>
              </div>
              <p className="text-sm font-medium">{i.subject || "(no subject)"}</p>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {i.phone ? (
                  <a href={`tel:${i.phone.replace(/[\s-]/g, "")}`} className="font-semibold text-[var(--adm-action)]">
                    {i.phone}
                  </a>
                ) : null}
                {i.email ? (
                  <a href={`mailto:${i.email}`} className="font-semibold text-[var(--adm-action)]">
                    {i.email}
                  </a>
                ) : null}
              </p>
              <p className="whitespace-pre-wrap text-sm text-[var(--adm-ink)]">{i.message}</p>
              <InquiryStatus id={i.id} status={i.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
