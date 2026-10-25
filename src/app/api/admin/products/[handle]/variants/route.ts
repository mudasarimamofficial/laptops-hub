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
  options: z.array(optionSchema).max(3).optional(),
  variants: z.array(variantRowSchema).min(1).max(250),
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

/** Atomic variant sync via sync_product_variants RPC (all-or-nothing). */
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

    const rpcVariants = parsed.data.variants.map((row, i) => {
      const optionValues = row.optionValues || {};
      const title =
        row.title ||
        (optionNames.map((n) => optionValues[n]).filter(Boolean).join(" / ") || "Default");
      return {
        id: row.id || null,
        title,
        sku: row.sku ?? null,
        barcode: row.barcode ?? null,
        price_paisa: pkrMajorToPaisa(row.pricePkr),
        compare_at_paisa: row.compareAtPkr == null ? null : pkrMajorToPaisa(row.compareAtPkr),
        inventory_mode: row.inventoryMode,
        quantity_on_hand: row.inventoryMode === "tracked" ? (row.quantityOnHand ?? 0) : null,
        purchasable: row.purchasable !== false,
        option_values: optionValues,
        position: row.position ?? i + 1,
      };
    });

    const { data, error } = await supabase.rpc("sync_product_variants", {
      payload: {
        actor_user_id: staff.userId,
        product_id: product.id,
        option_names: optionNames,
        variants: rpcVariants,
        remove_missing: parsed.data.removeMissing,
      },
    });

    if (error) {
      const msg = error.message || "variant_sync_failed";
      let status = 500;
      if (/forbidden/i.test(msg)) status = 403;
      else if (/not_found/i.test(msg)) status = 404;
      else if (/validation|duplicate|cross_product|invalid/i.test(msg)) status = 400;
      return NextResponse.json({ error: "variant_sync_failed", message: msg }, { status });
    }

    const result = data as {
      ok?: boolean;
      created?: number;
      updated?: number;
      disabled?: number;
      deleted?: number;
      kept_ids?: string[];
    };

    if (!result?.ok) {
      return NextResponse.json({ error: "variant_sync_inconsistent" }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        optionNames,
        summary: {
          created: result.created ?? 0,
          updated: result.updated ?? 0,
          disabled: result.disabled ?? 0,
          deleted: result.deleted ?? 0,
        },
        keptIds: result.kept_ids || [],
        notice:
          (result.disabled ?? 0) > 0
            ? "Some variants were only disabled because they appear on historical orders."
            : undefined,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
