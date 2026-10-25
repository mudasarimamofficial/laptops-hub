import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAuthorizedStaffClient,
  createAuthorizedStaffWriter,
  staffErrorResponse,
} from "@/lib/auth/staff";

const patchSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().max(4000).optional(),
  published: z.boolean().optional(),
  featured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  rule: z.record(z.string(), z.unknown()).optional(),
  seoTitle: z.string().trim().max(200).nullable().optional(),
  seoDescription: z.string().trim().max(500).nullable().optional(),
  imageUrl: z.string().url().max(2000).nullable().optional(),
});

const membershipSchema = z.object({
  productIds: z.array(z.string().uuid()).max(500).optional(),
  addProductIds: z.array(z.string().uuid()).max(200).optional(),
  removeProductIds: z.array(z.string().uuid()).max(200).optional(),
  orderedProductIds: z.array(z.string().uuid()).max(500).optional(),
});

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const { slug } = await ctx.params;
    const { data, error } = await supabase
      .from("collections")
      .select(
        "id, slug, title, description, published, featured, rule, sort_order, collection_products(position, product_id, products(id, handle, title, status))",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ collection: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin", "manager", "editor"]);
    const { slug } = await ctx.params;
    const body = await request.json().catch(() => null);

    const { data: existing, error: findErr } = await supabase
      .from("collections")
      .select("id, slug, title, published")
      .eq("slug", slug)
      .maybeSingle();
    if (findErr || !existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

    if (body?.addProductIds || body?.removeProductIds || body?.orderedProductIds || body?.productIds) {
      const mem = membershipSchema.safeParse(body);
      if (!mem.success) {
        return NextResponse.json({ error: "validation_failed", message: "Invalid membership payload." }, { status: 400 });
      }

      if (mem.data.removeProductIds?.length) {
        await supabase
          .from("collection_products")
          .delete()
          .eq("collection_id", existing.id)
          .in("product_id", mem.data.removeProductIds);
      }

      if (mem.data.addProductIds?.length) {
        const { data: maxPos } = await supabase
          .from("collection_products")
          .select("position")
          .eq("collection_id", existing.id)
          .order("position", { ascending: false })
          .limit(1);
        let pos = (maxPos?.[0]?.position as number | undefined) ?? 0;
        const rows = mem.data.addProductIds.map((product_id) => {
          pos += 1;
          return { collection_id: existing.id, product_id, position: pos };
        });
        const { error } = await supabase.from("collection_products").upsert(rows, {
          onConflict: "collection_id,product_id",
          ignoreDuplicates: true,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (mem.data.orderedProductIds?.length) {
        for (let i = 0; i < mem.data.orderedProductIds.length; i++) {
          await supabase
            .from("collection_products")
            .update({ position: i + 1 })
            .eq("collection_id", existing.id)
            .eq("product_id", mem.data.orderedProductIds[i]);
        }
      }

      if (mem.data.productIds) {
        await supabase.from("collection_products").delete().eq("collection_id", existing.id);
        const rows = mem.data.productIds.map((product_id, i) => ({
          collection_id: existing.id,
          product_id,
          position: i + 1,
        }));
        if (rows.length) {
          const { error } = await supabase.from("collection_products").insert(rows);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }

      await supabase.from("audit_logs").insert({
        actor_user_id: staff.userId,
        action: "collection.membership",
        entity_type: "collections",
        entity_id: existing.id,
        after: mem.data,
      });
      return NextResponse.json({ ok: true, membership: true }, { headers: { "Cache-Control": "no-store" } });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    if (parsed.data.published !== undefined) patch.published = parsed.data.published;
    if (parsed.data.featured !== undefined) patch.featured = parsed.data.featured;
    if (parsed.data.sortOrder !== undefined) patch.sort_order = parsed.data.sortOrder;
    if (parsed.data.rule !== undefined) patch.rule = parsed.data.rule;
    if (parsed.data.seoTitle !== undefined) patch.seo_title = parsed.data.seoTitle;
    if (parsed.data.seoDescription !== undefined) patch.seo_description = parsed.data.seoDescription;
    if (parsed.data.imageUrl !== undefined) patch.image_url = parsed.data.imageUrl;

    const { error } = await supabase.from("collections").update(patch).eq("id", existing.id);
    if (error) {
      const fallback = { ...patch };
      delete fallback.seo_title;
      delete fallback.seo_description;
      delete fallback.image_url;
      const { error: e2 } = await supabase.from("collections").update(fallback).eq("id", existing.id);
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "collection.patch",
      entity_type: "collections",
      entity_id: existing.id,
      before: existing,
      after: parsed.data,
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
