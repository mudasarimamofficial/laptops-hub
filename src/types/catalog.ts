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
  images: { url: string; alt: string; position: number }[];
};

export type CartLine = {
  variantId: string;
  handle: string;
  title: string;
  unitPricePaisa: number;
  quantity: number;
  imageUrl?: string;
};
