import { requireStaffPage } from "@/lib/auth/staff";
import { REEL_STAFF_ROLES } from "@/lib/content/admin-roles";
import { createServiceClient } from "@/lib/supabase/server";
import { EMPTY_REEL, ReelForm, type ReelFormValues } from "@/components/admin/reel-form";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { SeedReelsPresetsButton } from "@/components/admin/seed-reels-presets-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reels", robots: { index: false, follow: false } };

const RIGHTS: Record<string, string> = { pending: "Rights not confirmed", owned: "Owned", licensed: "Licensed" };

/** "Generation Laptops HUB" reels: homepage shows only published reels with confirmed rights. */
export default async function AdminReelsPage() {
  await requireStaffPage(REEL_STAFF_ROLES);
  const sb = createServiceClient();
  const { data } = await sb
    .from("reels")
    .select(
      "id, title, caption, video_url, hls_url, poster_url, avatar_url, media_source, link_path, source_attribution, rights_status, rights_note, status, sort_order, creator_name, creator_consent, tag, preset_key, products(handle)",
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data || [];
  const live = rows.filter((r) => r.status === "published").length;
  const pendingRights = rows.filter((r) => r.rights_status === "pending").length;

  return (
    <div>
      <AdminPageHeader
        title="Reels"
        description='Short videos for the homepage “Generation Laptops HUB” row. Use uploaded files or external HTTPS MP4/WebM/MOV (optional HLS). External hosts are allowed. Publishing still requires confirmed owned/licensed rights — a public URL is not a license or endorsement.'
        breadcrumbs={[{ href: "/admin", label: "Admin" }, { label: "Reels" }]}
        actions={<SeedReelsPresetsButton />}
      />
      {rows.length ? (
        <p className="mb-4 text-sm text-[var(--adm-ink-2)]">
          {live} of {rows.length} published
          {pendingRights ? ` · ${pendingRights} still need rights confirmation` : null}.
        </p>
      ) : null}

      <section
        aria-labelledby="new-reel"
        className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[var(--adm-shadow)]"
      >
        <h2 id="new-reel" className="mb-3 font-semibold text-[var(--adm-ink)]">
          Add a reel
        </h2>
        <ReelForm initial={EMPTY_REEL} />
      </section>

      {rows.length === 0 ? (
        <div
          data-testid="reels-empty"
          className="mt-6 rounded-[var(--adm-radius-lg)] border border-dashed border-[var(--adm-border)] bg-[var(--adm-surface)] p-8 text-center"
        >
          <p className="font-semibold text-[var(--adm-ink)]">No reels yet</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--adm-ink-2)]">
            Restore the six Generation Laptops HUB reference presets, or add a reel with an HTTPS media URL. Presets stay
            drafts until you confirm rights.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => {
            const initial: ReelFormValues = {
              title: r.title,
              caption: r.caption,
              mediaSource: (r.media_source as ReelFormValues["mediaSource"]) || "external_file",
              videoUrl: r.video_url,
              hlsUrl: r.hls_url || "",
              posterUrl: r.poster_url || "",
              avatarUrl: r.avatar_url || "",
              productHandle: (r.products as { handle?: string } | null)?.handle || "",
              linkPath: r.link_path || "",
              rightsStatus: r.rights_status as ReelFormValues["rightsStatus"],
              rightsNote: r.rights_note,
              sourceAttribution: r.source_attribution || "",
              status: r.status as ReelFormValues["status"],
              sortOrder: r.sort_order,
              creatorName: r.creator_name ?? "",
              creatorConsent: r.creator_consent === true,
              tag: r.tag ?? "",
              presetKey: r.preset_key || "",
            };
            return (
              <li
                key={r.id}
                data-testid="reel-row"
                className="rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4"
              >
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-[var(--adm-ink)]">{r.title}</span>
                    <span className="text-xs text-[var(--adm-ink-2)]">
                      {r.status} · {RIGHTS[r.rights_status] ?? r.rights_status}
                      {r.preset_key ? ` · ${r.preset_key}` : ""}
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
