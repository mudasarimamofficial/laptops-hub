import { requireStaffPage } from "@/lib/auth/staff";
import { REEL_STAFF_ROLES } from "@/lib/content/admin-roles";
import { createServiceClient } from "@/lib/supabase/server";
import { EMPTY_REEL, ReelForm, type ReelFormValues } from "@/components/admin/reel-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reels", robots: { index: false, follow: false } };

const RIGHTS: Record<string, string> = { pending: "Rights not confirmed", owned: "Owned", licensed: "Licensed" };

/** "Generation Laptops HUB" reels: the homepage row shows only published reels with confirmed rights. */
export default async function AdminReelsPage() {
  await requireStaffPage(REEL_STAFF_ROLES);
  const sb = createServiceClient();
  const { data } = await sb
    .from("reels")
    .select("id, title, caption, video_url, poster_url, rights_status, rights_note, status, sort_order, creator_name, creator_consent, tag, products(handle)")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data || [];
  const live = rows.filter((r) => r.status === "published").length;

  return (
    <div className="lh-container py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Reels</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--lh-ink-2)]">
        Short videos for the homepage “Generation Laptops HUB” row. The row appears only when at least one reel is published, and a reel
        can be published only after you confirm Laptops HUB owns or has licensed the video. {rows.length ? `${live} of ${rows.length} published.` : null}
      </p>

      <section aria-labelledby="new-reel" className="mt-6 rounded-[var(--lh-radius-card)] border border-[var(--lh-border)] bg-white p-5">
        <h2 id="new-reel" className="mb-3 font-semibold">Add a reel</h2>
        <ReelForm initial={EMPTY_REEL} />
      </section>

      {rows.length === 0 ? (
        <p className="mt-6 text-[var(--lh-ink-2)]">No reels yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => {
            const initial: ReelFormValues = {
              title: r.title,
              caption: r.caption,
              videoUrl: r.video_url,
              posterUrl: r.poster_url || "",
              productHandle: (r.products as { handle?: string } | null)?.handle || "",
              rightsStatus: r.rights_status as ReelFormValues["rightsStatus"],
              rightsNote: r.rights_note,
              status: r.status as ReelFormValues["status"],
              sortOrder: r.sort_order,
              creatorName: r.creator_name ?? "",
              creatorConsent: r.creator_consent === true,
              tag: r.tag ?? "",
            };
            return (
              <li key={r.id} data-testid="reel-row" className="rounded-xl border border-[var(--lh-border)] bg-white p-4">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">{r.title}</span>
                    <span className="text-xs text-[var(--lh-ink-2)]">
                      {r.status} · {RIGHTS[r.rights_status] ?? r.rights_status}
                    </span>
                  </summary>
                  <div className="mt-4">
                    <ReelForm id={r.id} initial={initial} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
