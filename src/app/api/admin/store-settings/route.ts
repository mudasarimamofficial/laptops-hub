import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";

const schema = z.object({
  businessName: z.string().trim().max(160).optional(),
  supportEmail: z.string().trim().email().max(160).or(z.literal("")).optional(),
  supportPhone: z.string().trim().max(40).optional(),
  inventoryDefaultTracked: z.boolean().optional(),
  lowStockDefault: z.number().int().min(0).max(1_000_000).optional(),
  seoTitleSuffix: z.string().trim().max(80).optional(),
});

async function upsertSetting(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>,
  key: string,
  value: unknown,
) {
  const { data: existing } = await supabase.from("store_settings").select("key").eq("key", key).maybeSingle();
  if (existing) {
    return supabase.from("store_settings").update({ value }).eq("key", key);
  }
  return supabase.from("store_settings").insert({ key, value });
}

export async function PUT(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin", "manager"]);
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    }

    const d = parsed.data;
    if (d.businessName !== undefined) await upsertSetting(supabase, "business_identity", {
      name: d.businessName,
      support_email: d.supportEmail ?? "",
      support_phone: d.supportPhone ?? "",
    });
    if (d.inventoryDefaultTracked !== undefined || d.lowStockDefault !== undefined) {
      await upsertSetting(supabase, "inventory_defaults", {
        tracked: d.inventoryDefaultTracked ?? false,
        low_stock_threshold: d.lowStockDefault ?? 0,
      });
    }
    if (d.seoTitleSuffix !== undefined) {
      await upsertSetting(supabase, "seo_defaults", { title_suffix: d.seoTitleSuffix });
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "store_settings.update",
      entity_type: "store_settings",
      after: d,
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
