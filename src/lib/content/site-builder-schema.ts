/**
 * Typed section registry for the no-code site editor.
 * Renderer remains V5 components; settings drive props once published.
 */

export type SectionType =
  | "v5_cinematic_hero"
  | "v5_product_story"
  | "v5_featured_products"
  | "v5_brand_grid"
  | "v5_budget_bands"
  | "v5_spec_filters"
  | "v5_new_gen"
  | "v5_chromebook"
  | "v5_compare_demo"
  | "v5_promo"
  | "v5_home_inquiry"
  | "rich_text"
  | "image_banner";

export type SectionInstance = {
  id: string;
  type: SectionType;
  enabled: boolean;
  label: string;
  settings: Record<string, unknown>;
};

export type SectionField = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "product_handle" | "product_handles" | "boolean" | "url";
  help?: string;
};

export const SECTION_REGISTRY: Record<
  SectionType,
  { label: string; description: string; fields: SectionField[] }
> = {
  v5_cinematic_hero: {
    label: "Cinematic hero",
    description: "V5 full-bleed hero with product shots",
    fields: [
      {
        key: "productHandles",
        label: "Product handles (ordered)",
        kind: "product_handles",
        help: "Comma-separated handles used for hero shots",
      },
    ],
  },
  v5_product_story: {
    label: "Product story",
    description: "Pinned product story frame",
    fields: [{ key: "productHandle", label: "Product handle", kind: "product_handle" }],
  },
  v5_featured_products: {
    label: "Featured products",
    description: "Featured carousel / grid from catalog flags",
    fields: [],
  },
  v5_brand_grid: {
    label: "Brand grid",
    description: "Brand exploration section",
    fields: [],
  },
  v5_budget_bands: {
    label: "Budget bands",
    description: "Price band navigation",
    fields: [],
  },
  v5_spec_filters: {
    label: "Spec filters",
    description: "RAM / CPU / storage entry points",
    fields: [],
  },
  v5_new_gen: {
    label: "New generation",
    description: "Newer CPU generation highlight",
    fields: [],
  },
  v5_chromebook: {
    label: "Chromebook",
    description: "Chromebook callout",
    fields: [],
  },
  v5_compare_demo: {
    label: "Compare demo",
    description: "Comparison teaser",
    fields: [],
  },
  v5_promo: {
    label: "Promo",
    description: "Promotional strip — factual copy only",
    fields: [{ key: "headline", label: "Headline", kind: "text" }],
  },
  v5_home_inquiry: {
    label: "Home inquiry",
    description: "Tell us what you are looking for",
    fields: [],
  },
  rich_text: {
    label: "Rich text",
    description: "Sanitized HTML block",
    fields: [{ key: "html", label: "HTML", kind: "textarea" }],
  },
  image_banner: {
    label: "Image banner",
    description: "Authorized image URL + alt + link",
    fields: [
      { key: "imageUrl", label: "Image URL", kind: "url" },
      { key: "alt", label: "Alt text", kind: "text" },
      { key: "href", label: "Link", kind: "url" },
    ],
  },
};

/** Default V5 homepage section order — matches src/app/page.tsx composition. */
export const V5_HOMEPAGE_SECTIONS: SectionInstance[] = [
  {
    id: "hero",
    type: "v5_cinematic_hero",
    enabled: true,
    label: "Cinematic hero",
    settings: {
      productHandles: [
        "dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage",
        "hp-probook-640-g2-core-i5-6th-gen-8gb-ram-256gb-storage",
        "lenovo-thinkpad-t580-core-i5-8th-gen-16gb-ram-512gb-storage",
      ],
    },
  },
  {
    id: "story",
    type: "v5_product_story",
    enabled: true,
    label: "Product story",
    settings: { productHandle: "dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage" },
  },
  { id: "featured", type: "v5_featured_products", enabled: true, label: "Featured", settings: {} },
  { id: "brands", type: "v5_brand_grid", enabled: true, label: "Brands", settings: {} },
  { id: "budget", type: "v5_budget_bands", enabled: true, label: "Budget", settings: {} },
  { id: "specs", type: "v5_spec_filters", enabled: true, label: "Specs", settings: {} },
  { id: "newgen", type: "v5_new_gen", enabled: true, label: "New gen", settings: {} },
  { id: "chromebook", type: "v5_chromebook", enabled: true, label: "Chromebook", settings: {} },
  { id: "compare", type: "v5_compare_demo", enabled: true, label: "Compare demo", settings: {} },
  { id: "promo", type: "v5_promo", enabled: true, label: "Promo", settings: {} },
  { id: "inquiry", type: "v5_home_inquiry", enabled: true, label: "Inquiry", settings: {} },
];
