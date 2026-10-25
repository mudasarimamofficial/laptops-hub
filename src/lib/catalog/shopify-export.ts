import { toCsvLine } from "./shopify-csv";

export type ExportProduct = {
  handle: string;
  title: string;
  description_safe: string;
  merchant_vendor: string;
  manufacturer: string | null;
  product_type: string | null;
  category: string | null;
  status: string;
  tags: string[] | null;
  seo_title: string | null;
  seo_description: string | null;
  product_variants: {
    title: string;
    sku: string | null;
    barcode?: string | null;
    price_paisa: number;
    compare_at_paisa: number | null;
    inventory_mode: string;
    quantity_on_hand: number | null;
    option_values: Record<string, string> | null;
    allow_oversell?: boolean;
  }[];
  product_media: {
    url: string;
    alt: string;
    position: number;
  }[];
};

function paisaToShopifyPrice(paisa: number): string {
  return (paisa / 100).toFixed(2);
}

function optionEntries(optionValues: Record<string, string> | null | undefined): [string, string][] {
  if (!optionValues || typeof optionValues !== "object") return [];
  return Object.entries(optionValues).slice(0, 3);
}

/** Modern Shopify product CSV columns (supported subset). */
export const SHOPIFY_MODERN_EXPORT_HEADERS = [
  "Title",
  "URL handle",
  "Description",
  "Vendor",
  "Type",
  "Tags",
  "Status",
  "Option1 name",
  "Option1 value",
  "Option2 name",
  "Option2 value",
  "Option3 name",
  "Option3 value",
  "SKU",
  "Barcode",
  "Price",
  "Compare-at price",
  "Inventory tracker",
  "Inventory quantity",
  "Continue selling when out of stock",
  "Product image URL",
  "Image position",
  "Image alt text",
  "SEO title",
  "SEO description",
] as const;

export function productsToShopifyModernCsv(products: ExportProduct[]): string {
  const lines: string[] = [toCsvLine([...SHOPIFY_MODERN_EXPORT_HEADERS])];

  for (const p of products) {
    const variants = p.product_variants?.length ? p.product_variants : [];
    const media = [...(p.product_media || [])].sort((a, b) => a.position - b.position);
    const status = p.status === "active" ? "Active" : p.status === "archived" ? "Archived" : "Draft";
    const tags = (p.tags || []).join(", ");

    if (variants.length === 0) {
      // Should not happen for LH products; emit title row only
      lines.push(
        toCsvLine([
          p.title,
          p.handle,
          p.description_safe || "",
          p.merchant_vendor || "Laptops HUB",
          p.product_type || p.category || "",
          tags,
          status,
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          media[0]?.url || "",
          media[0] ? String(media[0].position) : "",
          media[0]?.alt || "",
          p.seo_title || "",
          p.seo_description || "",
        ]),
      );
    } else {
      variants.forEach((v, vi) => {
        const opts = optionEntries(v.option_values);
        const o1 = opts[0] || ["", ""];
        const o2 = opts[1] || ["", ""];
        const o3 = opts[2] || ["", ""];
        const tracked = v.inventory_mode === "tracked";
        const img = media[vi] || (vi === 0 ? media[0] : undefined);
        lines.push(
          toCsvLine([
            vi === 0 ? p.title : "",
            p.handle,
            vi === 0 ? p.description_safe || "" : "",
            vi === 0 ? p.merchant_vendor || "Laptops HUB" : "",
            vi === 0 ? p.product_type || p.category || "" : "",
            vi === 0 ? tags : "",
            vi === 0 ? status : "",
            o1[0],
            o1[1],
            o2[0],
            o2[1],
            o3[0],
            o3[1],
            v.sku || "",
            v.barcode || "",
            paisaToShopifyPrice(v.price_paisa),
            v.compare_at_paisa != null ? paisaToShopifyPrice(v.compare_at_paisa) : "",
            tracked ? "shopify" : "",
            tracked && v.quantity_on_hand != null ? String(v.quantity_on_hand) : "",
            tracked ? (v.allow_oversell ? "TRUE" : "FALSE") : "",
            img?.url || "",
            img ? String(img.position) : "",
            img?.alt || "",
            vi === 0 ? p.seo_title || "" : "",
            vi === 0 ? p.seo_description || "" : "",
          ]),
        );
      });
    }

    // Extra image-only rows (Shopify pattern) beyond variant count
    for (let i = variants.length; i < media.length; i++) {
      const img = media[i];
      lines.push(
        toCsvLine([
          "",
          p.handle,
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          img.url,
          String(img.position),
          img.alt || "",
          "",
          "",
        ]),
      );
    }
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** Supported legacy Shopify product CSV headers (Handle-first shape). */
export const SHOPIFY_LEGACY_EXPORT_HEADERS = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Type",
  "Tags",
  "Published",
  "Option1 Name",
  "Option1 Value",
  "Option2 Name",
  "Option2 Value",
  "Option3 Name",
  "Option3 Value",
  "Variant SKU",
  "Variant Barcode",
  "Variant Price",
  "Variant Compare At Price",
  "Variant Inventory Tracker",
  "Variant Inventory Qty",
  "Variant Inventory Policy",
  "Image Src",
  "Image Position",
  "Image Alt Text",
  "SEO Title",
  "SEO Description",
] as const;

export function productsToShopifyLegacyCsv(products: ExportProduct[]): string {
  const lines: string[] = [toCsvLine([...SHOPIFY_LEGACY_EXPORT_HEADERS])];
  for (const p of products) {
    const variants = p.product_variants?.length ? p.product_variants : [{ title: "Default", sku: null, price_paisa: 0, compare_at_paisa: null, inventory_mode: "untracked", quantity_on_hand: null, option_values: {} }];
    const media = [...(p.product_media || [])].sort((a, b) => a.position - b.position);
    const published = p.status === "active" ? "TRUE" : "FALSE";
    const tags = (p.tags || []).join(", ");
    variants.forEach((v, vi) => {
      const opts = optionEntries(v.option_values);
      const o1 = opts[0] || ["Title", v.title || "Default"];
      const o2 = opts[1] || ["", ""];
      const o3 = opts[2] || ["", ""];
      const tracked = v.inventory_mode === "tracked";
      const img = media[vi] || (vi === 0 ? media[0] : undefined);
      lines.push(
        toCsvLine([
          p.handle,
          vi === 0 ? p.title : "",
          vi === 0 ? p.description_safe || "" : "",
          vi === 0 ? p.merchant_vendor || "Laptops HUB" : "",
          vi === 0 ? p.product_type || p.category || "" : "",
          vi === 0 ? tags : "",
          vi === 0 ? published : "",
          o1[0],
          o1[1],
          o2[0],
          o2[1],
          o3[0],
          o3[1],
          v.sku || "",
          v.barcode || "",
          paisaToShopifyPrice(v.price_paisa),
          v.compare_at_paisa != null ? paisaToShopifyPrice(v.compare_at_paisa) : "",
          tracked ? "shopify" : "",
          tracked && v.quantity_on_hand != null ? String(v.quantity_on_hand) : "",
          tracked ? (v.allow_oversell ? "continue" : "deny") : "",
          img?.url || "",
          img ? String(img.position) : "",
          img?.alt || "",
          vi === 0 ? p.seo_title || "" : "",
          vi === 0 ? p.seo_description || "" : "",
        ]),
      );
    });
    for (let i = variants.length; i < media.length; i++) {
      const img = media[i];
      lines.push(
        toCsvLine([
          p.handle,
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          img.url,
          String(img.position),
          img.alt || "",
          "",
          "",
        ]),
      );
    }
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** Laptops HUB extended product CSV (extra merchant columns). */
export const LH_EXTENDED_EXPORT_HEADERS = [
  ...SHOPIFY_MODERN_EXPORT_HEADERS,
  "LH Manufacturer",
  "LH Category",
  "LH Variant Title",
] as const;

export function productsToLhExtendedCsv(products: ExportProduct[]): string {
  const lines: string[] = [toCsvLine([...LH_EXTENDED_EXPORT_HEADERS])];
  for (const p of products) {
    const variants = p.product_variants?.length ? p.product_variants : [];
    const media = [...(p.product_media || [])].sort((a, b) => a.position - b.position);
    const status = p.status === "active" ? "Active" : p.status === "archived" ? "Archived" : "Draft";
    const tags = (p.tags || []).join(", ");
    variants.forEach((v, vi) => {
      const opts = optionEntries(v.option_values);
      const o1 = opts[0] || ["", ""];
      const o2 = opts[1] || ["", ""];
      const o3 = opts[2] || ["", ""];
      const tracked = v.inventory_mode === "tracked";
      const img = media[vi] || (vi === 0 ? media[0] : undefined);
      lines.push(
        toCsvLine([
          vi === 0 ? p.title : "",
          p.handle,
          vi === 0 ? p.description_safe || "" : "",
          vi === 0 ? p.merchant_vendor || "Laptops HUB" : "",
          vi === 0 ? p.product_type || p.category || "" : "",
          vi === 0 ? tags : "",
          vi === 0 ? status : "",
          o1[0],
          o1[1],
          o2[0],
          o2[1],
          o3[0],
          o3[1],
          v.sku || "",
          v.barcode || "",
          paisaToShopifyPrice(v.price_paisa),
          v.compare_at_paisa != null ? paisaToShopifyPrice(v.compare_at_paisa) : "",
          tracked ? "shopify" : "",
          tracked && v.quantity_on_hand != null ? String(v.quantity_on_hand) : "",
          tracked ? (v.allow_oversell ? "TRUE" : "FALSE") : "",
          img?.url || "",
          img ? String(img.position) : "",
          img?.alt || "",
          vi === 0 ? p.seo_title || "" : "",
          vi === 0 ? p.seo_description || "" : "",
          vi === 0 ? p.manufacturer || "" : "",
          vi === 0 ? p.category || "" : "",
          v.title || "",
        ]),
      );
    });
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function productsToInventoryCsv(products: ExportProduct[]): string {
  const headers = ["Handle", "SKU", "Variant title", "Inventory mode", "Quantity on hand", "Allow oversell", "Price PKR"];
  const lines: string[] = [toCsvLine(headers)];
  for (const p of products) {
    for (const v of p.product_variants || []) {
      lines.push(
        toCsvLine([
          p.handle,
          v.sku || "",
          v.title || "",
          v.inventory_mode,
          v.quantity_on_hand != null ? String(v.quantity_on_hand) : "",
          v.allow_oversell ? "TRUE" : "FALSE",
          paisaToShopifyPrice(v.price_paisa),
        ]),
      );
    }
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export type CollectionMembershipExportRow = {
  collection_slug: string;
  collection_title: string;
  product_handle: string;
  product_title: string;
  position: number;
};

export function collectionMembershipToCsv(rows: CollectionMembershipExportRow[]): string {
  const lines: string[] = [toCsvLine(["Collection slug", "Collection title", "Product handle", "Product title", "Position"])];
  for (const r of rows) {
    lines.push(
      toCsvLine([r.collection_slug, r.collection_title, r.product_handle, r.product_title, String(r.position)]),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
