import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Merchant CMS application snapshots — NOT a full PostgreSQL dump.
 *
 * Protected / restorable:
 *   store_settings, articles, reels, store_testimonials, shipping_zones
 *
 * Explicitly excluded (order integrity / auth / live catalog):
 *   products, product_variants, collections, orders, customers, staff, secrets
 */
export const SNAPSHOT_SCOPE = [
  "store_settings",
  "articles",
  "reels",
  "store_testimonials",
  "shipping_zones",
] as const;

export const SNAPSHOT_SCOPE_LABEL =
  "Store settings, blog posts, reels, customer reviews, and shipping zones. Does not include products, orders, customers, or staff accounts.";

const KEEP_VALID = 4;

/**
 * G17: settings a CMS restore must never change. `cod_checkout` is the customer-ordering go-live gate (LH-017): an old
 * snapshot must not switch live COD ordering on or off. It keeps its current value; change it deliberately instead.
 * G24: `notifications` (staff recipients, customer-email mode) is kept live too, so a restore can never start emailing
 * customers again or send alerts to a former staff member's address.
 */
export const RESTORE_PROTECTED_SETTING_KEYS = ["cod_checkout", "notifications"] as const;

/** The payload actually sent to the restore RPC: protected settings removed, everything else unchanged. */
export function restorablePayload<T extends { store_settings: unknown[] }>(payload: T): { payload: T; keptLive: string[] } {
  const protectedKeys = new Set<string>(RESTORE_PROTECTED_SETTING_KEYS);
  const keptLive: string[] = [];
  const store_settings = payload.store_settings.filter((row) => {
    const key = (row as { key?: unknown } | null)?.key;
    if (typeof key === "string" && protectedKeys.has(key)) {
      keptLive.push(key);
      return false;
    }
    return true;
  });
  return { payload: { ...payload, store_settings }, keptLive };
}
const COALESCE_MS = 10 * 60 * 1000;
const SCHEMA_VERSION = 2;

export type MerchantCmsPayload = {
  schemaVersion: number;
  capturedAt: string;
  store_settings: unknown[];
  articles: unknown[];
  reels: unknown[];
  store_testimonials: unknown[];
  shipping_zones: unknown[];
};

async function loadTable(supabase: SupabaseClient, table: string, columns = "*") {
  const { data, error } = await supabase.from(table).select(columns).limit(20_000);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data || [];
}

export async function buildMerchantSnapshotPayload(supabase: SupabaseClient): Promise<MerchantCmsPayload> {
  const [store_settings, articles, reels, store_testimonials, shipping_zones] = await Promise.all([
    loadTable(supabase, "store_settings"),
    loadTable(supabase, "articles"),
    loadTable(supabase, "reels"),
    loadTable(supabase, "store_testimonials"),
    loadTable(supabase, "shipping_zones"),
  ]);

  return {
    schemaVersion: SCHEMA_VERSION,
    capturedAt: new Date().toISOString(),
    store_settings,
    articles,
    reels,
    store_testimonials,
    shipping_zones,
  };
}

export function validateSnapshotPayload(payload: unknown): {
  ok: boolean;
  checks: Record<string, number | boolean | string>;
  reason?: string;
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, checks: {}, reason: "payload_not_object" };
  }
  const p = payload as Record<string, unknown>;

  // Reject legacy catalog-heavy payloads that advertised products but could not restore them safely.
  if (Array.isArray(p.products) || Array.isArray(p.product_variants)) {
    return {
      ok: false,
      checks: { legacy_catalog_payload: true },
      reason: "legacy_catalog_payload_unsupported",
    };
  }

  const settings = Array.isArray(p.store_settings) ? p.store_settings : null;
  const articles = Array.isArray(p.articles) ? p.articles : null;
  const reels = Array.isArray(p.reels) ? p.reels : null;
  const testimonials = Array.isArray(p.store_testimonials) ? p.store_testimonials : null;
  const zones = Array.isArray(p.shipping_zones) ? p.shipping_zones : null;

  const checks: Record<string, number | boolean | string> = {
    schemaVersion: typeof p.schemaVersion === "number" ? p.schemaVersion : "missing",
    store_settings: settings?.length ?? -1,
    articles: articles?.length ?? -1,
    reels: reels?.length ?? -1,
    store_testimonials: testimonials?.length ?? -1,
    shipping_zones: zones?.length ?? -1,
  };

  if (!settings || !articles || !reels || !testimonials || !zones) {
    return { ok: false, checks, reason: "missing_tables" };
  }
  if (settings.length < 1) return { ok: false, checks, reason: "empty_settings" };
  if (zones.length < 1) return { ok: false, checks, reason: "empty_zones" };

  return { ok: true, checks };
}

/**
 * JSON with object keys sorted at every level. Snapshots are stored as `jsonb`, which reorders keys, so a checksum over
 * plain `JSON.stringify` could never match after storage and every restore was refused ("checksum mismatch").
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Checksums written from 2026-11-25 carry this prefix (canonical JSON). Older ones hashed key-order-dependent JSON. */
const CANONICAL_CHECKSUM_PREFIX = "c1:";

export function checksumPayload(payload: unknown): string {
  return CANONICAL_CHECKSUM_PREFIX + createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

/** "legacy": made before canonical checksums; its integrity cannot be re-verified after jsonb storage. */
export function checksumVerdict(stored: string | null | undefined, payload: unknown): "ok" | "mismatch" | "legacy" {
  if (!stored) return "ok";
  if (!stored.startsWith(CANONICAL_CHECKSUM_PREFIX)) return "legacy";
  return stored === checksumPayload(payload) ? "ok" : "mismatch";
}

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
  const checksum = checksumPayload(payload);
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
      validation: { ...validation.checks, reason: validation.reason ?? null, scope: SNAPSHOT_SCOPE },
      created_by: opts.createdBy,
      verified_at: validation.ok ? new Date().toISOString() : null,
      notes: opts.notes || SNAPSHOT_SCOPE_LABEL,
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
 * Restore Merchant CMS tables from a validated snapshot via a single DB transaction (RPC).
 * Creates a pre_restore checkpoint first. Does not touch products, orders, or auth.
 */
export async function restoreMerchantSnapshot(
  supabase: SupabaseClient,
  snapshotId: string,
  staffUserId: string,
) {
  const { data: snap, error } = await supabase
    .from("merchant_snapshots")
    .select("id, status, payload, checksum")
    .eq("id", snapshotId)
    .maybeSingle();
  if (error || !snap) throw new Error("Backup not found");
  if (snap.status !== "valid") throw new Error("Only validated backups can be restored");

  const payload = snap.payload;
  const validation = validateSnapshotPayload(payload);
  if (!validation.ok) throw new Error(`Backup failed integrity checks (${validation.reason})`);

  const verdict = checksumVerdict(snap.checksum, payload);
  if (verdict === "legacy") {
    throw new Error(
      "This backup was made before 25 Nov 2026 and its integrity cannot be checked (legacy format). Create a new backup, then restore that one.",
    );
  }
  if (verdict === "mismatch") throw new Error("Backup checksum mismatch — refusing restore");

  // Pre-restore checkpoint must succeed before mutating live CMS rows.
  const checkpoint = await createMerchantSnapshot(supabase, {
    label: `Pre-restore checkpoint before ${snapshotId.slice(0, 8)}`,
    kind: "pre_restore",
    createdBy: staffUserId,
    notes: "Automatic checkpoint before CMS restore",
  });
  if (checkpoint.status !== "valid") {
    throw new Error("Pre-restore checkpoint failed validation — restore aborted");
  }

  const { payload: toRestore, keptLive } = restorablePayload(payload as MerchantCmsPayload);
  if (toRestore.store_settings.length < 1) throw new Error("Backup failed integrity checks (no restorable settings)");
  const { data: rpcResult, error: rpcError } = await supabase.rpc("restore_merchant_cms_snapshot", {
    payload: toRestore,
    actor: staffUserId,
  });

  if (rpcError) {
    throw new Error(`Restore failed (transaction rolled back): ${rpcError.message}`);
  }

  await supabase.from("audit_logs").insert({
    actor_user_id: staffUserId,
    action: "merchant_snapshot.restore",
    entity_type: "merchant_snapshots",
    entity_id: snapshotId,
    after: { restored: true, checks: validation.checks, rpc: rpcResult, checkpointId: checkpoint.id, keptLive },
  });

  return { ok: true as const, snapshotId, checkpointId: checkpoint.id as string, rpc: rpcResult, keptLive };
}
