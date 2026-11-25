import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Specs that assert exact list prices or cash totals pause the automatic discount campaigns for their run (production
 * and the isolated DB both carry an active "Storewide 5% Off"), and resume exactly those afterwards. LOCAL DB only:
 * callers must have passed `assertLocalOnly` first.
 */
export async function pauseActiveCampaigns(sb: SupabaseClient): Promise<string[]> {
  const { data } = await sb.from("discount_campaigns").select("id").eq("status", "active");
  const ids = (data || []).map((c) => c.id as string);
  if (ids.length) {
    const { error } = await sb.from("discount_campaigns").update({ status: "disabled" }).in("id", ids);
    if (error) throw error;
  }
  return ids;
}

export async function resumeCampaigns(sb: SupabaseClient, ids: string[]) {
  if (ids.length) await sb.from("discount_campaigns").update({ status: "active" }).in("id", ids);
}
