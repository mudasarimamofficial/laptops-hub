import { createServiceClient } from "@/lib/supabase/server";
import {
  DEFAULT_FEATURED_FLAME_PRESET,
  FEATURED_FLAME_PRESET_KEY,
  FEATURED_FLAME_PRESET_NOTE,
  FEATURED_FLAME_TARGET,
  parseFeaturedFlamePreset,
  selectFeaturedFlameCandidates,
  type FeaturedFlamePreset,
  type PresetCandidate,
} from "./featured-flame-preset";

export async function getFeaturedFlamePreset(): Promise<FeaturedFlamePreset> {
  try {
    const { data } = await createServiceClient().from("store_settings").select("value").eq("key", FEATURED_FLAME_PRESET_KEY).maybeSingle();
    return parseFeaturedFlamePreset(data?.value);
  } catch {
    return { ...DEFAULT_FEATURED_FLAME_PRESET };
  }
}

async function savePreset(preset: FeaturedFlamePreset) {
  const sb = createServiceClient();
  const { data: existing } = await sb.from("store_settings").select("key").eq("key", FEATURED_FLAME_PRESET_KEY).maybeSingle();
  if (existing) {
    await sb.from("store_settings").update({ value: preset }).eq("key", FEATURED_FLAME_PRESET_KEY);
  } else {
    await sb.from("store_settings").insert({ key: FEATURED_FLAME_PRESET_KEY, value: preset });
  }
}

async function loadCandidates(): Promise<PresetCandidate[]> {
  const sb = createServiceClient();
  const { data: products, error } = await sb
    .from("products")
    .select("id, handle, featured, updated_at, category, product_variants(inventory_mode, quantity_on_hand)")
    .is("deleted_at", null)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error || !products) return [];

  return products.map((p) => {
    const variants = (p.product_variants as { inventory_mode: string; quantity_on_hand: number | null }[] | null) || [];
    const sellable =
      variants.length > 0 &&
      variants.some((v) => v.inventory_mode !== "tracked" || (typeof v.quantity_on_hand === "number" && v.quantity_on_hand > 0));
    return {
      id: p.id as string,
      handle: p.handle as string,
      featured: p.featured === true,
      sellable,
      updatedAt: (p.updated_at as string | null) ?? null,
      category: (p.category as string | null) ?? null,
    };
  });
}

export type EnsureFeaturedFlameResult = {
  preset: FeaturedFlamePreset;
  addedHandles: string[];
  skipped: string;
};

/**
 * Idempotent install. Pass `force: true` for merchant “Restore sensible defaults”
 * (still respects suppressedProductIds unless `clearSuppressed`).
 */
export async function ensureFeaturedFlamePreset(opts?: {
  force?: boolean;
  clearSuppressed?: boolean;
  actorUserId?: string | null;
  target?: number;
}): Promise<EnsureFeaturedFlameResult> {
  const force = opts?.force === true;
  const clearSuppressed = opts?.clearSuppressed === true;
  const target = opts?.target ?? FEATURED_FLAME_TARGET;
  const sb = createServiceClient();
  let preset = await getFeaturedFlamePreset();

  if (preset.installedAt && !force) {
    return { preset, addedHandles: [], skipped: "already_installed" };
  }

  if (clearSuppressed) preset = { ...preset, suppressedProductIds: [] };
  const suppressed = new Set(preset.suppressedProductIds);

  if (force) {
    const { data: presetRows } = await sb.from("product_badges").select("product_id").eq("note", FEATURED_FLAME_PRESET_NOTE);
    const presetIds = (presetRows || []).map((r) => r.product_id as string).filter((id) => !suppressed.has(id));
    if (presetIds.length) await sb.from("product_badges").delete().in("product_id", presetIds);
  }

  const { data: existingBadges } = await sb.from("product_badges").select("product_id, note");
  const badgeByProduct = new Map((existingBadges || []).map((b) => [b.product_id as string, ((b.note as string) || "").trim()]));

  const picks = selectFeaturedFlameCandidates(await loadCandidates(), target)
    .filter((c) => !suppressed.has(c.id))
    .filter((c) => !badgeByProduct.has(c.id))
    .slice(0, target);

  const addedHandles: string[] = [];
  const addedIds: string[] = [];
  for (const c of picks) {
    const { error } = await sb.from("product_badges").upsert(
      {
        product_id: c.id,
        kind: "featured",
        starts_at: null,
        ends_at: null,
        note: FEATURED_FLAME_PRESET_NOTE,
        updated_by: opts?.actorUserId || null,
        created_by: opts?.actorUserId || null,
      },
      { onConflict: "product_id" },
    );
    if (error) continue;
    await sb.from("products").update({ featured: true }).eq("id", c.id).eq("featured", false);
    addedHandles.push(c.handle);
    addedIds.push(c.id);
    badgeByProduct.set(c.id, FEATURED_FLAME_PRESET_NOTE);
  }

  preset = {
    ...preset,
    enabled: true,
    installedAt: preset.installedAt || new Date().toISOString(),
    productIds: addedIds,
    suppressedProductIds: [...suppressed],
  };
  await savePreset(preset);

  if (opts?.actorUserId) {
    await sb.from("audit_logs").insert({
      actor_user_id: opts.actorUserId,
      action: force ? "featured_flame_preset.restore" : "featured_flame_preset.ensure",
      entity_type: "store_settings",
      after: { productIds: preset.productIds, addedHandles },
    });
  }

  return { preset, addedHandles, skipped: addedHandles.length ? "ok" : "nothing_to_add" };
}

export async function setFeaturedFlamePresetEnabled(enabled: boolean, actorUserId?: string | null): Promise<FeaturedFlamePreset> {
  const preset = { ...(await getFeaturedFlamePreset()), enabled };
  await savePreset(preset);
  if (actorUserId) {
    await createServiceClient().from("audit_logs").insert({
      actor_user_id: actorUserId,
      action: "featured_flame_preset.enabled",
      entity_type: "store_settings",
      after: { enabled },
    });
  }
  return preset;
}

export async function updateFeaturedFlamePresetMeta(
  patch: Partial<Pick<FeaturedFlamePreset, "label" | "icon" | "enabled">>,
  actorUserId?: string | null,
): Promise<FeaturedFlamePreset> {
  const cur = await getFeaturedFlamePreset();
  const preset: FeaturedFlamePreset = {
    ...cur,
    enabled: patch.enabled ?? cur.enabled,
    label: typeof patch.label === "string" && patch.label.trim() ? patch.label.trim().slice(0, 40) : cur.label,
    icon: patch.icon === "star" || patch.icon === "flame" ? patch.icon : cur.icon,
  };
  await savePreset(preset);
  if (actorUserId) {
    await createServiceClient().from("audit_logs").insert({
      actor_user_id: actorUserId,
      action: "featured_flame_preset.update",
      entity_type: "store_settings",
      after: { label: preset.label, icon: preset.icon, enabled: preset.enabled },
    });
  }
  return preset;
}

/** Remove preset-tagged badges only; record product ids as suppressed so ensure() will not re-add. */
export async function clearFeaturedFlamePreset(opts?: { suppress?: boolean; actorUserId?: string | null }): Promise<FeaturedFlamePreset> {
  const sb = createServiceClient();
  const preset = await getFeaturedFlamePreset();
  const { data: rows } = await sb.from("product_badges").select("product_id, note").eq("note", FEATURED_FLAME_PRESET_NOTE);
  const ids = (rows || []).map((r) => r.product_id as string);
  if (ids.length) await sb.from("product_badges").delete().in("product_id", ids);
  const suppressed = opts?.suppress === false ? preset.suppressedProductIds : [...new Set([...preset.suppressedProductIds, ...ids])];
  const next: FeaturedFlamePreset = {
    ...preset,
    productIds: [],
    suppressedProductIds: suppressed,
    installedAt: preset.installedAt || new Date().toISOString(),
  };
  await savePreset(next);
  if (opts?.actorUserId) {
    await sb.from("audit_logs").insert({
      actor_user_id: opts.actorUserId,
      action: "featured_flame_preset.clear",
      entity_type: "store_settings",
      after: { cleared: ids.length, suppressed: next.suppressedProductIds.length },
    });
  }
  return next;
}

/** When a merchant deletes a badge that was part of the preset, never auto-restore it. */
export async function suppressFeaturedFlameProduct(productId: string): Promise<void> {
  const preset = await getFeaturedFlamePreset();
  if (!preset.installedAt && !preset.productIds.includes(productId)) return;
  if (preset.suppressedProductIds.includes(productId)) {
    if (preset.productIds.includes(productId)) {
      await savePreset({ ...preset, productIds: preset.productIds.filter((id) => id !== productId) });
    }
    return;
  }
  await savePreset({
    ...preset,
    productIds: preset.productIds.filter((id) => id !== productId),
    suppressedProductIds: [...preset.suppressedProductIds, productId],
  });
}
