import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const KEEP_VALID = 4;

type SnapshotTables = {
  store_settings: unknown[];
  products: unknown[];
  product_variants: unknown[];
  collections: unknown[];
  collection_products: unknown[];
  articles: unknown[];
  reels: unknown[];
  store_testimonials: unknown[];
  shipping_zones: unknown[];
  product_reviews?: unknown[];
};

async function loadTable(supabase: SupabaseClient, table: string, columns = "*") {
  const { data, error } = await supabase.from(table).select(columns).limit(20_000);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data || [];
}

export async function buildMerchantSnapshotPayload(supabase: SupabaseClient): Promise<SnapshotTables> {
  const [
    store_settings,
    products,
    product_variants,
    collections,
    collection_products,
    articles,
    reels,
    store_testimonials,
    shipping_zones,
  ] = await Promise.all([
    loadTable(supabase, "store_settings"),
    loadTable(supabase, "products", "id, handle, title, status, category, manufacturer, featured, tags, specs, option_names, description_safe, deleted_at, updated_at"),
    loadTable(supabase, "product_variants", "id, product_id, sku, title, option_values, price_paisa, compare_at_paisa, max_per_order, purchasable, position, inventory_mode, quantity_on_hand, allow_oversell, low_stock_threshold"),
    loadTable(supabase, "collections"),
    loadTable(supabase, "collection_products"),
    loadTable(supabase, "articles"),
    loadTable(supabase, "reels"),
    loadTable(supabase, "store_testimonials"),
    loadTable(supabase, "shipping_zones"),
  ]);

  return {
    store_settings,
    products,
    product_variants,
    collections,
    collection_products,
    articles,
    reels,
    store_testimonials,
    shipping_zones,
  };
}

export function validateSnapshotPayload(payload: SnapshotTables): { ok: boolean; checks: Record<string, number | boolean> } {
  const checks = {
    has_settings: (payload.store_settings?.length || 0) > 0,
    products: payload.products?.length || 0,
    variants: payload.product_variants?.length || 0,
    articles: payload.articles?.length || 0,
    reels: payload.reels?.length || 0,
    shipping_zones: payload.shipping_zones?.length || 0,
  };
  const ok = checks.has_settings && checks.products > 0 && checks.variants > 0 && checks.shipping_zones > 0;
  return { ok, checks };
}

const COALESCE_MS = 10 * 60 * 1000;

/** Skip a new auto-snapshot when a valid one was created within the coalesce window. */
export async function maybeCreateCoalescedSnapshot(
  supabase: SupabaseClient,
  opts: { label: string; createdBy: string | null; notes?: string },
) {
  const { data: latest } = await supabase
    .from("merchant_snapshots")
    .select("id, created_at")
    .eq("status", "valid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest?.created_at && Date.now() - new Date(latest.created_at).getTime() < COALESCE_MS) {
    return { skipped: true as const, reason: "coalesced" as const, latestId: latest.id };
  }
  const snap = await createMerchantSnapshot(supabase, opts);
  return { skipped: false as const, backup: snap };
}

export async function createMerchantSnapshot(
  supabase: SupabaseClient,
  opts: { label: string; kind?: "merchant_cms" | "pre_restore"; createdBy: string | null; notes?: string },
) {
  const payload = await buildMerchantSnapshotPayload(supabase);
  const json = JSON.stringify(payload);
  const checksum = createHash("sha256").update(json).digest("hex");
  const validation = validateSnapshotPayload(payload);
  const status = validation.ok ? "valid" : "failed";

  const { data, error } = await supabase
    .from("merchant_snapshots")
    .insert({
      label: opts.label,
      kind: opts.kind || "merchant_cms",
      status,
      payload,
      payload_bytes: Buffer.byteLength(json, "utf8"),
      checksum,
      validation,
      created_by: opts.createdBy,
      verified_at: validation.ok ? new Date().toISOString() : null,
      notes: opts.notes || null,
    })
    .select("id, label, kind, status, payload_bytes, checksum, validation, created_at, verified_at")
    .single();

  if (error) throw new Error(error.message);

  if (validation.ok) {
    await enforceRetention(supabase);
  }

  return data;
}

/** Keep the newest 4 valid snapshots; never delete when a new snapshot failed. */
export async function enforceRetention(supabase: SupabaseClient) {
  const { data: valid } = await supabase
    .from("merchant_snapshots")
    .select("id, created_at")
    .eq("status", "valid")
    .order("created_at", { ascending: false });

  const rows = valid || [];
  if (rows.length <= KEEP_VALID) return { kept: rows.length, removed: 0 };

  const drop = rows.slice(KEEP_VALID).map((r) => r.id);
  const { error } = await supabase.from("merchant_snapshots").delete().in("id", drop);
  if (error) throw new Error(error.message);
  return { kept: KEEP_VALID, removed: drop.length };
}

/**
 * Restore selected merchant tables from a validated snapshot.
 * Creates a pre_restore checkpoint first. Does not touch auth users or orders.
 */
export async function restoreMerchantSnapshot(
  supabase: SupabaseClient,
  snapshotId: string,
  staffUserId: string,
) {
  const { data: snap, error } = await supabase
    .from("merchant_snapshots")
    .select("id, status, payload")
    .eq("id", snapshotId)
    .maybeSingle();
  if (error || !snap) throw new Error("Backup not found");
  if (snap.status !== "valid") throw new Error("Only validated backups can be restored");

  await createMerchantSnapshot(supabase, {
    label: `Pre-restore checkpoint before ${snapshotId.slice(0, 8)}`,
    kind: "pre_restore",
    createdBy: staffUserId,
  });

  const payload = snap.payload as SnapshotTables;
  const validation = validateSnapshotPayload(payload);
  if (!validation.ok) throw new Error("Backup failed integrity checks");

  // Settings upsert by key
  for (const row of payload.store_settings as { key: string; value: unknown }[]) {
    if (!row?.key) continue;
    const { error: e } = await supabase.from("store_settings").upsert(
      { key: row.key, value: row.value, updated_at: new Date().toISOString(), updated_by: staffUserId },
      { onConflict: "key" },
    );
    if (e) throw new Error(`settings ${row.key}: ${e.message}`);
  }

  // Articles upsert by id (preserve URLs)
  for (const row of payload.articles as Record<string, unknown>[]) {
    if (!row?.id) continue;
    const { error: e } = await supabase.from("articles").upsert(row, { onConflict: "id" });
    if (e) throw new Error(`article: ${e.message}`);
  }

  for (const row of payload.reels as Record<string, unknown>[]) {
    if (!row?.id) continue;
    const { error: e } = await supabase.from("reels").upsert(row, { onConflict: "id" });
    if (e) throw new Error(`reel: ${e.message}`);
  }

  for (const row of payload.store_testimonials as Record<string, unknown>[]) {
    if (!row?.id) continue;
    const { error: e } = await supabase.from("store_testimonials").upsert(row, { onConflict: "id" });
    if (e) throw new Error(`testimonial: ${e.message}`);
  }

  for (const row of payload.shipping_zones as Record<string, unknown>[]) {
    if (!row?.id) continue;
    const { error: e } = await supabase.from("shipping_zones").upsert(row, { onConflict: "id" });
    if (e) throw new Error(`zone: ${e.message}`);
  }

  await supabase.from("audit_logs").insert({
    actor_user_id: staffUserId,
    action: "merchant_snapshot.restore",
    entity_type: "merchant_snapshots",
    entity_id: snapshotId,
    after: { restored: true, checks: validation.checks },
  });

  return { ok: true as const, snapshotId };
}
