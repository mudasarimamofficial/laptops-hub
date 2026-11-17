import { contentVisibility } from "@/lib/content/pages";
import { emailConfigured } from "@/lib/notify/send-email";
import { createServiceClient } from "@/lib/supabase/server";
import { evaluateCheckoutReadiness, type Readiness } from "./checkout-readiness";

/**
 * Loads every checkout gate from the server's point of view (fresh, uncached). Any load failure fails closed:
 * the gate is reported as failing rather than silently treated as open.
 */
export async function loadCheckoutReadiness(): Promise<Readiness> {
  const env = { clientFlag: process.env.NEXT_PUBLIC_COD_CHECKOUT_ENABLED, serverFlag: process.env.COD_CHECKOUT_ENABLED };
  let dbSetting: { enabled: boolean; reason: string | null } | null = null;
  let zones: { name: string; isActive: boolean; provinces: string[] }[] = [];
  let purchasableVariants = 0;
  let trackedVariants = 0;
  let activeOwnersOrAdmins = 0;
  let policies: Record<string, boolean> = {};

  try {
    const supabase = createServiceClient();
    const [setting, zoneRows, purchasable, tracked, staff, vis] = await Promise.all([
      supabase.from("store_settings").select("value").eq("key", "cod_checkout").maybeSingle(),
      supabase.from("shipping_zones").select("name, is_active, provinces"),
      supabase
        .from("product_variants")
        .select("id, products!inner(deleted_at)", { count: "exact", head: true })
        .eq("purchasable", true)
        .is("products.deleted_at", null),
      supabase
        .from("product_variants")
        .select("id, products!inner(deleted_at)", { count: "exact", head: true })
        .eq("purchasable", true)
        .eq("inventory_mode", "tracked")
        .is("products.deleted_at", null),
      supabase
        .from("admin_memberships")
        .select("user_id", { count: "exact", head: true })
        .eq("is_active", true)
        .in("role", ["owner", "admin"]),
      contentVisibility(true),
    ]);
    const v = setting.data?.value as { enabled?: boolean; reason?: string } | null;
    dbSetting = v ? { enabled: v.enabled === true, reason: typeof v.reason === "string" ? v.reason : null } : null;
    zones = (zoneRows.data || []).map((z) => ({
      name: String(z.name),
      isActive: z.is_active === true,
      provinces: Array.isArray(z.provinces) ? (z.provinces as string[]).filter(Boolean) : [],
    }));
    purchasableVariants = purchasable.count ?? 0;
    // Pre-migration schemas have no inventory_mode column: treat as zero tracked (warning, not an error).
    trackedVariants = tracked.error ? 0 : (tracked.count ?? 0);
    activeOwnersOrAdmins = staff.count ?? 0;
    policies = vis.pages;
  } catch {
    // Fail closed: leave defaults (db off, no zones, no policies) so the result is "not open".
  }

  return evaluateCheckoutReadiness({
    env,
    dbSetting,
    zones,
    policies,
    purchasableVariants,
    trackedVariants,
    notifications: { transportConfigured: emailConfigured() },
    activeOwnersOrAdmins,
  });
}

/** Public, non-sensitive answer for the storefront: open or not, plus a shopper-safe message. */
export async function publicCheckoutAvailability(): Promise<{ open: boolean }> {
  const r = await loadCheckoutReadiness();
  return { open: r.open };
}
