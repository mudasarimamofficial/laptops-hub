import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";
import { pkrMajorToPaisa } from "@/lib/money";

const patchSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  descriptionSafe: z.string().max(8000).optional(),
  pricePkr: z.number().min(1).max(10_000_000).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  featured: z.boolean().optional(),
  manufacturer: z.string().trim().max(120).nullable().optional(),
  productType: z.string().trim().max(120).nullable().optional(),
  category: z.string().trim().max(120).nullable().optional(),
});

type Ctx = { params: Promise<{ handle: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const { handle } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    }

    const { data: existing, error: findErr } = await supabase
      .from("products")
      .select("id, handle, title, status, featured")
      .eq("handle", handle)
      .maybeSingle();
    if (findErr || !existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const productPatch: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) productPatch.title = parsed.data.title;
    if (parsed.data.descriptionSafe !== undefined) productPatch.description_safe = parsed.data.descriptionSafe;
    if (parsed.data.status !== undefined) productPatch.status = parsed.data.status;
    if (parsed.data.featured !== undefined) productPatch.featured = parsed.data.featured;
    if (parsed.data.manufacturer !== undefined) productPatch.manufacturer = parsed.data.manufacturer;
    if (parsed.data.productType !== undefined) productPatch.product_type = parsed.data.productType;
    if (parsed.data.category !== undefined) productPatch.category = parsed.data.category;

    if (Object.keys(productPatch).length) {
      const { error } = await supabase.from("products").update(productPatch).eq("id", existing.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (parsed.data.pricePkr !== undefined) {
      const price = pkrMajorToPaisa(parsed.data.pricePkr);
      const { error } = await supabase
        .from("product_variants")
        .update({ price_paisa: price, purchasable: price > 0 && (parsed.data.status ?? existing.status) === "active" })
        .eq("product_id", existing.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
