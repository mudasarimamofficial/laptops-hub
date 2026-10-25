import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  businessName: z.string().trim().max(160).optional(),
  supportEmail: z.string().trim().email().max(160).or(z.literal("")).optional(),
  supportPhone: z.string().trim().max(40).optional(),
  inventoryDefaultTracked: z.boolean().optional(),
  lowStockDefault: z.number().int().min(0).max(1_000_000).optional(),
  seoTitleSuffix: z.string().trim().max(80).optional(),
});

type SettingsSchema = z.infer<typeof settingsSchema>;

/**
 * Fetch all store settings.
 */
export async function GET() {
  try {
    const { supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager"]);
    const { data, error } = await supabase.from("store_settings").select("key, value, updated_at, updated_by");
    if (error) {
      return NextResponse.json({ error: "database_error", message: error.message }, { status: 500 });
    }

    const settingsMap: Record<string, unknown> = {};
    for (const row of data || []) {
      settingsMap[row.key] = row.value;
    }

    return NextResponse.json(
      { ok: true, settings: settingsMap },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}

/**
 * Persist store settings atomically and verify with a fresh read.
 */
export async function PUT(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin", "manager"]);
    const body = await request.json().catch(() => null);
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "validation_failed",
          message: "Invalid settings payload",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const d = parsed.data;
    const now = new Date().toISOString();

    // 1. Fetch current rows for keys being touched to preserve existing fields
    const keysToTouch: string[] = [];
    if (d.businessName !== undefined || d.supportEmail !== undefined || d.supportPhone !== undefined) {
      keysToTouch.push("business_identity");
    }
    if (d.inventoryDefaultTracked !== undefined || d.lowStockDefault !== undefined) {
      keysToTouch.push("inventory_defaults");
    }
    if (d.seoTitleSuffix !== undefined) {
      keysToTouch.push("seo_defaults");
    }

    if (keysToTouch.length === 0) {
      return NextResponse.json({ ok: true, message: "No settings modified." }, { headers: { "Cache-Control": "no-store" } });
    }

    const { data: existingRows, error: fetchErr } = await supabase
      .from("store_settings")
      .select("key, value")
      .in("key", keysToTouch);

    if (fetchErr) {
      return NextResponse.json(
        { error: "database_error", message: `Failed to load existing settings: ${fetchErr.message}` },
        { status: 500 },
      );
    }

    const currentMap = new Map<string, Record<string, unknown>>();
    for (const row of existingRows || []) {
      if (row.value && typeof row.value === "object" && !Array.isArray(row.value)) {
        currentMap.set(row.key, row.value as Record<string, unknown>);
      }
    }

    const upsertPayloads: { key: string; value: Record<string, unknown>; updated_at: string; updated_by: string }[] = [];

    // Business identity
    if (keysToTouch.includes("business_identity")) {
      const existing = currentMap.get("business_identity") || {};
      const merged: Record<string, unknown> = {
        name: d.businessName !== undefined ? d.businessName : (existing.name ?? "Laptops HUB"),
        support_email: d.supportEmail !== undefined ? d.supportEmail : (existing.support_email ?? ""),
        support_phone: d.supportPhone !== undefined ? d.supportPhone : (existing.support_phone ?? ""),
      };
      upsertPayloads.push({
        key: "business_identity",
        value: merged,
        updated_at: now,
        updated_by: staff.userId,
      });
    }

    // Inventory defaults
    if (keysToTouch.includes("inventory_defaults")) {
      const existing = currentMap.get("inventory_defaults") || {};
      const merged: Record<string, unknown> = {
        tracked: d.inventoryDefaultTracked !== undefined ? d.inventoryDefaultTracked : (existing.tracked ?? false),
        low_stock_threshold: d.lowStockDefault !== undefined ? d.lowStockDefault : (existing.low_stock_threshold ?? 0),
      };
      upsertPayloads.push({
        key: "inventory_defaults",
        value: merged,
        updated_at: now,
        updated_by: staff.userId,
      });
    }

    // SEO defaults
    if (keysToTouch.includes("seo_defaults")) {
      const existing = currentMap.get("seo_defaults") || {};
      const merged: Record<string, unknown> = {
        title_suffix: d.seoTitleSuffix !== undefined ? d.seoTitleSuffix : (existing.title_suffix ?? ""),
      };
      upsertPayloads.push({
        key: "seo_defaults",
        value: merged,
        updated_at: now,
        updated_by: staff.userId,
      });
    }

    // 2. Perform database upserts with strict error checking
    for (const item of upsertPayloads) {
      const { error: upsertErr } = await supabase
        .from("store_settings")
        .upsert(item, { onConflict: "key" });

      if (upsertErr) {
        return NextResponse.json(
          {
            error: "persistence_failed",
            message: `Failed to persist setting '${item.key}': ${upsertErr.message}`,
          },
          { status: 500 },
        );
      }
    }

    // 3. Confirm persistence through a fresh read
    const { data: verifiedRows, error: verifyErr } = await supabase
      .from("store_settings")
      .select("key, value")
      .in("key", keysToTouch);

    if (verifyErr || !verifiedRows) {
      return NextResponse.json(
        {
          error: "verification_failed",
          message: `Settings were written but could not be confirmed: ${verifyErr?.message || "No rows returned"}`,
        },
        { status: 500 },
      );
    }

    const verifiedMap: Record<string, unknown> = {};
    for (const r of verifiedRows) {
      verifiedMap[r.key] = r.value;
    }

    // Ensure all touched keys actually exist in the verified read
    for (const key of keysToTouch) {
      if (!(key in verifiedMap)) {
        return NextResponse.json(
          {
            error: "verification_inconsistent",
            message: `Setting '${key}' was not found in database verification read.`,
          },
          { status: 500 },
        );
      }
    }

    // 4. Audit successful changes
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "store_settings.update",
      entity_type: "store_settings",
      after: { touched: keysToTouch, verified: verifiedMap },
    });

    return NextResponse.json(
      {
        ok: true,
        persisted: verifiedMap,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
