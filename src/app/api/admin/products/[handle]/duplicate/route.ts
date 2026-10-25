import { NextResponse } from "next/server";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";

type Ctx = { params: Promise<{ handle: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const { handle } = await ctx.params;

    let source: Record<string, unknown> | null = null;
    const full = await supabase
      .from("products")
      .select(
        "*, product_variants(*), product_media(url, alt, position, approval, origin, health_status, is_primary, source_provider)",
      )
      .eq("handle", handle)
      .maybeSingle();
    if (full.data) {
      source = full.data as Record<string, unknown>;
    } else {
      const retry = await supabase
        .from("products")
        .select("*, product_variants(*), product_media(url, alt, position, approval)")
        .eq("handle", handle)
        .maybeSingle();
      if (!retry.data) return NextResponse.json({ error: "not_found" }, { status: 404 });
      source = retry.data as Record<string, unknown>;
    }

    let newHandle = `${source.handle}-copy`;
    for (let i = 2; i < 50; i++) {
      const { data: hit } = await supabase.from("products").select("id").eq("handle", newHandle).maybeSingle();
      if (!hit) break;
      newHandle = `${source.handle}-copy-${i}`;
    }

    const productInsert: Record<string, unknown> = {
      handle: newHandle,
      title: `${source.title} (Copy)`,
      description_safe: source.description_safe,
      summary: source.summary ?? "",
      merchant_vendor: source.merchant_vendor,
      manufacturer: source.manufacturer,
      product_type: source.product_type,
      category: source.category,
      status: "draft",
      featured: false,
      media_approval: "pending",
      seo_title: source.seo_title,
      seo_description: source.seo_description,
      tags: source.tags || [],
      specs: source.specs || {},
      flags: source.flags || [],
      option_names: source.option_names || [],
      import_source: "duplicate",
      updated_by: staff.userId,
    };

    let created: { id: string; handle: string } | null = null;
    {
      const first = await supabase.from("products").insert(productInsert).select("id, handle").single();
      if (first.data) created = first.data;
      else {
        delete productInsert.summary;
        delete productInsert.option_names;
        delete productInsert.updated_by;
        const retry = await supabase.from("products").insert(productInsert).select("id, handle").single();
        if (retry.error || !retry.data) {
          return NextResponse.json({ error: retry.error?.message || first.error?.message || "create_failed" }, { status: 500 });
        }
        created = retry.data;
      }
    }

    const variants = (source.product_variants as Record<string, unknown>[]) || [];
    for (const v of variants) {
      const payload: Record<string, unknown> = {
        product_id: created.id,
        title: v.title,
        sku: v.sku ? `${v.sku}-COPY` : null,
        barcode: null,
        price_paisa: v.price_paisa,
        compare_at_paisa: v.compare_at_paisa,
        option_values: v.option_values || {},
        inventory_mode: v.inventory_mode || "untracked",
        quantity_on_hand: v.inventory_mode === "tracked" ? v.quantity_on_hand ?? 0 : null,
        purchasable: false,
        max_per_order: v.max_per_order || 5,
        position: v.position || 1,
      };
      const { error: vErr } = await supabase.from("product_variants").insert(payload);
      if (vErr) {
        delete payload.barcode;
        delete payload.position;
        await supabase.from("product_variants").insert(payload);
      }
    }

    const media = (source.product_media as Record<string, unknown>[]) || [];
    for (const m of media) {
      const payload: Record<string, unknown> = {
        product_id: created.id,
        url: m.url,
        alt: m.alt || "",
        position: m.position || 1,
        approval: "pending",
        origin: m.origin || "remote",
        health_status: "unknown",
        is_primary: m.is_primary ?? false,
        source_provider: m.source_provider || null,
      };
      const { error: mErr } = await supabase.from("product_media").insert(payload);
      if (mErr) {
        await supabase.from("product_media").insert({
          product_id: created.id,
          url: m.url,
          alt: m.alt || "",
          position: m.position || 1,
          approval: "pending",
        });
      }
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "product.duplicate",
      entity_type: "products",
      entity_id: created.id,
      after: { from: source.handle, to: created.handle },
    });

    return NextResponse.json(
      { ok: true, handle: created.handle, id: created.id },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
