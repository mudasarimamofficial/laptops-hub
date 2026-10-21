import { createServiceClient } from "@/lib/supabase/server";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminInquiriesPage() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("contact_inquiries")
    .select("id, name, subject, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="lh-container py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Inquiries</h1>
      {(data || []).length === 0 ? (
        <p className="mt-6 text-[var(--lh-ink-2)]">No inquiries yet.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {data!.map((i) => (
            <li key={i.id} className="rounded-xl border border-[var(--lh-border)] bg-white p-4">
              <p className="font-semibold">{i.name}</p>
              <p className="text-sm text-[var(--lh-ink-2)]">
                {i.subject || "(no subject)"} · {i.status} · {new Date(i.created_at).toLocaleString("en-PK")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
