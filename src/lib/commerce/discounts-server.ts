import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import {
  campaignIsLive,
  type DiscountCampaign,
  type DiscountKind,
  type DiscountScope,
  type DiscountStatus,
} from "@/lib/commerce/pricing";

type Row = {
  id: string;
  name: string;
  description: string;
  kind: string;
  value: number;
  scope: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  announcement: string;
  show_announcement: boolean;
  code_required: boolean;
  created_at?: string;
  updated_at?: string;
};

export function mapDiscountRow(row: Row): DiscountCampaign {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    kind: row.kind as DiscountKind,
    value: row.value,
    scope: row.scope as DiscountScope,
    status: row.status as DiscountStatus,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    announcement: row.announcement || "",
    showAnnouncement: row.show_announcement !== false,
    codeRequired: !!row.code_required,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Live automatic campaign for storefront/checkout (no code). Cached per request. */
export const getActiveAutomaticDiscount = cache(async (): Promise<DiscountCampaign | null> => {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("discount_campaigns")
    .select(
      "id, name, description, kind, value, scope, status, starts_at, ends_at, announcement, show_announcement, code_required, created_at, updated_at",
    )
    .eq("code_required", false)
    .in("status", ["active", "scheduled"])
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error || !data?.length) return null;
  const now = new Date();
  const live = (data as Row[])
    .map(mapDiscountRow)
    .filter((c) => campaignIsLive(c, now))
    .sort((a, b) => (a.scope === "storewide" ? 0 : 1) - (b.scope === "storewide" ? 0 : 1));
  return live[0] ?? null;
});

export async function listDiscountCampaigns(): Promise<DiscountCampaign[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("discount_campaigns")
    .select(
      "id, name, description, kind, value, scope, status, starts_at, ends_at, announcement, show_announcement, code_required, created_at, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return ((data as Row[]) || []).map(mapDiscountRow);
}
