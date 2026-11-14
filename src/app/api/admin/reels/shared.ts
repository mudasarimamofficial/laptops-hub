import type { SupabaseClient } from "@supabase/supabase-js";
import { reelInputSchema } from "@/lib/content/reels";

export type ReelRow = {
  title: string;
  caption: string;
  video_url: string;
  poster_url: string | null;
  product_id: string | null;
  rights_status: "pending" | "owned" | "licensed";
  rights_note: string;
  status: "draft" | "published" | "archived";
  sort_order: number;
};

type Built = { ok: true; row: ReelRow } | { ok: false; status: number; body: Record<string, unknown> };

/** Validates staff input and resolves the optional linked product (must exist and not be deleted). */
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
  let productId: string | null = null;
  if (v.productHandle) {
    const { data } = await supabase.from("products").select("id").eq("handle", v.productHandle).is("deleted_at", null).maybeSingle();
    if (!data) {
      return { ok: false, status: 400, body: { error: "validation_failed", message: "Check the highlighted fields.", fieldErrors: { productHandle: "No product with this handle." } } };
    }
    productId = data.id;
  }
  return {
    ok: true,
    row: {
      title: v.title,
      caption: v.caption,
      video_url: v.videoUrl,
      poster_url: v.posterUrl || null,
      product_id: productId,
      rights_status: v.rightsStatus,
      rights_note: v.rightsNote,
      status: v.status,
      sort_order: v.sortOrder,
    },
  };
}
