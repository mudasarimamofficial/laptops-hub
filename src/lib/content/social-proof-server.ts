import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getV5Catalog } from "@/lib/catalog/v5";
import {
  buildActivityItems,
  buildBadgeMap,
  computeTopSellers,
  DEFAULT_SOCIAL_PROOF,
  parseSocialProof,
  QUALIFYING_STATUSES,
  SOCIAL_PROOF_KEY,
  type ActivityItem,
  type EditorialBadgeRow,
  type MerchBadgeMap,
  type OrderActivityRow,
  type SocialProofSettings,
} from "./social-proof";

/**
 * Server-only readers for social proof. Orders are staff-only under RLS, so they are read with the service role here
 * and reduced to the anonymous shape in social-proof.ts before anything leaves the server. Every failure means
 * "nothing to show": no toast, no top-seller badge.
 */

export const getSocialProofSettings = unstable_cache(
  async (): Promise<SocialProofSettings> => {
    try {
      const { data } = await createServiceClient().from("store_settings").select("value").eq("key", SOCIAL_PROOF_KEY).maybeSingle();
      return parseSocialProof(data?.value);
    } catch {
      return DEFAULT_SOCIAL_PROOF;
    }
  },
  ["social-proof-settings"],
  { revalidate: 60, tags: ["settings", "social-proof"] },
);

const ALL_QUALIFYING = [...QUALIFYING_STATUSES.confirmed];

async function readOrderLines(windowDays: number): Promise<OrderActivityRow[]> {
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  const { data, error } = await createServiceClient()
    .from("orders")
    .select("id, status, created_at, order_addresses(city), order_items(product_id, handle, title_snapshot, quantity)")
    .in("status", ALL_QUALIFYING)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error || !data) return [];
  const rows: OrderActivityRow[] = [];
  for (const o of data) {
    const addr = (Array.isArray(o.order_addresses) ? o.order_addresses[0] : o.order_addresses) as { city?: string } | null;
    const items = (o.order_items ?? []) as { product_id: string | null; handle: string; title_snapshot: string; quantity: number }[];
    for (const it of items) {
      rows.push({
        orderId: o.id,
        status: o.status,
        createdAt: o.created_at,
        city: addr?.city ?? null,
        productId: it.product_id,
        handle: it.handle,
        title: it.title_snapshot,
        quantity: it.quantity,
      });
    }
  }
  return rows;
}

/** Only products still public in the catalog may appear (a removed or draft product is never advertised). */
async function publicProducts(): Promise<Map<string, { title: string; img: string | null }>> {
  const P = await getV5Catalog();
  return new Map(P.map((p) => [p.h, { title: p.model || p.t, img: p.imgs[0]?.u ?? null }]));
}

export const getRecentActivity = unstable_cache(
  async (): Promise<ActivityItem[]> => {
    try {
      const settings = await getSocialProofSettings();
      if (!settings.activity.enabled) return [];
      const [rows, pub] = await Promise.all([readOrderLines(settings.activity.windowDays), publicProducts()]);
      const visible = rows.filter((r) => pub.has(r.handle)).map((r) => ({ ...r, title: pub.get(r.handle)!.title }));
      const images = Object.fromEntries([...pub].map(([h, v]) => [h, v.img]));
      return buildActivityItems(visible, settings, images, new Date());
    } catch {
      return [];
    }
  },
  ["recent-activity"],
  { revalidate: 120, tags: ["orders-activity", "social-proof"] },
);

export const getMerchBadges = unstable_cache(
  async (): Promise<MerchBadgeMap> => {
    try {
      const settings = await getSocialProofSettings();
      const now = new Date();
      const [rows, pub, editorial] = await Promise.all([
        settings.topSeller.enabled ? readOrderLines(settings.topSeller.windowDays) : Promise.resolve([]),
        publicProducts(),
        settings.editorial.enabled ? readEditorial() : Promise.resolve([]),
      ]);
      const top = computeTopSellers(rows.filter((r) => pub.has(r.handle)), settings, now);
      return buildBadgeMap(top, editorial.filter((e) => pub.has(e.handle)), settings, now);
    } catch {
      return {};
    }
  },
  ["merch-badges"],
  { revalidate: 300, tags: ["product-badges", "social-proof"] },
);

async function readEditorial(): Promise<EditorialBadgeRow[]> {
  const { data, error } = await createServiceClient().from("product_badges").select("kind, starts_at, ends_at, products(handle)").limit(500);
  if (error || !data) return [];
  return data
    .map((r) => ({
      handle: (r.products as { handle?: string } | null)?.handle ?? "",
      kind: r.kind,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
    }))
    .filter((r) => r.handle);
}
