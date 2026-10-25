import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";
import { pkrMajorToPaisa } from "@/lib/money";

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

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
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
        return NextResponse.json({ error: error.message }, { status: 500 });
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

    if (Object.keys(productPatch).length > 1) {
      const { error } = await supabase.from("products").update(productPatch).eq("id", existing.id);
      if (error) {
        // Strip columns that may not exist until migration is applied
        const retry = { ...productPatch };
        delete retry.summary;
        delete retry.updated_by;
        const { error: e2 } = await supabase.from("products").update(retry).eq("id", existing.id);
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
      }
    }

    if (parsed.data.variantId) {
      const { data: variant, error: vErr } = await supabase
        .from("product_variants")
        .select("id, product_id, price_paisa, inventory_mode, quantity_on_hand")
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
        const status = (parsed.data.status ?? existing.status) as string;
        variantPatch.price_paisa = price;
        variantPatch.purchasable = price > 0 && status === "active";
      }
      if (parsed.data.compareAtPkr !== undefined) {
        variantPatch.compare_at_paisa =
          parsed.data.compareAtPkr === null ? null : pkrMajorToPaisa(parsed.data.compareAtPkr);
      }
      if (parsed.data.sku !== undefined) variantPatch.sku = parsed.data.sku;
      if (parsed.data.inventoryMode !== undefined) {
        variantPatch.inventory_mode = parsed.data.inventoryMode;
        if (parsed.data.inventoryMode === "untracked") {
          // Preserve history of quantity; clear active on-hand pointer semantics for untracked
          variantPatch.quantity_on_hand = null;
        } else if (parsed.data.quantityOnHand !== undefined) {
          variantPatch.quantity_on_hand = parsed.data.quantityOnHand;
        }
      } else if (parsed.data.quantityOnHand !== undefined) {
        variantPatch.quantity_on_hand = parsed.data.quantityOnHand;
      }

      if (Object.keys(variantPatch).length) {
        const { error } = await supabase
          .from("product_variants")
          .update(variantPatch)
          .eq("id", variant.id)
          .eq("product_id", existing.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

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
export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager"]);
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
        return NextResponse.json({ error: error.message }, { status: 500 });
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
