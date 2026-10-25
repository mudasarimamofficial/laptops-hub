/**
 * Shopify product CSV detection, header aliases, and staging helpers.
 * Grounded against Shopify Help Center modern + legacy export headers.
 * Does not mutate the catalog — staging / dry-run only until commit APIs run.
 */

export type ShopifyCsvProfile = "modern" | "legacy" | "unknown";

/** Modern Shopify product CSV headers (subset we support). */
export const SHOPIFY_MODERN_HEADERS = [
  "Title",
  "URL handle",
  "Description",
  "Vendor",
  "Product category",
  "Type",
  "Tags",
  "Published on online store",
  "Status",
  "SKU",
  "Barcode",
  "Option1 name",
  "Option1 value",
  "Option2 name",
  "Option2 value",
  "Option3 name",
  "Option3 value",
  "Price",
  "Compare-at price",
  "Cost per item",
  "Charge tax",
  "Tax code",
  "Unit cost currency",
  "Inventory tracker",
  "Inventory quantity",
  "Continue selling when out of stock",
  "Weight value",
  "Weight unit for product",
  "Requires shipping",
  "Fulfillment service",
  "Product image URL",
  "Image position",
  "Image alt text",
  "Variant image URL",
  "Gift card",
  "SEO title",
  "SEO description",
  "Google Shopping / Google Product Category",
  "Google Shopping / Gender",
  "Google Shopping / Age group",
  "Google Shopping / MPN",
  "Google Shopping / Condition",
  "Google Shopping / Custom product",
  "Google Shopping / Custom label 0",
  "Collection",
] as const;

/** Legacy / classic Shopify export headers. */
export const SHOPIFY_LEGACY_HEADERS = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Product Category",
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
  "Variant Grams",
  "Variant Inventory Tracker",
  "Variant Inventory Qty",
  "Variant Inventory Policy",
  "Variant Fulfillment Service",
  "Variant Price",
  "Variant Compare At Price",
  "Variant Requires Shipping",
  "Variant Taxable",
  "Variant Barcode",
  "Image Src",
  "Image Position",
  "Image Alt Text",
  "Gift Card",
  "SEO Title",
  "SEO Description",
  "Variant Image",
  "Variant Weight Unit",
  "Variant Tax Code",
  "Cost per item",
  "Status",
] as const;

export type CanonicalField =
  | "handle"
  | "title"
  | "bodyHtml"
  | "vendor"
  | "productCategory"
  | "type"
  | "tags"
  | "published"
  | "status"
  | "option1Name"
  | "option1Value"
  | "option2Name"
  | "option2Value"
  | "option3Name"
  | "option3Value"
  | "sku"
  | "barcode"
  | "price"
  | "compareAt"
  | "cost"
  | "inventoryTracker"
  | "inventoryQty"
  | "inventoryPolicy"
  | "weight"
  | "weightUnit"
  | "requiresShipping"
  | "taxable"
  | "imageSrc"
  | "imagePosition"
  | "imageAlt"
  | "variantImage"
  | "seoTitle"
  | "seoDescription"
  | "collection"
  | "giftCard";

/** Map either modern or legacy header → canonical field. */
export const HEADER_ALIASES: Record<string, CanonicalField> = {
  // handle
  "URL handle": "handle",
  Handle: "handle",
  // title / body
  Title: "title",
  Description: "bodyHtml",
  "Body (HTML)": "bodyHtml",
  Vendor: "vendor",
  "Product category": "productCategory",
  "Product Category": "productCategory",
  Type: "type",
  Tags: "tags",
  "Published on online store": "published",
  Published: "published",
  Status: "status",
  "Option1 name": "option1Name",
  "Option1 Name": "option1Name",
  "Option1 value": "option1Value",
  "Option1 Value": "option1Value",
  "Option2 name": "option2Name",
  "Option2 Name": "option2Name",
  "Option2 value": "option2Value",
  "Option2 Value": "option2Value",
  "Option3 name": "option3Name",
  "Option3 Name": "option3Name",
  "Option3 value": "option3Value",
  "Option3 Value": "option3Value",
  SKU: "sku",
  "Variant SKU": "sku",
  Barcode: "barcode",
  "Variant Barcode": "barcode",
  Price: "price",
  "Variant Price": "price",
  "Compare-at price": "compareAt",
  "Variant Compare At Price": "compareAt",
  "Cost per item": "cost",
  "Inventory tracker": "inventoryTracker",
  "Variant Inventory Tracker": "inventoryTracker",
  "Inventory quantity": "inventoryQty",
  "Variant Inventory Qty": "inventoryQty",
  "Continue selling when out of stock": "inventoryPolicy",
  "Variant Inventory Policy": "inventoryPolicy",
  "Weight value": "weight",
  "Variant Grams": "weight",
  "Weight unit for product": "weightUnit",
  "Variant Weight Unit": "weightUnit",
  "Requires shipping": "requiresShipping",
  "Variant Requires Shipping": "requiresShipping",
  "Charge tax": "taxable",
  "Variant Taxable": "taxable",
  "Product image URL": "imageSrc",
  "Image Src": "imageSrc",
  "Image position": "imagePosition",
  "Image Position": "imagePosition",
  "Image alt text": "imageAlt",
  "Image Alt Text": "imageAlt",
  "Variant image URL": "variantImage",
  "Variant Image": "variantImage",
  "SEO title": "seoTitle",
  "SEO Title": "seoTitle",
  "SEO description": "seoDescription",
  "SEO Description": "seoDescription",
  Collection: "collection",
  "Gift card": "giftCard",
  "Gift Card": "giftCard",
};

export function normalizeHeader(h: string): string {
  return h.replace(/^\uFEFF/, "").trim();
}

export function detectShopifyCsvProfile(headers: string[]): {
  profile: ShopifyCsvProfile;
  known: string[];
  unknown: string[];
  mapped: Partial<Record<CanonicalField, string>>;
} {
  const normalized = headers.map(normalizeHeader);
  const mapped: Partial<Record<CanonicalField, string>> = {};
  const known: string[] = [];
  const unknown: string[] = [];

  for (const h of normalized) {
    const field = HEADER_ALIASES[h];
    if (field) {
      known.push(h);
      if (!mapped[field]) mapped[field] = h;
    } else if (h) {
      unknown.push(h);
    }
  }

  const hasModern = Boolean(mapped.handle && mapped.handle === "URL handle") || normalized.includes("URL handle");
  const hasLegacy = normalized.includes("Handle") || normalized.includes("Body (HTML)") || normalized.includes("Image Src");
  const hasTitle = Boolean(mapped.title);
  const hasHandle = Boolean(mapped.handle);

  let profile: ShopifyCsvProfile = "unknown";
  if (hasHandle && hasTitle && hasModern && !normalized.includes("Handle")) profile = "modern";
  else if (hasHandle && (hasLegacy || hasTitle)) profile = "legacy";
  else if (hasHandle && hasTitle) profile = known.includes("URL handle") ? "modern" : "legacy";

  return { profile, known, unknown, mapped };
}

export type StagedCsvRow = {
  line: number;
  values: Partial<Record<CanonicalField, string>>;
  raw: Record<string, string>;
};

export type StagedProduct = {
  handle: string;
  title: string;
  rows: StagedCsvRow[];
  variantRows: StagedCsvRow[];
  imageOnlyRows: StagedCsvRow[];
};

export function stageShopifyRows(
  rows: Record<string, string>[],
  mapped: Partial<Record<CanonicalField, string>>,
): { products: StagedProduct[]; errors: { line: number; message: string }[] } {
  const errors: { line: number; message: string }[] = [];
  const byHandle = new Map<string, StagedProduct>();

  rows.forEach((raw, idx) => {
    const line = idx + 2; // header is line 1
    const values: Partial<Record<CanonicalField, string>> = {};
    for (const [field, header] of Object.entries(mapped) as [CanonicalField, string][]) {
      const v = raw[header];
      if (v !== undefined && v !== "") values[field] = v;
    }

    const handle = (values.handle || "").trim().toLowerCase();
    if (!handle) {
      // Image-continuation rows in some exports repeat handle; empty handle is invalid
      errors.push({ line, message: "Missing URL handle / Handle" });
      return;
    }

    const stagedRow: StagedCsvRow = { line, values, raw };
    let product = byHandle.get(handle);
    if (!product) {
      product = {
        handle,
        title: (values.title || "").trim() || handle,
        rows: [],
        variantRows: [],
        imageOnlyRows: [],
      };
      byHandle.set(handle, product);
    } else if (values.title) {
      product.title = values.title.trim();
    }

    product.rows.push(stagedRow);

    const hasVariantSignal =
      values.sku !== undefined ||
      values.price !== undefined ||
      values.option1Value !== undefined ||
      values.option2Value !== undefined ||
      values.option3Value !== undefined ||
      values.inventoryQty !== undefined;

    const hasImageOnly =
      !hasVariantSignal &&
      (values.imageSrc !== undefined || values.variantImage !== undefined) &&
      !values.title;

    if (hasImageOnly) product.imageOnlyRows.push(stagedRow);
    else if (hasVariantSignal || values.title || product.variantRows.length === 0) {
      // First row with title often carries the default variant
      product.variantRows.push(stagedRow);
    } else {
      product.imageOnlyRows.push(stagedRow);
    }
  });

  return { products: [...byHandle.values()], errors };
}

export function summarizeStaging(products: StagedProduct[], unknownHeaders: string[]) {
  const variantCount = products.reduce((n, p) => n + Math.max(1, p.variantRows.length), 0);
  const imageRows = products.reduce((n, p) => n + p.imageOnlyRows.length + p.rows.filter((r) => r.values.imageSrc).length, 0);
  return {
    productCount: products.length,
    variantCount,
    imageRowSignals: imageRows,
    unknownHeaderCount: unknownHeaders.length,
    unknownHeaders: unknownHeaders.slice(0, 40),
  };
}

/** Neutralize CSV formula injection for spreadsheet-safe export cells. */
export function csvSafeCell(value: string): string {
  const s = value ?? "";
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  return s;
}

export function toCsvLine(fields: string[]): string {
  return fields
    .map((f) => {
      const safe = csvSafeCell(f);
      if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
      return safe;
    })
    .join(",");
}
