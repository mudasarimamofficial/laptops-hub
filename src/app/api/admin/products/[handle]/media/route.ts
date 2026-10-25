import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorizedStaffClient, staffErrorResponse } from "@/lib/auth/staff";

const ALLOWED_HOST_SUFFIXES = [
  "cdn.shopify.com",
  "shopify.com",
  "googleapis.com",
  "cloudinary.com",
  "res.cloudinary.com",
  "images.unsplash.com",
];

function assertSafeHttpsImageUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new MediaUrlError("Invalid URL");
  }
  if (url.protocol !== "https:") throw new MediaUrlError("Only HTTPS image URLs are allowed");
  if (url.username || url.password) throw new MediaUrlError("URLs with credentials are not allowed");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "127.0.0.1" || host === "::1") {
    throw new MediaUrlError("Private or local hosts are not allowed");
  }
  if (/^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) {
    throw new MediaUrlError("Private network hosts are not allowed");
  }
  // Prefer known CDNs; still allow other public HTTPS with explicit merchant intent
  const known = ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
  if (!known && !host.includes(".")) {
    throw new MediaUrlError("Host looks invalid");
  }
  return url;
}

class MediaUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaUrlError";
  }
}

const addSchema = z.object({
  url: z.string().url().max(2000),
  alt: z.string().max(500).default(""),
  position: z.number().int().min(1).max(100).optional(),
  origin: z.enum(["remote", "source_shopify"]).default("remote"),
  variantId: z.string().uuid().nullable().optional(),
  isPrimary: z.boolean().optional(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(100),
});

const patchMediaSchema = z.object({
  mediaId: z.string().uuid(),
  alt: z.string().max(500).optional(),
  isPrimary: z.boolean().optional(),
  variantId: z.string().uuid().nullable().optional(),
});

type Ctx = { params: Promise<{ handle: string }> };

async function loadProduct(supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>, handle: string) {
  const { data, error } = await supabase.from("products").select("id, handle").eq("handle", handle).maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const { handle } = await ctx.params;
    const product = await loadProduct(supabase, handle);
    if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const { data, error } = await supabase
      .from("product_media")
      .select("id, url, alt, position, approval, origin, variant_id, is_primary, health_status, last_checked_at")
      .eq("product_id", product.id)
      .order("position");
    if (error) {
      // Pre-migration: select base columns only
      const fallback = await supabase
        .from("product_media")
        .select("id, url, alt, position, approval")
        .eq("product_id", product.id)
        .order("position");
      if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
      return NextResponse.json({ media: fallback.data || [] }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ media: data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const { handle } = await ctx.params;
    const product = await loadProduct(supabase, handle);
    if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const body = await request.json().catch(() => null);
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed", message: "Provide a valid HTTPS image URL." }, { status: 400 });
    }

    let url: URL;
    try {
      url = assertSafeHttpsImageUrl(parsed.data.url);
    } catch (e) {
      return NextResponse.json(
        { error: "unsafe_url", message: e instanceof MediaUrlError ? e.message : "URL rejected" },
        { status: 400 },
      );
    }

    const { data: existing } = await supabase
      .from("product_media")
      .select("position")
      .eq("product_id", product.id)
      .order("position", { ascending: false })
      .limit(1);
    const nextPos = parsed.data.position ?? ((existing?.[0]?.position as number | undefined) ?? 0) + 1;

    const insert: Record<string, unknown> = {
      product_id: product.id,
      url: url.toString(),
      alt: parsed.data.alt,
      position: nextPos,
      approval: "pending",
      origin: parsed.data.origin,
      source_provider: url.hostname.includes("shopify") ? "shopify_cdn" : null,
      variant_id: parsed.data.variantId ?? null,
      is_primary: parsed.data.isPrimary ?? nextPos === 1,
    };

    let { data: row, error } = await supabase.from("product_media").insert(insert).select("id, url, alt, position").single();
    if (error) {
      const base = {
        product_id: product.id,
        url: url.toString(),
        alt: parsed.data.alt,
        position: nextPos,
        approval: "pending",
      };
      const retry = await supabase.from("product_media").insert(base).select("id, url, alt, position").single();
      if (retry.error || !retry.data) {
        return NextResponse.json({ error: retry.error?.message || "insert_failed" }, { status: 500 });
      }
      row = retry.data;
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "product_media.add",
      entity_type: "product_media",
      entity_id: row!.id,
      after: { productId: product.id, url: url.toString(), position: nextPos },
    });

    return NextResponse.json(
      {
        ok: true,
        media: row,
        notice: "Media rights remain pending until the owner confirms license/authorization for external URLs.",
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const { handle } = await ctx.params;
    const product = await loadProduct(supabase, handle);
    if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const body = await request.json().catch(() => null);
    if (body?.orderedIds) {
      const parsed = reorderSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "validation_failed" }, { status: 400 });
      }
      for (let i = 0; i < parsed.data.orderedIds.length; i++) {
        const id = parsed.data.orderedIds[i];
        await supabase
          .from("product_media")
          .update({ position: i + 1 })
          .eq("id", id)
          .eq("product_id", product.id);
      }
      await supabase.from("audit_logs").insert({
        actor_user_id: staff.userId,
        action: "product_media.reorder",
        entity_type: "products",
        entity_id: product.id,
        after: { orderedIds: parsed.data.orderedIds },
      });
      return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }

    const parsed = patchMediaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    }
    const patch: Record<string, unknown> = {};
    if (parsed.data.alt !== undefined) patch.alt = parsed.data.alt;
    if (parsed.data.isPrimary !== undefined) patch.is_primary = parsed.data.isPrimary;
    if (parsed.data.variantId !== undefined) patch.variant_id = parsed.data.variantId;

    const { error } = await supabase
      .from("product_media")
      .update(patch)
      .eq("id", parsed.data.mediaId)
      .eq("product_id", product.id);
    if (error) {
      const base: Record<string, unknown> = {};
      if (parsed.data.alt !== undefined) base.alt = parsed.data.alt;
      const { error: e2 } = await supabase
        .from("product_media")
        .update(base)
        .eq("id", parsed.data.mediaId)
        .eq("product_id", product.id);
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    }

    if (parsed.data.isPrimary) {
      // Best-effort: demote others when column exists
      await supabase
        .from("product_media")
        .update({ is_primary: false })
        .eq("product_id", product.id)
        .neq("id", parsed.data.mediaId);
      await supabase
        .from("product_media")
        .update({ position: 1 })
        .eq("id", parsed.data.mediaId)
        .eq("product_id", product.id);
    }

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const { handle } = await ctx.params;
    const product = await loadProduct(supabase, handle);
    if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const body = await request.json().catch(() => null);
    const mediaId = z.string().uuid().safeParse(body?.mediaId);
    if (!mediaId.success) {
      return NextResponse.json({ error: "validation_failed", message: "mediaId required" }, { status: 400 });
    }

    const { data: row } = await supabase
      .from("product_media")
      .select("id, url, position")
      .eq("id", mediaId.data)
      .eq("product_id", product.id)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const { error } = await supabase.from("product_media").delete().eq("id", row.id).eq("product_id", product.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "product_media.delete",
      entity_type: "product_media",
      entity_id: row.id,
      before: row,
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return staffErrorResponse(e);
  }
}
