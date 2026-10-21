export type ProductStatus = "draft" | "active" | "archived";

export type PublicProduct = {
  id: string;
  handle: string;
  title: string;
  descriptionSafe: string;
  manufacturer: string | null;
  productType: string | null;
  category: string | null;
  featured: boolean;
  tags: string[];
  specs: Record<string, unknown>;
  variantId: string;
  sku: string | null;
  pricePaisa: number;
  compareAtPaisa: number | null;
  maxPerOrder: number;
  /**
   * True only when the selected variant is explicitly `purchasable` in the database.
   * Never derived from stock quantities (none are read publicly).
   * Server-side `create_cod_order` remains the authority at checkout.
   */
  available: boolean;
  images: { url: string; alt: string; position: number }[];
};

export type CartLine = {
  variantId: string;
  handle: string;
  title: string;
  unitPricePaisa: number;
  quantity: number;
  imageUrl?: string;
  /** Variant max_per_order captured when added; older persisted lines may lack it (hard cap applies). */
  maxPerOrder?: number;
};
