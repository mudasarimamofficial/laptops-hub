import type { SupabaseClient } from "@supabase/supabase-js";
import { reelInputSchema } from "@/lib/content/reels";

export type ReelRow = {
  title: string;
  caption: string;
  video_url: string;
  hls_url: string | null;
  poster_url: string | null;
  avatar_url: string | null;
  media_source: "uploaded" | "external_file" | "external_stream";
  product_id: string | null;
  link_path: string | null;
  rights_status: "pending" | "owned" | "licensed";
  rights_note: string;
  source_attribution: string;
  status: "draft" | "published" | "archived";
  sort_order: number;
  creator_name: string;
  creator_consent: boolean;
  tag: string;
  preset_key: string | null;
};

type Built =
  | { ok: true; row: ReelRow; productIds: string[] }
  | { ok: false; status: number; body: Record<string, unknown> };

/** Validates staff input and resolves linked products (legacy single handle + multi handles). */
export async function reelRowFromInput(supabase: SupabaseClient, body: unknown): Promise<Built> {
  const parsed = reelInputSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "form");
      if (!fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { ok: false, status: 400, body: { error: "validation_failed", message: "Check the highlighted fields.", fieldErrors } };
  }
  const v = parsed.data;
  const handles = [...v.productHandles];
  if (v.productHandle && !handles.includes(v.productHandle)) handles.unshift(v.productHandle);

  const productIds: string[] = [];
  if (handles.length) {
    const { data } = await supabase
      .from("products")
      .select("id, handle, status")
      .in("handle", handles)
      .is("deleted_at", null);
    const byHandle = new Map((data || []).map((p) => [p.handle, p]));
    for (const h of handles) {
      const row = byHandle.get(h);
      if (!row) {
        return {
          ok: false,
          status: 400,
          body: {
            error: "validation_failed",
            message: "Check the highlighted fields.",
            fieldErrors: { productHandles: `No product with handle “${h}”.` },
          },
        };
      }
      if (row.status !== "active") {
        return {
          ok: false,
          status: 400,
          body: {
            error: "validation_failed",
            message: "Check the highlighted fields.",
            fieldErrors: { productHandles: `“${h}” is ${row.status} and cannot be featured on the storefront.` },
          },
        };
      }
      if (!productIds.includes(row.id)) productIds.push(row.id);
    }
  }

  return {
    ok: true,
    productIds,
    row: {
      title: v.title,
      caption: v.caption,
      video_url: v.videoUrl,
      hls_url: v.hlsUrl || null,
      poster_url: v.posterUrl || null,
      avatar_url: v.avatarUrl || null,
      media_source: v.mediaSource,
      product_id: productIds[0] ?? null,
      link_path: v.linkPath || null,
      rights_status: v.rightsStatus,
      rights_note: v.rightsNote,
      source_attribution: v.sourceAttribution,
      status: v.status,
      sort_order: v.sortOrder,
      creator_name: v.creatorName,
      creator_consent: v.creatorName ? v.creatorConsent : false,
      tag: v.tag.replace(/^#/, ""),
      preset_key: v.presetKey || null,
    },
  };
}

/** Replace ordered reel_products rows for a reel (service-role client). */
export async function replaceReelProducts(
  supabase: SupabaseClient,
  reelId: string,
  productIds: string[],
): Promise<{ error: string | null }> {
  const { error: delErr } = await supabase.from("reel_products").delete().eq("reel_id", reelId);
  if (delErr) return { error: delErr.message };
  if (!productIds.length) return { error: null };
  const { error: insErr } = await supabase.from("reel_products").insert(
    productIds.map((product_id, sort_order) => ({ reel_id: reelId, product_id, sort_order })),
  );
  return { error: insErr?.message ?? null };
}
