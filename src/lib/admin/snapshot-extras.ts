import type { SupabaseClient } from "@supabase/supabase-js";
import { LEGAL_CONTENT_SLUGS } from "@/lib/security/sanitize-html";

/**
 * G17 — backup payload v3 sections beyond the atomic core restore RPC (store_settings, articles, reels, testimonials,
 * shipping zones):
 *   content_pages  — restored through save_content_page (G19 history) when present, else a direct update. Legal pages
 *                    (shipping, returns, warranty, privacy, terms) are never bulk-restored: they keep their live text and
 *                    approval; restore one from its own page history instead. Pages missing live are not recreated.
 *   reel_products  — product links of the restored reels are set back to the backup (links to deleted products skipped).
 *   theme          — theme versions are immutable history already; the backup records the published homepage version
 *                    and restore re-points to it through rollback_homepage_theme (same rules as Theme › Rollback).
 * Each section reports what it did; a failing section never undoes the core restore (a pre-restore checkpoint exists).
 */
export type ThemeSection = { publications: unknown[]; versions: unknown[] };
export type ExtrasPayload = { content_pages?: unknown[]; reel_products?: unknown[]; theme?: ThemeSection };

export async function loadSnapshotExtras(load: (table: string, columns?: string) => Promise<unknown[]>) {
  const [content_pages, reel_products, publications, versions] = await Promise.all([
    load("content_pages"),
    load("reel_products"),
    load("theme_publications"),
    load("theme_versions", "id, template_id, label, status, sections, theme_settings, created_at, published_at"),
  ]);
  return { content_pages, reel_products, theme: { publications, versions } satisfies ThemeSection };
}

type Row = Record<string, unknown>;
/** Reel columns added after the core restore RPC (20261118081618); restored from the backup when present. */
const NEWER_REEL_COLUMNS = ["hls_url", "avatar_url", "media_source", "preset_key", "link_path", "source_attribution"] as const;
const rows = (v: unknown): Row[] => (Array.isArray(v) ? v.filter((r): r is Row => !!r && typeof r === "object") : []);
const missingFunction = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message || ""));

export type ExtrasReport = {
  content_pages: { restored: number; unchanged: number; keptLiveLegal: string[]; notRecreated: string[]; failed: string[]; withHistory: boolean } | null;
  reel_products: { reels: number; links: number; skippedMissingProduct: number; failed: string[] } | null;
  theme: { action: "unchanged" | "repointed" | "kept_live" | "failed" | "none_in_backup"; detail?: string } | null;
};

export async function restoreSnapshotExtras(
  supabase: SupabaseClient,
  payload: ExtrasPayload & { reels?: unknown[] },
  actor: string,
  note: string,
): Promise<ExtrasReport> {
  const report: ExtrasReport = { content_pages: null, reel_products: null, theme: null };

  // ── Content pages ──────────────────────────────────────────────────────────────────────────────────────────────
  if (Array.isArray(payload.content_pages)) {
    const r = { restored: 0, unchanged: 0, keptLiveLegal: [] as string[], notRecreated: [] as string[], failed: [] as string[], withHistory: true };
    const { data: liveRows, error } = await supabase.from("content_pages").select("*");
    if (error) r.failed.push(`load: ${error.message}`);
    const live = new Map(rows(liveRows).map((p) => [String(p.slug), p]));
    for (const snap of rows(payload.content_pages)) {
      const slug = String(snap.slug || "");
      if (!slug) continue;
      if (LEGAL_CONTENT_SLUGS.has(slug)) {
        r.keptLiveLegal.push(slug);
        continue;
      }
      const cur = live.get(slug);
      if (!cur) {
        r.notRecreated.push(slug);
        continue;
      }
      const same = (k: string) => (cur[k] ?? null) === (snap[k] ?? null);
      if (same("title") && same("body_html") && same("status") && same("seo_title") && same("seo_description")) {
        r.unchanged++;
        continue;
      }
      let done = false;
      if (r.withHistory && typeof cur.version === "number") {
        const { error: rpcErr } = await supabase.rpc("save_content_page", {
          payload: {
            actor_user_id: actor,
            slug,
            expected_version: cur.version,
            title: snap.title ?? cur.title,
            body_html: snap.body_html ?? "",
            status: snap.status ?? cur.status,
            seo_title: (snap.seo_title as string | null) ?? "",
            seo_description: (snap.seo_description as string | null) ?? "",
            action: "restore",
            note,
          },
        });
        if (!rpcErr) done = true;
        else if (missingFunction(rpcErr)) r.withHistory = false;
        else {
          r.failed.push(`${slug}: ${rpcErr.message}`);
          continue;
        }
      } else {
        r.withHistory = false;
      }
      if (!done) {
        const { error: upErr } = await supabase
          .from("content_pages")
          .update({ title: snap.title ?? cur.title, body_html: snap.body_html ?? "", status: snap.status ?? cur.status, updated_at: new Date().toISOString() })
          .eq("slug", slug);
        if (upErr) {
          r.failed.push(`${slug}: ${upErr.message}`);
          continue;
        }
      }
      r.restored++;
    }
    report.content_pages = r;
  }

  // ── Reel product links ─────────────────────────────────────────────────────────────────────────────────────────
  if (Array.isArray(payload.reel_products)) {
    const r = { reels: 0, links: 0, skippedMissingProduct: 0, failed: [] as string[] };
    const reelIds = rows(payload.reels).map((x) => String(x.id)).filter(Boolean);
    const snapLinks = rows(payload.reel_products);
    if (reelIds.length) {
      const [{ data: liveReels }, { data: products }] = await Promise.all([
        supabase.from("reels").select("id").in("id", reelIds),
        supabase.from("products").select("id").in("id", [...new Set(snapLinks.map((l) => String(l.product_id)))].slice(0, 5000)),
      ]);
      const reelSet = new Set(rows(liveReels).map((x) => String(x.id)));
      const productSet = new Set(rows(products).map((x) => String(x.id)));
      // The core RPC predates these reel columns and would leave a re-created reel without them; set them back here.
      for (const snapReel of rows(payload.reels)) {
        const id = String(snapReel.id || "");
        if (!reelSet.has(id)) continue;
        const patch: Row = {};
        for (const k of NEWER_REEL_COLUMNS) if (k in snapReel) patch[k] = snapReel[k];
        if (!Object.keys(patch).length) continue;
        const { error: cErr } = await supabase.from("reels").update(patch).eq("id", id);
        if (cErr) r.failed.push(`${id} columns: ${cErr.message}`);
      }
      for (const reelId of reelIds) {
        if (!reelSet.has(reelId)) continue;
        const wanted = snapLinks.filter((l) => String(l.reel_id) === reelId);
        const keep = wanted.filter((l) => productSet.has(String(l.product_id)));
        r.skippedMissingProduct += wanted.length - keep.length;
        const del = supabase.from("reel_products").delete().eq("reel_id", reelId);
        const { error: dErr } = keep.length
          ? await del.not("product_id", "in", `(${keep.map((l) => String(l.product_id)).join(",")})`)
          : await del;
        if (dErr) {
          r.failed.push(`${reelId}: ${dErr.message}`);
          continue;
        }
        if (keep.length) {
          const { error: iErr } = await supabase
            .from("reel_products")
            .upsert(keep.map((l) => ({ reel_id: reelId, product_id: l.product_id, sort_order: Number(l.sort_order) || 0 })), { onConflict: "reel_id,product_id" });
          if (iErr) {
            r.failed.push(`${reelId}: ${iErr.message}`);
            continue;
          }
        }
        r.reels++;
        r.links += keep.length;
      }
    }
    report.reel_products = r;
  }

  // ── Theme publication pointer ──────────────────────────────────────────────────────────────────────────────────
  if (payload.theme && Array.isArray(payload.theme.publications)) {
    const snapPub = rows(payload.theme.publications).find((p) => p.template_key === "homepage");
    const { data: livePub } = await supabase.from("theme_publications").select("published_version_id").eq("template_key", "homepage").maybeSingle();
    if (!snapPub) {
      report.theme = livePub
        ? { action: "kept_live", detail: "The backup has no published homepage theme; the live one stays published." }
        : { action: "none_in_backup" };
    } else if (livePub?.published_version_id === snapPub.published_version_id) {
      report.theme = { action: "unchanged" };
    } else if (process.env.THEME_PUBLISH_DISABLED === "1") {
      report.theme = { action: "kept_live", detail: "Theme publishing is switched off (THEME_PUBLISH_DISABLED)." };
    } else {
      const { error: rbErr } = await supabase.rpc("rollback_homepage_theme", {
        payload: { actor_user_id: actor, target_version_id: snapPub.published_version_id },
      });
      report.theme = rbErr ? { action: "failed", detail: rbErr.message } : { action: "repointed" };
    }
  }

  return report;
}
