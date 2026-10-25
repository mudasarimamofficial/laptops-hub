import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";
import { pkrMajorToPaisa } from "@/lib/money";

const itemSchema = z.object({
  handle: z.string().min(1),
  status: z.enum(["draft", "active", "archived"]).optional(),
  featured: z.boolean().optional(),
  tagsAdd: z.array(z.string().max(60)).max(20).optional(),
  tagsRemove: z.array(z.string().max(60)).max(20).optional(),
  pricePkr: z.number().min(0).max(10_000_000).optional(),
  inventoryMode: z.enum(["tracked", "untracked"]).optional(),
});

const bodySchema = z.object({
  items: z.array(itemSchema).min(1).max(100),
});

/** Bulk patch by handle. Price/inventory apply to the first variant of each product. */
export async function POST(request: Request) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed", message: "Provide 1–100 items with handles." }, { status: 400 });
    }

    const results: { handle: string; ok: boolean; message?: string }[] = [];

    for (const item of parsed.data.items) {
      const { data: product, error } = await supabase
        .from("products")
        .select("id, handle, status, featured, tags")
        .eq("handle", item.handle)
        .maybeSingle();
      if (error || !product) {
        results.push({ handle: item.handle, ok: false, message: "not_found" });
        continue;
      }

      const patch: Record<string, unknown> = {};
      if (item.status !== undefined) patch.status = item.status;
      if (item.featured !== undefined) patch.featured = item.featured;
      if (item.tagsAdd || item.tagsRemove) {
        let tags = [...((product.tags as string[]) || [])];
        if (item.tagsAdd) for (const t of item.tagsAdd) if (!tags.includes(t)) tags.push(t);
        if (item.tagsRemove) tags = tags.filter((t) => !item.tagsRemove!.includes(t));
        patch.tags = tags;
      }
      if (Object.keys(patch).length) {
        const { error: uErr } = await supabase.from("products").update(patch).eq("id", product.id);
        if (uErr) {
          results.push({ handle: item.handle, ok: false, message: uErr.message });
          continue;
        }
      }

      if (item.pricePkr !== undefined || item.inventoryMode !== undefined) {
        const { data: variants } = await supabase
          .from("product_variants")
          .select("id")
          .eq("product_id", product.id)
          .order("created_at")
          .limit(1);
        const vid = variants?.[0]?.id;
        if (vid) {
          const vPatch: Record<string, unknown> = {};
          if (item.pricePkr !== undefined) {
            const price = pkrMajorToPaisa(item.pricePkr);
            vPatch.price_paisa = price;
            const status = (item.status ?? product.status) as string;
            vPatch.purchasable = price > 0 && status === "active";
          }
          if (item.inventoryMode !== undefined) {
            vPatch.inventory_mode = item.inventoryMode;
            if (item.inventoryMode === "untracked") vPatch.quantity_on_hand = null;
          }
          await supabase.from("product_variants").update(vPatch).eq("id", vid);
        }
      }

      results.push({ handle: item.handle, ok: true });
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "products.bulk_patch",
      entity_type: "products",
      after: { count: results.length, ok: results.filter((r) => r.ok).length },
    });

    return NextResponse.json(
      { ok: true, results, successCount: results.filter((r) => r.ok).length },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
