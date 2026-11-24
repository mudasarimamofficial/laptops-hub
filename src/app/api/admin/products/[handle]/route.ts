import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { pkrMajorToPaisa } from "@/lib/money";
import { withCatalogRefresh } from "@/lib/catalog/refresh";
import { INVENTORY_ADJUST_ROLES, inventoryProblemMessage } from "@/lib/commerce/inventory-adjust";
import { makeSellableOnActivate, purchasableAfterPrice } from "@/lib/catalog/sellable";

const patchSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    descriptionSafe: z.string().max(8000).optional(),
    summary: z.string().max(500).optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
    featured: z.boolean().optional(),
    manufacturer: z.string().trim().max(120).nullable().optional(),
    productType: z.string().trim().max(120).nullable().optional(),
    category: z.string().trim().max(120).nullable().optional(),
    vendor: z.string().trim().max(120).optional(),
    tags: z.array(z.string().trim().max(60)).max(40).optional(),
    seoTitle: z.string().trim().max(200).nullable().optional(),
    seoDescription: z.string().trim().max(500).nullable().optional(),
    /** Required when changing price — targets one variant only. */
    variantId: z.string().uuid().optional(),
    pricePkr: z.number().min(0).max(10_000_000).optional(),
    compareAtPkr: z.number().min(0).max(10_000_000).nullable().optional(),
    inventoryMode: z.enum(["tracked", "untracked"]).optional(),
    quantityOnHand: z.number().int().min(0).max(1_000_000).nullable().optional(),
    /**
     * Stock the editor loaded. Required to change the count of a variant that already tracks stock: the change goes
     * through adjust_inventory (ledger + stale check), so an order placed meanwhile is never overwritten.
     */
    expectedQuantityOnHand: z.number().int().nullable().optional(),
    sku: z.string().trim().max(120).nullable().optional(),
    restore: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.pricePkr !== undefined && !val.variantId) {
      ctx.addIssue({
        code: "custom",
        message: "variantId is required when updating price",
        path: ["variantId"],
      });
    }
    if (val.inventoryMode === "tracked" && val.quantityOnHand === null) {
      ctx.addIssue({
        code: "custom",
        message: "Starting quantity required when enabling tracked inventory",
        path: ["quantityOnHand"],
      });
    }
  });

const deleteSchema = z.object({
  mode: z.enum(["archive", "soft_delete"]).default("archive"),
  confirmHandle: z.string().min(1),
});

type Ctx = { params: Promise<{ handle: string }> };

async function handlePATCH(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin", "manager", "editor"]);
    const { handle } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", message: "Check required fields. Price updates need a specific variant." },
        { status: 400 },
      );
    }

    const { data: existing, error: findErr } = await supabase
      .from("products")
      .select("id, handle, title, status, featured, deleted_at")
      .eq("handle", handle)
      .maybeSingle();
    if (findErr || !existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (parsed.data.restore) {
      const restorePatch: Record<string, unknown> = { status: "draft", updated_by: staff.userId };
      // deleted_at may not exist pre-migration
      restorePatch.deleted_at = null;
      restorePatch.deleted_by = null;
      const { error } = await supabase.from("products").update(restorePatch).eq("id", existing.id);
      if (error && error.message.includes("deleted_at")) {
        await supabase.from("products").update({ status: "draft" }).eq("id", existing.id);
      } else if (error) {
        return NextResponse.json({ error: "server_error", message: "The change could not be saved. Try again." }, { status: 500 });
      }
      await supabase.from("audit_logs").insert({
        actor_user_id: staff.userId,
        action: "product.restore",
        entity_type: "products",
        entity_id: existing.id,
        before: existing,
      });
      return NextResponse.json({ ok: true, restored: true }, { headers: { "Cache-Control": "no-store" } });
    }

    const productPatch: Record<string, unknown> = { updated_by: staff.userId };
    if (parsed.data.title !== undefined) productPatch.title = parsed.data.title;
    if (parsed.data.descriptionSafe !== undefined) productPatch.description_safe = parsed.data.descriptionSafe;
    if (parsed.data.summary !== undefined) productPatch.summary = parsed.data.summary;
    if (parsed.data.status !== undefined) productPatch.status = parsed.data.status;
    if (parsed.data.featured !== undefined) productPatch.featured = parsed.data.featured;
    if (parsed.data.manufacturer !== undefined) productPatch.manufacturer = parsed.data.manufacturer;
    if (parsed.data.productType !== undefined) productPatch.product_type = parsed.data.productType;
    if (parsed.data.category !== undefined) productPatch.category = parsed.data.category;
    if (parsed.data.vendor !== undefined) productPatch.merchant_vendor = parsed.data.vendor;
    if (parsed.data.tags !== undefined) productPatch.tags = parsed.data.tags;
    if (parsed.data.seoTitle !== undefined) productPatch.seo_title = parsed.data.seoTitle;
    if (parsed.data.seoDescription !== undefined) productPatch.seo_description = parsed.data.seoDescription;

    // Stock change on a variant that already tracks stock: validate before writing anything, so a stale count never
    // leaves a half-saved product. adjust_inventory re-checks atomically below.
    let stockSet: { variantId: string; amount: number; expected: number } | null = null;
    if (parsed.data.variantId && typeof parsed.data.quantityOnHand === "number" && parsed.data.inventoryMode !== "untracked") {
      const { data: cur } = await supabase
        .from("product_variants")
        .select("id, product_id, inventory_mode, quantity_on_hand")
        .eq("id", parsed.data.variantId)
        .maybeSingle();
      if (cur && cur.product_id === existing.id && cur.inventory_mode === "tracked") {
        const current = Number(cur.quantity_on_hand ?? 0);
        if (parsed.data.quantityOnHand !== current) {
          if (!INVENTORY_ADJUST_ROLES.includes(staff.role)) {
            return NextResponse.json({ error: "forbidden", message: inventoryProblemMessage("forbidden") }, { status: 403 });
          }
          if (parsed.data.expectedQuantityOnHand !== current) {
            return NextResponse.json(
              {
                error: "stale_quantity",
                message: `${inventoryProblemMessage("stale_quantity")} Stock is now ${current}. Nothing was saved.`,
                currentQuantity: current,
              },
              { status: 409 },
            );
          }
          stockSet = { variantId: cur.id, amount: parsed.data.quantityOnHand, expected: current };
        }
      }
    }

    if (Object.keys(productPatch).length > 1) {
      const { error } = await supabase.from("products").update(productPatch).eq("id", existing.id);
      if (error) {
        // Strip columns that may not exist until migration is applied
        const retry = { ...productPatch };
        delete retry.summary;
        delete retry.updated_by;
        const { error: e2 } = await supabase.from("products").update(retry).eq("id", existing.id);
        if (e2) return NextResponse.json({ error: "server_error", message: "The change could not be saved. Try again." }, { status: 500 });
      }
    }

    if (parsed.data.variantId) {
      const { data: variant, error: vErr } = await supabase
        .from("product_variants")
        .select("id, product_id, price_paisa, purchasable, inventory_mode, quantity_on_hand")
        .eq("id", parsed.data.variantId)
        .maybeSingle();
      if (vErr || !variant || variant.product_id !== existing.id) {
        return NextResponse.json(
          { error: "variant_mismatch", message: "Variant does not belong to this product." },
          { status: 400 },
        );
      }

      const variantPatch: Record<string, unknown> = {};
      if (parsed.data.pricePkr !== undefined) {
        const price = pkrMajorToPaisa(parsed.data.pricePkr);
        variantPatch.price_paisa = price;
        // Keep the variant's Sell switch (set in the variant matrix) unless the price makes it unsellable/sellable.
        variantPatch.purchasable = purchasableAfterPrice(Number(variant.price_paisa), price, !!variant.purchasable);
      }
      if (parsed.data.compareAtPkr !== undefined) {
        variantPatch.compare_at_paisa =
          parsed.data.compareAtPkr === null ? null : pkrMajorToPaisa(parsed.data.compareAtPkr);
      }
      if (parsed.data.sku !== undefined) variantPatch.sku = parsed.data.sku;
      // Stock counts: a variant that already tracks stock changes only through adjust_inventory (below). Writing
      // quantity_on_hand here is limited to switching tracking on (starting count) or off.
      const wasTracked = variant.inventory_mode === "tracked";
      if (parsed.data.inventoryMode !== undefined && parsed.data.inventoryMode !== variant.inventory_mode) {
        variantPatch.inventory_mode = parsed.data.inventoryMode;
        if (parsed.data.inventoryMode === "untracked") variantPatch.quantity_on_hand = null;
        else if (parsed.data.quantityOnHand !== undefined) variantPatch.quantity_on_hand = parsed.data.quantityOnHand;
      }

      if (Object.keys(variantPatch).length) {
        const { error } = await supabase
          .from("product_variants")
          .update(variantPatch)
          .eq("id", variant.id)
          .eq("product_id", existing.id);
        if (error) return NextResponse.json({ error: "server_error", message: "The change could not be saved. Try again." }, { status: 500 });
      }

      if (stockSet && wasTracked) {
        const { error } = await supabase.rpc("adjust_inventory", {
          payload: {
            variant_id: stockSet.variantId,
            mode: "set",
            amount: stockSet.amount,
            reason: "count_correction",
            actor_user_id: staff.userId,
            expected_quantity: stockSet.expected,
          },
        });
        if (error) {
          const code = (error.message || "").match(/[a-z_]+/)?.[0] ?? "adjust_failed";
          const known = inventoryProblemMessage(code);
          return NextResponse.json(
            { error: known ? code : "adjust_failed", message: `Other changes were saved, but the stock was not changed: ${known ?? "try again."}` },
            { status: known ? 409 : 500 },
          );
        }
      }
    }

    if (parsed.data.status === "active" && existing.status !== "active") await makeSellableOnActivate(supabase, existing.id);

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "product.patch",
      entity_type: "products",
      entity_id: existing.id,
      before: existing,
      after: parsed.data,
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

/**
 * Soft-delete / archive. Hard delete is refused when order_items reference the product.
 * Never cascade-deletes historical order line snapshots.
 */
async function handleDELETE(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin", "manager"]);
    const { handle } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", message: "confirmHandle and mode are required." },
        { status: 400 },
      );
    }
    if (parsed.data.confirmHandle !== handle) {
      return NextResponse.json(
        { error: "confirm_mismatch", message: "Type the product handle to confirm deletion." },
        { status: 400 },
      );
    }

    const { data: existing, error: findErr } = await supabase
      .from("products")
      .select("id, handle, title, status")
      .eq("handle", handle)
      .maybeSingle();
    if (findErr || !existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (parsed.data.mode === "archive") {
      const { error } = await supabase
        .from("products")
        .update({ status: "archived", updated_by: staff.userId })
        .eq("id", existing.id);
      if (error && error.message.includes("updated_by")) {
        await supabase.from("products").update({ status: "archived" }).eq("id", existing.id);
      } else if (error) {
        return NextResponse.json({ error: "server_error", message: "The change could not be saved. Try again." }, { status: 500 });
      }
      await supabase.from("audit_logs").insert({
        actor_user_id: staff.userId,
        action: "product.archive",
        entity_type: "products",
        entity_id: existing.id,
        before: existing,
      });
      return NextResponse.json({ ok: true, mode: "archive" }, { headers: { "Cache-Control": "no-store" } });
    }

    // soft_delete
    const softPatch: Record<string, unknown> = {
      status: "archived",
      deleted_at: new Date().toISOString(),
      deleted_by: staff.userId,
      updated_by: staff.userId,
    };
    const { error } = await supabase.from("products").update(softPatch).eq("id", existing.id);
    if (error) {
      // Pre-migration fallback: archive only
      await supabase.from("products").update({ status: "archived" }).eq("id", existing.id);
      await supabase.from("audit_logs").insert({
        actor_user_id: staff.userId,
        action: "product.archive",
        entity_type: "products",
        entity_id: existing.id,
        before: existing,
        after: { note: "soft_delete_columns_unavailable_archived_instead" },
      });
      return NextResponse.json(
        {
          ok: true,
          mode: "archive",
          message: "Soft-delete columns not yet migrated; product archived instead.",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "product.soft_delete",
      entity_type: "products",
      entity_id: existing.id,
      before: existing,
    });

    return NextResponse.json({ ok: true, mode: "soft_delete" }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

// Every successful catalog write refreshes the storefront (src/lib/catalog/refresh.ts).
export const PATCH = withCatalogRefresh(handlePATCH);
export const DELETE = withCatalogRefresh(handleDELETE);
