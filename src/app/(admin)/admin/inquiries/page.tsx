import { requireStaffPage } from "@/lib/auth/staff";
import { INQUIRY_STAFF_ROLES } from "@/lib/auth/inquiry-roles";
import { createServiceClient } from "@/lib/supabase/server";
import { InquiryStatus } from "@/components/admin/inquiry-status";

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
    <div className="lh-container py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Inquiries</h1>
      <p className="mt-2 text-sm text-[var(--lh-ink-2)]">
        {rows.length ? `${open} not closed · newest first (latest 100)` : null}
      </p>
      {rows.length === 0 ? (
        <p className="mt-6 text-[var(--lh-ink-2)]">No inquiries yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((i) => (
            <li key={i.id} data-testid="inquiry" className="space-y-2 rounded-xl border border-[var(--lh-border)] bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{i.name}</p>
                <p className="text-xs text-[var(--lh-ink-2)]">{new Date(i.created_at).toLocaleString("en-PK")}</p>
              </div>
              <p className="text-sm font-medium">{i.subject || "(no subject)"}</p>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {i.phone ? (
                  <a href={`tel:${i.phone.replace(/[\s-]/g, "")}`} className="text-[var(--lh-action)]">
                    {i.phone}
                  </a>
                ) : null}
                {i.email ? (
                  <a href={`mailto:${i.email}`} className="text-[var(--lh-action)]">
                    {i.email}
                  </a>
                ) : null}
              </p>
              <p className="whitespace-pre-wrap text-sm text-[var(--lh-ink)]">{i.message}</p>
              <InquiryStatus id={i.id} status={i.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
