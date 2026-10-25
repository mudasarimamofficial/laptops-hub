import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";
import { pkrMajorToPaisa } from "@/lib/money";

const createSchema = z.object({
  title: z.string().trim().min(2).max(200),
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Handle must be lowercase kebab-case")
    .max(180)
    .optional(),
  descriptionSafe: z.string().max(8000).optional(),
  summary: z.string().max(500).optional(),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  manufacturer: z.string().trim().max(120).nullable().optional(),
  productType: z.string().trim().max(120).nullable().optional(),
  category: z.string().trim().max(120).nullable().optional(),
  vendor: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().max(60)).max(40).optional(),
  pricePkr: z.number().min(0).max(10_000_000).default(0),
  sku: z.string().trim().max(120).nullable().optional(),
  inventoryMode: z.enum(["tracked", "untracked"]).default("untracked"),
  quantityOnHand: z.number().int().min(0).max(1_000_000).nullable().optional(),
});

function slugifyHandle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);
}

export async function POST(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", message: "Check title, handle, and price fields.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    let handle = data.handle || slugifyHandle(data.title);
    if (!handle) {
      return NextResponse.json({ error: "validation_failed", message: "Could not derive a URL handle from the title." }, { status: 400 });
    }

    if (data.inventoryMode === "tracked" && (data.quantityOnHand === null || data.quantityOnHand === undefined)) {
      return NextResponse.json(
        {
          error: "validation_failed",
          message: "Tracked inventory requires a starting quantity (do not invent stock).",
        },
        { status: 400 },
      );
    }

    // Ensure unique handle
    for (let i = 0; i < 8; i++) {
      const candidate = i === 0 ? handle : `${handle}-${i + 1}`;
      const { data: existing } = await supabase.from("products").select("id").eq("handle", candidate).maybeSingle();
      if (!existing) {
        handle = candidate;
        break;
      }
      if (i === 7) {
        return NextResponse.json({ error: "handle_conflict", message: "Handle already in use. Choose another." }, { status: 409 });
      }
    }

    const pricePaisa = pkrMajorToPaisa(data.pricePkr);
    const productInsert: Record<string, unknown> = {
      handle,
      title: data.title,
      description_safe: data.descriptionSafe ?? "",
      status: data.status,
      manufacturer: data.manufacturer ?? null,
      product_type: data.productType ?? null,
      category: data.category ?? null,
      merchant_vendor: data.vendor?.trim() || "Laptops HUB",
      tags: data.tags ?? [],
      import_source: "admin",
      updated_by: staff.userId,
    };
    // summary column is additive migration — only send when present locally/after migrate
    if (data.summary !== undefined) productInsert.summary = data.summary;

    let product: { id: string; handle: string } | null = null;
    {
      const first = await supabase.from("products").insert(productInsert).select("id, handle").single();
      if (first.data) {
        product = first.data;
      } else if (first.error?.message?.includes("summary") || first.error?.message?.includes("updated_by")) {
        delete productInsert.summary;
        delete productInsert.updated_by;
        const retry = await supabase.from("products").insert(productInsert).select("id, handle").single();
        if (retry.error || !retry.data) {
          return NextResponse.json(
            { error: "create_failed", message: retry.error?.message || "Product create failed" },
            { status: 500 },
          );
        }
        product = retry.data;
      } else {
        return NextResponse.json(
          { error: "create_failed", message: first.error?.message || "Product create failed" },
          { status: 500 },
        );
      }
    }

    const productId = product.id;
    const variantInsert: Record<string, unknown> = {
      product_id: productId,
      title: "Default",
      sku: data.sku || null,
      price_paisa: pricePaisa,
      purchasable: data.status === "active" && pricePaisa > 0,
      inventory_mode: data.inventoryMode,
      quantity_on_hand: data.inventoryMode === "tracked" ? data.quantityOnHand : null,
      option_values: {},
    };

    const { data: variant, error: vErr } = await supabase.from("product_variants").insert(variantInsert).select("id").single();
    if (vErr || !variant) {
      await supabase.from("products").delete().eq("id", productId);
      return NextResponse.json({ error: "variant_failed", message: vErr?.message || "Variant create failed" }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "product.create",
      entity_type: "products",
      entity_id: productId,
      after: { handle, title: data.title, status: data.status, variantId: variant.id },
    });

    return NextResponse.json(
      { ok: true, handle, id: productId, variantId: variant.id },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
