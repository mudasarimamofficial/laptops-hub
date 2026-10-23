import type { PublicProduct } from "@/types/catalog";

export type CollectionDef = {
  slug: string;
  title: string;
  description: string;
  match: (p: PublicProduct) => boolean;
};

function brandIs(p: PublicProduct, name: string) {
  const m = (p.manufacturer || "").toLowerCase();
  const t = p.title.toLowerCase();
  // Merchant vendor "Laptops HUB" must never count as a brand manufacturer
  if (m.includes("laptops hub") || m === "laptops hub") return false;
  return m === name.toLowerCase() || t.startsWith(name.toLowerCase() + " ");
}

export const COLLECTION_DEFS: CollectionDef[] = [
  {
    slug: "laptops",
    title: "Laptops",
    description: "Notebooks including business, gaming, MacBook and Chromebook computers.",
    match: (p) =>
      /laptop|macbook|chromebook|notebook|gaming/i.test(p.productType || p.category || "") ||
      (/laptop|macbook|chromebook/i.test(p.title) && !/charger|adapter|dock|battery|bag/i.test(p.title)),
  },
  {
    slug: "gaming-laptops",
    title: "Gaming laptops",
    description: "Machines tagged or typed for gaming.",
    match: (p) => /gaming/i.test(p.productType || "") || /gaming/i.test(p.title),
  },
  {
    slug: "macbooks",
    title: "MacBooks",
    description: "Apple MacBook computers.",
    match: (p) => /macbook/i.test(p.title) || brandIs(p, "Apple"),
  },
  {
    slug: "chromebooks",
    title: "Chromebooks",
    description: "Chromebook computers only — chargers belong in accessories.",
    match: (p) => /chromebook/i.test(p.title) && !/charger|adapter/i.test(p.title),
  },
  {
    slug: "tablets",
    title: "Tablets",
    description: "Tablets and smart devices.",
    match: (p) => /tablet|smart device/i.test(p.productType || p.category || "") || /tablet|surface go/i.test(p.title),
  },
  {
    slug: "accessories",
    title: "Accessories",
    description: "Chargers, docks, peripherals and other accessories.",
    match: (p) =>
      /accessor/i.test(p.productType || p.category || "") ||
      /charger|adapter|dock|battery|mouse|keyboard|headset|bag/i.test(p.title),
  },
  {
    slug: "chargers",
    title: "Chargers & adapters",
    description: "Power adapters and chargers.",
    match: (p) => /charger|adapter/i.test(p.title) || (p.tags || []).some((t) => /charger/i.test(t)),
  },
  {
    slug: "workstations",
    title: "Workstations",
    description: "Precision, ZBook and similar workstation lines.",
    match: (p) => /workstation|precision|zbook|thinkpad p/i.test(p.title + " " + (p.productType || "")),
  },
  {
    slug: "dell",
    title: "Dell",
    description: "Dell notebooks and devices.",
    match: (p) => brandIs(p, "Dell"),
  },
  {
    slug: "hp",
    title: "HP",
    description: "HP notebooks and devices.",
    match: (p) => brandIs(p, "HP") || brandIs(p, "Hewlett"),
  },
  {
    slug: "lenovo",
    title: "Lenovo",
    description: "Lenovo notebooks and devices.",
    match: (p) => brandIs(p, "Lenovo"),
  },
  {
    slug: "apple",
    title: "Apple",
    description: "Apple products.",
    match: (p) => brandIs(p, "Apple") || /macbook|ipad/i.test(p.title),
  },
  {
    slug: "microsoft",
    title: "Microsoft",
    description: "Surface and Microsoft devices.",
    match: (p) => brandIs(p, "Microsoft") || /surface/i.test(p.title),
  },
  {
    slug: "under-40k",
    title: "Under Rs 40,000",
    description: "Computers and tablets under Rs 40,000 (accessories excluded).",
    match: (p) =>
      p.pricePaisa < 4_000_000 &&
      !/accessor|charger|adapter/i.test(p.productType || "") &&
      !/charger|adapter/i.test(p.title),
  },
  {
    slug: "40k-60k",
    title: "Rs 40,000 – 60,000",
    description: "Mid-range computers and tablets.",
    match: (p) =>
      p.pricePaisa >= 4_000_000 &&
      p.pricePaisa < 6_000_000 &&
      !/accessor|charger|adapter/i.test(p.productType || "") &&
      !/charger|adapter/i.test(p.title),
  },
  {
    slug: "over-60k",
    title: "Over Rs 60,000",
    description: "Higher-spec computers and tablets.",
    match: (p) =>
      p.pricePaisa >= 6_000_000 &&
      !/accessor|charger|adapter/i.test(p.productType || "") &&
      !/charger|adapter/i.test(p.title),
  },
];

export function getCollectionDef(slug: string) {
  return COLLECTION_DEFS.find((c) => c.slug === slug);
}
