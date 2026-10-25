import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAuthorizedStaffClient,
  createAuthorizedStaffWriter,
  staffErrorResponse,
} from "@/lib/auth/staff";
import { pkrMajorToPaisa } from "@/lib/money";
import {
  generateVariantMatrix,
  normalizeOptionName,
  optionValuesEqual,
  type OptionValuesMap,
} from "@/lib/catalog/variant-matrix";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ handle: string }> };

const optionSchema = z.object({
  name: z.string().trim().min(1).max(60),
  values: z.array(z.string().trim().min(1).max(80)).min(1).max(40),
});

const variantRowSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  sku: z.string().trim().max(120).nullable().optional(),
  barcode: z.string().trim().max(120).nullable().optional(),
  pricePkr: z.number().min(0).max(10_000_000),
  compareAtPkr: z.number().min(0).max(10_000_000).nullable().optional(),
  inventoryMode: z.enum(["tracked", "untracked"]).default("untracked"),
  quantityOnHand: z.number().int().min(0).max(1_000_000).nullable().optional(),
  purchasable: z.boolean().optional(),
  optionValues: z.record(z.string(), z.string()).default({}),
  position: z.number().int().min(1).max(500).optional(),
});

const putSchema = z.object({
  optionNames: z.array(z.string().trim().min(1).max(60)).max(3).default([]),
  /** When true, regenerate missing combinations from option definitions. */
  options: z.array(optionSchema).max(3).optional(),
  variants: z.array(variantRowSchema).min(1).max(250),
  /** Soft-disable removed variants (default). Hard delete only when never ordered. */
  removeMissing: z.boolean().default(true),
});

async function loadProduct(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>,
  handle: string,
) {
  const { data } = await supabase
    .from("products")
    .select("id, handle, title, option_names, deleted_at")
    .eq("handle", handle)
    .maybeSingle();
  return data;
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const { handle } = await ctx.params;
    const product = await loadProduct(supabase, handle);
    if (!product || product.deleted_at) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const { data: variants, error } = await supabase
      .from("product_variants")
      .select(
        "id, title, sku, barcode, price_paisa, compare_at_paisa, inventory_mode, quantity_on_hand, purchasable, option_values, position, low_stock_threshold, allow_oversell",
      )
      .eq("product_id", product.id)
      .order("position")
      .order("created_at");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(
      {
        productId: product.id,
        handle: product.handle,
        optionNames: product.option_names || [],
        variants: (variants || []).map((v) => ({
          id: v.id,
          title: v.title,
          sku: v.sku,
          barcode: v.barcode,
          pricePaisa: v.price_paisa,
          compareAtPaisa: v.compare_at_paisa,
          inventoryMode: v.inventory_mode,
          quantityOnHand: v.quantity_on_hand,
          purchasable: v.purchasable,
          optionValues: (v.option_values || {}) as OptionValuesMap,
          position: v.position,
          lowStockThreshold: v.low_stock_threshold,
          allowOversell: v.allow_oversell,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}

/**
 * Sync product options + variants.
 * Never destroys variants that appear on order_items — marks purchasable=false instead.
 */
export async function PUT(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin", "manager", "editor"]);
    const { handle } = await ctx.params;
    const product = await loadProduct(supabase, handle);
    if (!product || product.deleted_at) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", message: "Provide optionNames and at least one variant row." },
        { status: 400 },
      );
    }

    const optionNames = (parsed.data.optionNames.length
      ? parsed.data.optionNames
      : (parsed.data.options || []).map((o) => o.name)
    )
      .map(normalizeOptionName)
      .filter(Boolean)
      .slice(0, 3);

    if (parsed.data.options?.length) {
      const { errors } = generateVariantMatrix(parsed.data.options);
      if (errors.length) {
        return NextResponse.json({ error: "matrix_invalid", message: errors.join(" ") }, { status: 400 });
      }
    }

    const { data: existing } = await supabase
      .from("product_variants")
      .select("id, option_values, sku")
      .eq("product_id", product.id);

    const existingList = existing || [];
    const keptIds = new Set<string>();
    const results: { id: string; action: "created" | "updated" }[] = [];

    // Persist option_names (ignore if column missing on older schema)
    const optUpdate = await supabase
      .from("products")
      .update({ option_names: optionNames, updated_by: staff.userId })
      .eq("id", product.id);
    if (optUpdate.error && !/option_names|updated_by/i.test(optUpdate.error.message)) {
      return NextResponse.json({ error: optUpdate.error.message }, { status: 500 });
    }

    let position = 1;
    for (const row of parsed.data.variants) {
      const optionValues = row.optionValues || {};
      const title =
        row.title ||
        (optionNames.map((n) => optionValues[n]).filter(Boolean).join(" / ") || "Default");
      const payload: Record<string, unknown> = {
        title,
        sku: row.sku ?? null,
        price_paisa: pkrMajorToPaisa(row.pricePkr),
        compare_at_paisa:
          row.compareAtPkr == null ? null : pkrMajorToPaisa(row.compareAtPkr),
        inventory_mode: row.inventoryMode,
        quantity_on_hand: row.inventoryMode === "tracked" ? (row.quantityOnHand ?? 0) : null,
        purchasable: row.purchasable !== false,
        option_values: optionValues,
        position: row.position ?? position,
      };
      if (row.barcode !== undefined) payload.barcode = row.barcode;

      let matchId = row.id;
      if (!matchId) {
        const byOpts = existingList.find((e) =>
          optionValuesEqual((e.option_values as OptionValuesMap) || {}, optionValues),
        );
        if (byOpts) matchId = byOpts.id;
        else if (row.sku) {
          const bySku = existingList.find((e) => e.sku && e.sku === row.sku);
          if (bySku) matchId = bySku.id;
        }
      }

      if (matchId) {
        const { error } = await supabase.from("product_variants").update(payload).eq("id", matchId).eq("product_id", product.id);
        if (error) {
          return NextResponse.json({ error: "variant_update_failed", message: error.message }, { status: 500 });
        }
        keptIds.add(matchId);
        results.push({ id: matchId, action: "updated" });
      } else {
        const insertPayload = { ...payload, product_id: product.id };
        const { data: created, error } = await supabase
          .from("product_variants")
          .insert(insertPayload)
          .select("id")
          .single();
        if (error || !created) {
          // Retry without extended columns
          const slim = { ...insertPayload };
          delete slim.barcode;
          delete slim.position;
          const retry = await supabase.from("product_variants").insert(slim).select("id").single();
          if (retry.error || !retry.data) {
            return NextResponse.json(
              { error: "variant_create_failed", message: error?.message || retry.error?.message },
              { status: 500 },
            );
          }
          keptIds.add(retry.data.id);
          results.push({ id: retry.data.id, action: "created" });
        } else {
          keptIds.add(created.id);
          results.push({ id: created.id, action: "created" });
        }
      }
      position++;
    }

    const removed: { id: string; action: "disabled" | "deleted" | "skipped_ordered" }[] = [];
    if (parsed.data.removeMissing) {
      for (const ex of existingList) {
        if (keptIds.has(ex.id)) continue;

        const { count } = await supabase
          .from("order_items")
          .select("id", { count: "exact", head: true })
          .eq("variant_id", ex.id);

        if ((count ?? 0) > 0) {
          await supabase
            .from("product_variants")
            .update({ purchasable: false })
            .eq("id", ex.id);
          removed.push({ id: ex.id, action: "skipped_ordered" });
          continue;
        }

        const del = await supabase.from("product_variants").delete().eq("id", ex.id).eq("product_id", product.id);
        if (del.error) {
          await supabase.from("product_variants").update({ purchasable: false }).eq("id", ex.id);
          removed.push({ id: ex.id, action: "disabled" });
        } else {
          removed.push({ id: ex.id, action: "deleted" });
        }
      }
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "products.variants.sync",
      entity_type: "products",
      entity_id: product.id,
      after: { optionNames, results: results.slice(0, 100), removed },
    });

    return NextResponse.json(
      {
        ok: true,
        optionNames,
        results,
        removed,
        notice:
          removed.some((r) => r.action === "skipped_ordered")
            ? "Some variants were only disabled because they appear on historical orders."
            : undefined,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
