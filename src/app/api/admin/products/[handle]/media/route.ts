import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAuthorizedStaffClient,
  createAuthorizedStaffWriter,
  staffErrorResponse,
} from "@/lib/auth/staff";
import { withCatalogRefresh } from "@/lib/catalog/refresh";
import {
  checkExternalImageUrl,
  cleanAlt,
  MediaInputError,
  moveToFront,
  orderProblem,
  STAGING_POSITION_BASE,
} from "@/lib/catalog/media-order";
import type { createServiceClient } from "@/lib/supabase/server";

/**
 * Product images (G13). Staff (owner, admin, manager, editor) add, describe, reorder, choose the primary image and
 * remove; only owner/admin record whether the image rights are confirmed. Removing an image detaches it from this
 * product only: the file stays where it is (Media library or the external host) and other products are untouched.
 * Every successful write refreshes the storefront (withCatalogRefresh).
 */

type Db = ReturnType<typeof createServiceClient>;
type Ctx = { params: Promise<{ handle: string }> };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (error: string, message: string, status: number) => json({ error, message }, status);

const addSchema = z.union([
  z.object({ assetId: z.string().uuid(), alt: z.string().max(2000).optional() }),
  z.object({ url: z.string().min(1).max(2000), alt: z.string().max(2000).optional() }),
]);
const patchSchema = z.union([
  z.object({ orderedIds: z.array(z.string().uuid()).min(1).max(100) }),
  z.object({ mediaId: z.string().uuid(), makePrimary: z.literal(true) }),
  z.object({ mediaId: z.string().uuid(), alt: z.string().max(2000) }),
  z.object({
    mediaId: z.string().uuid(),
    rights: z.enum(["pending", "approved"]),
    rightsNote: z.string().max(500).optional(),
  }),
]);

async function loadProduct(supabase: Db, handle: string) {
  const { data } = await supabase.from("products").select("id, handle, title").eq("handle", handle).maybeSingle();
  return data;
}

async function currentMedia(supabase: Db, productId: string) {
  return supabase
    .from("product_media")
    .select("id, url, alt, position, approval, origin, is_primary, rights_note")
    .eq("product_id", productId)
    .order("position");
}

/**
 * Writes a new order: first every image to a staging position, then to 1..n with only the first marked primary. The
 * unique (product_id, position) index never sees two images at one position, so "make primary" and swaps cannot
 * collide. If the second pass fails part-way, the staging positions still keep the requested order.
 */
async function writeOrder(supabase: Db, productId: string, orderedIds: string[]): Promise<string | null> {
  for (const [i, id] of orderedIds.entries()) {
    const { error } = await supabase.from("product_media").update({ position: STAGING_POSITION_BASE + i }).eq("id", id).eq("product_id", productId);
    if (error) return "Could not save the new order. Try again.";
  }
  for (const [i, id] of orderedIds.entries()) {
    const { error } = await supabase
      .from("product_media")
      .update({ position: i + 1, is_primary: i === 0 })
      .eq("id", id)
      .eq("product_id", productId);
    if (error) return "The new order was only partly saved. Reload the page and check it.";
  }
  return null;
}

async function variantsUsing(supabase: Db, mediaIds: string[]) {
  if (!mediaIds.length) return new Map<string, string[]>();
  const { data } = await supabase.from("product_variants").select("title, media_id").in("media_id", mediaIds);
  const map = new Map<string, string[]>();
  for (const v of data || []) {
    const list = map.get(v.media_id as string) || [];
    list.push((v.title as string) || "Default");
    map.set(v.media_id as string, list);
  }
  return map;
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { supabase } = await createAuthorizedStaffClient(["owner", "admin", "manager", "editor"]);
    const { handle } = await ctx.params;
    const product = await loadProduct(supabase, handle);
    if (!product) return fail("not_found", "Product not found.", 404);
    const { data, error } = await currentMedia(supabase, product.id);
    if (error) return fail("server_error", "The images could not be loaded. Try again.", 500);
    const usedBy = await variantsUsing(supabase, (data || []).map((m) => m.id));
    return json({ media: (data || []).map((m) => ({ ...m, usedByVariants: usedBy.get(m.id) || [] })) });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

async function handlePOST(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin", "manager", "editor"]);
    const { handle } = await ctx.params;
    const product = await loadProduct(supabase, handle);
    if (!product) return fail("not_found", "Product not found.", 404);

    const parsed = addSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("validation_failed", "Choose an image from the Media library, upload one, or paste an image address.", 400);

    let url: string;
    let origin: "uploaded" | "remote" | "source_shopify";
    let alt = cleanAlt(parsed.data.alt);
    if ("assetId" in parsed.data) {
      // Library and uploaded images are attached by id, so the stored address is the one our own upload recorded.
      const { data: asset } = await supabase.from("cms_media_assets").select("id, public_url, alt").eq("id", parsed.data.assetId).maybeSingle();
      if (!asset) return fail("not_found", "That image is no longer in the Media library.", 404);
      url = asset.public_url as string;
      origin = "uploaded";
      if (!alt) alt = cleanAlt(asset.alt);
    } else {
      try {
        url = checkExternalImageUrl(parsed.data.url);
      } catch (e) {
        return fail("unsafe_url", e instanceof MediaInputError ? e.message : "That image address was not accepted.", 400);
      }
      origin = /(^|\.)shopify\.com$/i.test(new URL(url).hostname) ? "source_shopify" : "remote";
    }

    const { data: existing, error: readErr } = await currentMedia(supabase, product.id);
    if (readErr) return fail("server_error", "The images could not be read. Nothing was added.", 500);
    if ((existing || []).some((m) => m.url === url)) return fail("duplicate", "This image is already in the product's gallery.", 409);
    if ((existing || []).length >= 100) return fail("too_many", "A product can have at most 100 images.", 400);

    const maxPos = Math.max(0, ...(existing || []).map((m) => m.position as number));
    const insert = {
      product_id: product.id,
      url,
      alt,
      position: maxPos + 1,
      approval: "pending",
      origin,
      source_provider: origin === "source_shopify" ? "shopify_cdn" : origin === "uploaded" ? "cms_media" : null,
      is_primary: (existing || []).length === 0,
      health_status: "unknown",
    };
    const { data: row, error } = await supabase.from("product_media").insert(insert).select("id, url, alt, position").single();
    if (error || !row) {
      return fail(
        error?.code === "23505" ? "busy" : "server_error",
        error?.code === "23505" ? "Another change to these images happened at the same time. Reload and try again." : "The image could not be added. Try again.",
        error?.code === "23505" ? 409 : 500,
      );
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "product_media.add",
      entity_type: "product_media",
      entity_id: row.id,
      after: { productId: product.id, url, origin, position: row.position },
    });
    return json({ ok: true, media: row, message: "Image added to the end of the gallery. Its rights are marked as not confirmed." }, 201);
  } catch (e) {
    return staffErrorResponse(e);
  }
}

async function handlePATCH(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin", "manager", "editor"]);
    const { handle } = await ctx.params;
    const product = await loadProduct(supabase, handle);
    if (!product) return fail("not_found", "Product not found.", 404);

    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("validation_failed", "That change could not be read. Reload the page and try again.", 400);
    const body = parsed.data;

    const { data: rows, error: readErr } = await currentMedia(supabase, product.id);
    if (readErr) return fail("server_error", "The images could not be read. Nothing was changed.", 500);
    const ids = (rows || []).map((m) => m.id as string);

    if ("orderedIds" in body || "makePrimary" in body) {
      const ordered = "orderedIds" in body ? body.orderedIds : moveToFront(ids, body.mediaId);
      if ("makePrimary" in body && !ids.includes(body.mediaId)) return fail("not_found", "That image is no longer on this product.", 404);
      const problem = orderProblem(ids, ordered);
      if (problem) return fail("stale_order", problem, 409);
      const writeErr = await writeOrder(supabase, product.id, ordered);
      if (writeErr) return fail("server_error", writeErr, 500);
      await supabase.from("audit_logs").insert({
        actor_user_id: staff.userId,
        action: "makePrimary" in body ? "product_media.primary" : "product_media.reorder",
        entity_type: "products",
        entity_id: product.id,
        before: { orderedIds: ids },
        after: { orderedIds: ordered },
      });
      return json({ ok: true, message: "makePrimary" in body ? "Primary image set. It now shows first everywhere." : "Order saved." });
    }

    const target = (rows || []).find((m) => m.id === body.mediaId);
    if (!target) return fail("not_found", "That image is no longer on this product.", 404);

    if ("alt" in body) {
      const alt = cleanAlt(body.alt);
      const { error } = await supabase.from("product_media").update({ alt }).eq("id", target.id).eq("product_id", product.id);
      if (error) return fail("server_error", "The description could not be saved. Try again.", 500);
      await supabase.from("audit_logs").insert({
        actor_user_id: staff.userId,
        action: "product_media.alt",
        entity_type: "product_media",
        entity_id: target.id,
        before: { alt: target.alt },
        after: { alt },
      });
      return json({ ok: true, alt, message: alt ? "Description saved." : "Description cleared: the product name is used instead." });
    }

    // Rights status: a business/legal statement, so owner and admin only.
    if (staff.role !== "owner" && staff.role !== "admin") {
      return fail("forbidden", "Only the owner or an admin can confirm image rights.", 403);
    }
    const note = body.rightsNote === undefined ? (target.rights_note as string | null) : body.rightsNote.trim().slice(0, 500) || null;
    const { error } = await supabase.from("product_media").update({ approval: body.rights, rights_note: note }).eq("id", target.id).eq("product_id", product.id);
    if (error) return fail("server_error", "The rights status could not be saved. Try again.", 500);
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "product_media.rights",
      entity_type: "product_media",
      entity_id: target.id,
      before: { approval: target.approval, rights_note: target.rights_note },
      after: { approval: body.rights, rights_note: note },
    });
    return json({ ok: true, message: body.rights === "approved" ? "Rights marked as confirmed." : "Rights marked as not confirmed." });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

async function handleDELETE(request: Request, ctx: Ctx) {
  try {
    const { staff, supabase } = await createAuthorizedStaffWriter(["owner", "admin", "manager", "editor"]);
    const { handle } = await ctx.params;
    const product = await loadProduct(supabase, handle);
    if (!product) return fail("not_found", "Product not found.", 404);

    const body = await request.json().catch(() => null);
    const mediaId = z.string().uuid().safeParse(body?.mediaId);
    if (!mediaId.success) return fail("validation_failed", "Choose an image to remove.", 400);

    const { data: rows, error: readErr } = await currentMedia(supabase, product.id);
    if (readErr) return fail("server_error", "The images could not be read. Nothing was removed.", 500);
    const row = (rows || []).find((m) => m.id === mediaId.data);
    if (!row) return fail("not_found", "That image is no longer on this product.", 404);

    const usedBy = (await variantsUsing(supabase, [row.id])).get(row.id) || [];
    if (usedBy.length) {
      return fail("media_in_use", `This image is the picture for the option ${usedBy.join(", ")}. Choose another picture for it first.`, 409);
    }

    const { error } = await supabase.from("product_media").delete().eq("id", row.id).eq("product_id", product.id);
    if (error) return fail("server_error", "The image could not be removed. Try again.", 500);

    // Close the gap so the next image becomes primary when the first one is removed.
    const rest = (rows || []).filter((m) => m.id !== row.id).map((m) => m.id as string);
    const reorderErr = rest.length ? await writeOrder(supabase, product.id, rest) : null;

    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "product_media.delete",
      entity_type: "product_media",
      entity_id: row.id,
      before: { url: row.url, alt: row.alt, position: row.position, origin: row.origin },
    });
    return json({
      ok: true,
      message: reorderErr
        ? "Image removed. The remaining order could not be tidied; reload and check it."
        : "Image removed from this product. The file itself was not deleted.",
    });
  } catch (e) {
    return staffErrorResponse(e);
  }
}

export const POST = withCatalogRefresh(handlePOST);
export const PATCH = withCatalogRefresh(handlePATCH);
export const DELETE = withCatalogRefresh(handleDELETE);
