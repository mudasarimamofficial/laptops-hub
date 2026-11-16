/**
 * Apply a staged Shopify CSV product set to the catalog (isolated / authorized use).
 * Never deletes products absent from the CSV.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StagedProduct } from "./shopify-csv";
import { pkrMajorToPaisa } from "@/lib/money";

export type ImportStrategy = "add_only" | "update_by_handle" | "skip_conflicts";

export type CommitOptions = {
  strategy: ImportStrategy;
  actorUserId?: string | null;
  dryRun?: boolean;
  defaultInventoryMode?: "tracked" | "untracked";
};

export type CommitProductResult = {
  handle: string;
  action: "created" | "updated" | "skipped" | "unchanged" | "conflict" | "failed";
  message?: string;
  productId?: string;
  variantCount?: number;
  mediaCount?: number;
};

function parsePriceToPaisa(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(String(raw).replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return pkrMajorToPaisa(n);
}

function mapStatus(raw: string | undefined, published: string | undefined): "draft" | "active" | "archived" {
  const s = (raw || "").toLowerCase();
  if (s === "archived") return "archived";
  if (s === "draft") return "draft";
  if (s === "active") return "active";
  if (published != null) {
    const p = published.toLowerCase();
    if (p === "true" || p === "1" || p === "yes") return "active";
    if (p === "false" || p === "0" || p === "no") return "draft";
  }
  return "draft";
}

function inventoryFromRow(row: StagedProduct["variantRows"][0], fallback: "tracked" | "untracked") {
  const tracker = (row.values.inventoryTracker || "").toLowerCase();
  const qtyRaw = row.values.inventoryQty;
  if (!tracker || tracker === "null" || tracker === "") {
    return { mode: fallback as "tracked" | "untracked", qty: null as number | null };
  }
  const qty = qtyRaw != null && qtyRaw !== "" ? Math.max(0, Math.floor(Number(qtyRaw))) : 0;
  return { mode: "tracked" as const, qty: Number.isFinite(qty) ? qty : 0 };
}

function optionValuesFromRow(row: StagedProduct["rows"][0]): Record<string, string> {
  const out: Record<string, string> = {};
  const n1 = row.values.option1Name;
  const v1 = row.values.option1Value;
  const n2 = row.values.option2Name;
  const v2 = row.values.option2Value;
  const n3 = row.values.option3Name;
  const v3 = row.values.option3Value;
  if (n1 && v1) out[n1] = v1;
  if (n2 && v2) out[n2] = v2;
  if (n3 && v3) out[n3] = v3;
  return out;
}

function collectImages(product: StagedProduct): { url: string; alt: string; position: number }[] {
  const imgs: { url: string; alt: string; position: number }[] = [];
  const seen = new Set<string>();
  for (const row of product.rows) {
    const url = row.values.imageSrc || row.values.variantImage;
    if (!url || !/^https:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    const pos = Number(row.values.imagePosition || imgs.length + 1) || imgs.length + 1;
    imgs.push({ url, alt: row.values.imageAlt || "", position: pos });
  }
  return imgs.sort((a, b) => a.position - b.position).map((img, i) => ({ ...img, position: i + 1 }));
}

export async function commitStagedProducts(
  supabase: SupabaseClient,
  products: StagedProduct[],
  opts: CommitOptions,
): Promise<{ results: CommitProductResult[]; summary: Record<string, number> }> {
  const results: CommitProductResult[] = [];
  const summary = { created: 0, updated: 0, skipped: 0, unchanged: 0, conflict: 0, failed: 0 };
  const fallbackInv = opts.defaultInventoryMode || "untracked";

  for (const product of products) {
    try {
      const { data: existing } = await supabase
        .from("products")
        .select("id, handle, title, status")
        .eq("handle", product.handle)
        .maybeSingle();

      if (existing && opts.strategy === "add_only") {
        results.push({ handle: product.handle, action: "skipped", message: "exists (add_only)", productId: existing.id });
        summary.skipped += 1;
        continue;
      }
      if (existing && opts.strategy === "skip_conflicts") {
        results.push({ handle: product.handle, action: "conflict", message: "exists (skip_conflicts)", productId: existing.id });
        summary.conflict += 1;
        continue;
      }

      const first = product.variantRows[0] || product.rows[0];
      const title = product.title || existing?.title || product.handle;
      const status = mapStatus(first?.values.status, first?.values.published);
      const tags = (first?.values.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const optionNames = [
        first?.values.option1Name,
        first?.values.option2Name,
        first?.values.option3Name,
      ].filter(Boolean) as string[];

      const productPayload: Record<string, unknown> = {
        handle: product.handle,
        title,
        description_safe: first?.values.bodyHtml || "",
        merchant_vendor: first?.values.vendor || "Laptops HUB",
        manufacturer: first?.values.vendor || null,
        product_type: first?.values.type || first?.values.productCategory || null,
        category: first?.values.type || null,
        status,
        tags,
        seo_title: first?.values.seoTitle || null,
        seo_description: first?.values.seoDescription || null,
        option_names: optionNames,
        import_source: "shopify_csv",
      };
      if (opts.actorUserId) productPayload.updated_by = opts.actorUserId;

      if (opts.dryRun) {
        results.push({
          handle: product.handle,
          action: existing ? "updated" : "created",
          message: "dry_run",
          variantCount: Math.max(1, product.variantRows.length),
          mediaCount: collectImages(product).length,
        });
        summary[existing ? "updated" : "created"] += 1;
        continue;
      }

      let productId = existing?.id as string | undefined;
      if (!existing) {
        const { data: created, error } = await supabase.from("products").insert(productPayload).select("id").single();
        if (error || !created) {
          // retry without new columns
          const slim = { ...productPayload };
          delete slim.option_names;
          delete slim.updated_by;
          const retry = await supabase.from("products").insert(slim).select("id").single();
          if (retry.error || !retry.data) {
            results.push({ handle: product.handle, action: "failed", message: error?.message || retry.error?.message });
            summary.failed += 1;
            continue;
          }
          productId = retry.data.id;
        } else {
          productId = created.id;
        }
      } else if (opts.strategy === "update_by_handle") {
        const { error } = await supabase.from("products").update(productPayload).eq("id", existing.id);
        if (error) {
          const slim = { ...productPayload };
          delete slim.option_names;
          delete slim.updated_by;
          await supabase.from("products").update(slim).eq("id", existing.id);
        }
        productId = existing.id;
      }

      // Variants: upsert by option tuple within product (do not wipe unrelated if add_only path)
      const variantRows = product.variantRows.length ? product.variantRows : [product.rows[0]].filter(Boolean);
      let variantCount = 0;
      for (const row of variantRows) {
        const price = parsePriceToPaisa(row.values.price);
        if (price == null) continue;
        const optsMap = optionValuesFromRow(row);
        const inv = inventoryFromRow(row, fallbackInv);
        const compare = parsePriceToPaisa(row.values.compareAt);
        const titleParts = Object.values(optsMap);
        const vTitle = titleParts.length ? titleParts.join(" / ") : "Default";
        const variantPayload: Record<string, unknown> = {
          product_id: productId,
          title: vTitle,
          sku: row.values.sku || null,
          barcode: row.values.barcode || null,
          price_paisa: price,
          compare_at_paisa: compare,
          option_values: optsMap,
          inventory_mode: inv.mode,
          quantity_on_hand: inv.mode === "tracked" ? inv.qty : null,
          purchasable: status === "active" && price > 0,
          position: variantCount + 1,
        };

        // Match existing variant by SKU within product, else by option_values JSON
        let existingVariant: { id: string } | null = null;
        if (row.values.sku) {
          const { data } = await supabase
            .from("product_variants")
            .select("id")
            .eq("product_id", productId!)
            .eq("sku", row.values.sku)
            .maybeSingle();
          existingVariant = data;
        }
        if (!existingVariant) {
          const { data: allV } = await supabase
            .from("product_variants")
            .select("id, option_values")
            .eq("product_id", productId!);
          existingVariant =
            (allV || []).find(
              (v) => JSON.stringify(v.option_values || {}) === JSON.stringify(optsMap),
            ) || null;
        }

        if (existingVariant) {
          const { error } = await supabase.from("product_variants").update(variantPayload).eq("id", existingVariant.id);
          if (error) {
            const slim = { ...variantPayload };
            delete slim.barcode;
            delete slim.position;
            await supabase.from("product_variants").update(slim).eq("id", existingVariant.id);
          }
        } else {
          const { error } = await supabase.from("product_variants").insert(variantPayload);
          if (error) {
            const slim = { ...variantPayload };
            delete slim.barcode;
            delete slim.position;
            const retry = await supabase.from("product_variants").insert(slim);
            if (retry.error) continue;
          }
        }
        variantCount += 1;
      }

      // Media: append remote URLs that are not already present (default — do not wipe)
      const images = collectImages(product);
      let mediaCount = 0;
      const { data: existingMedia } = await supabase
        .from("product_media")
        .select("url, position")
        .eq("product_id", productId!);
      const have = new Set((existingMedia || []).map((m) => m.url));
      let nextPos = Math.max(0, ...(existingMedia || []).map((m) => m.position as number));
      for (const img of images) {
        if (have.has(img.url)) continue;
        nextPos += 1;
        const insert = {
          product_id: productId,
          url: img.url,
          alt: img.alt,
          position: nextPos,
          approval: "pending",
          origin: img.url.includes("cdn.shopify.com") ? "source_shopify" : "remote",
          source_provider: img.url.includes("shopify") ? "shopify_cdn" : null,
          health_status: "unknown",
          is_primary: nextPos === 1 && !(existingMedia || []).length,
        };
        const { error } = await supabase.from("product_media").insert(insert);
        if (error) {
          const { origin: _o, source_provider: _s, health_status: _h, is_primary: _p, ...base } = insert;
          await supabase.from("product_media").insert(base);
        }
        mediaCount += 1;
      }

      // Optional collection hint (single)
      const collectionHint = first?.values.collection?.trim();
      if (collectionHint && productId) {
        const colSlug = collectionHint
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .trim()
          .replace(/[\s_]+/g, "-");
        if (colSlug) {
          let { data: col } = await supabase.from("collections").select("id").eq("slug", colSlug).maybeSingle();
          if (!col) {
            const created = await supabase
              .from("collections")
              .insert({ slug: colSlug, title: collectionHint, published: false, rule: {} })
              .select("id")
              .single();
            col = created.data;
          }
          if (col) {
            await supabase.from("collection_products").upsert(
              { collection_id: col.id, product_id: productId, position: 0 },
              { onConflict: "collection_id,product_id", ignoreDuplicates: true },
            );
          }
        }
      }

      const action = existing ? "updated" : "created";
      results.push({ handle: product.handle, action, productId, variantCount, mediaCount });
      summary[action] += 1;
    } catch (e) {
      results.push({
        handle: product.handle,
        action: "failed",
        message: e instanceof Error ? e.message : "unknown",
      });
      summary.failed += 1;
    }
  }

  return { results, summary };
}
