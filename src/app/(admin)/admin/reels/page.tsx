import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/staff";
import { REEL_STAFF_ROLES } from "@/lib/content/admin-roles";
import { createServiceClient } from "@/lib/supabase/server";
import { isRenderableReel, type PublicReel } from "@/lib/content/reels";
import { EMPTY_REEL, ReelForm, type ReelFormValues } from "@/components/admin/reel-form";
import { ReelsCarouselPreview } from "@/components/admin/reels-carousel-preview";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { SeedReelsPresetsButton } from "@/components/admin/seed-reels-presets-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Generation reels", robots: { index: false, follow: false } };

const RIGHTS: Record<string, string> = { pending: "Rights not confirmed", owned: "Owned", licensed: "Licensed" };

/** Homepage “Generation Laptops HUB” row — public only shows published + owned/licensed. */
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
  const live = rows.filter((r) => r.status === "published" && (r.rights_status === "owned" || r.rights_status === "licensed")).length;
  const pendingRights = rows.filter((r) => r.rights_status === "pending").length;
  const drafts = rows.filter((r) => r.status === "draft").length;

  const previewReels: PublicReel[] = rows
    .filter((r) => r.status !== "archived")
    .map((r) => ({
      id: r.id,
      title: r.title,
      caption: r.caption,
      videoUrl: r.video_url,
      hlsUrl: r.hls_url ?? null,
      posterUrl: r.poster_url,
      avatarUrl: r.avatar_url ?? null,
      productHandle: (r.products as { handle?: string } | null)?.handle ?? null,
      linkPath: r.link_path ?? null,
      creatorName: r.creator_consent ? (r.creator_name ?? "") : "",
      tag: r.tag ?? "",
    }))
    .filter(isRenderableReel);

  return (
    <div>
      <AdminPageHeader
        title="Generation reels"
        description='Short videos for the homepage “Generation Laptops HUB” row (Online store → Content → Generation reels). External HTTPS MP4/HLS is allowed. Publishing still requires owned/licensed rights — a public URL is not a license or endorsement.'
        breadcrumbs={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/content", label: "Content" },
          { label: "Generation reels" },
        ]}
        actions={<SeedReelsPresetsButton />}
      />

      <div className="mb-6 rounded-[var(--adm-radius-lg)] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 text-sm text-[var(--adm-ink-2)]">
        <p>
          <span className="font-semibold text-[var(--adm-ink)]">{live}</span> public-ready ·{" "}
          <span className="font-semibold text-[var(--adm-ink)]">{drafts}</span> drafts ·{" "}
          <span className="font-semibold text-[var(--adm-ink)]">{rows.length}</span> total
          {pendingRights ? ` · ${pendingRights} still need rights confirmation` : null}.
        </p>
        <p className="mt-1">
          Customers only see published reels with Owned or Licensed rights. Use the preview below for drafts without
          exposing them on the storefront.{" "}
          <Link href="/" className="font-semibold text-[var(--adm-action)] underline" target="_blank" rel="noreferrer">
            Open homepage
          </Link>
          .
        </p>
      </div>

      <div className="mb-8">
        <ReelsCarouselPreview reels={previewReels} />
      </div>

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
