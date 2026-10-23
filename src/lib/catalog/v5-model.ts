import { V5_SUB } from "@/lib/catalog/v5-taxonomy";
import type { PublicProduct } from "@/types/catalog";

/**
 * Server-side adapter from the live catalog to the shape the V5 prototype renders from
 * (`prods()` in `Laptops Hub Storefront v5.dc.html`). Field derivations are ported 1:1 so cards,
 * chips, badges, counts and collection membership match the approved design. Prices stay integer paisa.
 */
export type V5Cat = "laptop" | "accessory" | "gaming" | "chromebook" | "macbook" | "tablet";

export type V5Product = {
  /** Catalog order (V5 `i`): import order = products.created_at. */
  i: number;
  h: string;
  t: string;
  brand: string;
  pricePaisa: number;
  sku: string | null;
  cpu: string | null;
  gen: number | null;
  ramN: number | null;
  stoN: number | null;
  size: number | null;
  cond: string | null;
  touch: boolean;
  cat: V5Cat;
  catLabel: string;
  sub: string | null;
  model: string;
  config: string;
  comp: boolean;
  chips: string[];
  badge: string;
  avail: boolean;
  imgs: { u: string; a: string }[];
  specs: Record<string, string>;
  variantId: string;
  maxPerOrder: number;
  /** Public listing description (V5 `intro`). */
  intro: string;
};

const CAT: Record<string, V5Cat> = {
  laptop: "laptop",
  accessory: "accessory",
  "gaming laptop": "gaming",
  chromebook: "chromebook",
  macbook: "macbook",
  tablet: "tablet",
};

export function ord(n: number) {
  const s = n % 100;
  return n + (s >= 11 && s <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] || "th");
}
export function stoFmt(v: number) {
  return v >= 1000 ? Math.round(v / 1024) + "TB" : v + "GB";
}
export function cpuFmt(v: string) {
  return /^i\d$/.test(v) ? "Core " + v : v;
}
/** V5 `fmt`: whole rupees with en-PK grouping. */
export function fmtPkr(paisa: number) {
  return "Rs " + Number(paisa / 100).toLocaleString("en-PK", { maximumFractionDigits: 2 });
}

const str = (v: unknown) => (v == null || v === "" ? null : String(v));
const num = (v: unknown) => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export function toV5(p: PublicProduct, i: number): V5Product {
  const s = p.specs || {};
  const cat = CAT[(p.category || "").toLowerCase()] || "laptop";
  const catLabel = p.category || "Laptop";
  const sub = V5_SUB[p.handle] ?? null;
  const ramN = parseInt(String(s.ram ?? "")) || null;
  const stoN = parseInt(String(s.storage ?? s.sto ?? "")) || null;
  const cpu = str(s.cpu);
  const gen = num(s.gen);
  const size = num(s.size);
  const parts = p.title.split(/ [-—] /);
  const comp = cat !== "accessory";
  const chips = comp
    ? [
        cpu ? cpuFmt(cpu) + (gen ? " · " + ord(gen) : "") : null,
        ramN ? ramN + "GB RAM" : null,
        stoN ? stoFmt(stoN) : null,
        size ? size + '"' : null,
      ].filter((x): x is string => !!x)
    : [sub || catLabel];
  const specs: Record<string, string> = {};
  for (const [k, v] of Object.entries(s)) if (/^[A-Z]/.test(k) && v != null && v !== "") specs[k] = String(v);
  return {
    i,
    h: p.handle,
    t: p.title,
    brand: p.manufacturer || "",
    pricePaisa: p.pricePaisa,
    sku: p.sku,
    cpu,
    gen,
    ramN,
    stoN,
    size,
    cond: str(s.condition ?? s.Condition),
    touch: !!s.touch,
    cat,
    catLabel,
    sub,
    model: str(s.model) || parts[0],
    config: s.config != null ? String(s.config) : parts.slice(1).join(" - "),
    comp,
    chips,
    badge: (sub && cat !== "accessory" ? sub : catLabel) || "Laptop",
    avail: p.available && p.pricePaisa > 0,
    imgs: p.images.map((m) => ({ u: m.url, a: m.alt })),
    specs,
    variantId: p.variantId,
    maxPerOrder: p.maxPerOrder,
    intro: p.descriptionSafe || "",
  };
}

/** V5 `cols()`: collection id → title + membership rule. */
export const V5_COLS: Record<string, { t: string; f: (p: V5Product) => boolean; hidden?: boolean }> = {
  all: { t: "All products", f: () => true },
  "in-stock": { t: "All products", f: () => true, hidden: true },
  available: { t: "All products", f: () => true, hidden: true },
  laptops: { t: "All laptops", f: (p) => p.comp && p.cat !== "tablet" },
  "gaming-laptops": { t: "Gaming laptops", f: (p) => p.cat === "gaming" },
  macbooks: { t: "MacBooks", f: (p) => p.cat === "macbook" },
  tablets: { t: "Tablets & smart devices", f: (p) => p.cat === "tablet" },
  accessories: { t: "Accessories", f: (p) => p.cat === "accessory" },
  chargers: { t: "Chargers & adapters", f: (p) => p.sub === "Charger" },
  workstations: { t: "Mobile workstations", f: (p) => p.sub === "Workstation" },
  "2-in-1": { t: "2-in-1 laptops", f: (p) => p.sub === "2-in-1" },
  apple: { t: "Apple", f: (p) => p.brand === "Apple" },
  microsoft: { t: "Microsoft", f: (p) => p.brand === "Microsoft" },
  asus: { t: "ASUS", f: (p) => p.brand === "ASUS" },
  acer: { t: "Acer", f: (p) => p.brand === "Acer" },
  toshiba: { t: "Toshiba", f: (p) => p.brand === "Toshiba" },
  business: { t: "Business lines", f: (p) => p.comp && /Latitude|EliteBook|ProBook|ThinkPad|ZBook|Precision/i.test(p.t) },
  "gen-6-7": { t: "6th & 7th gen", f: (p) => p.gen === 6 || p.gen === 7 },
  "gen-8": { t: "8th gen", f: (p) => p.gen === 8 },
  "sto-128": { t: "128GB storage", f: (p) => p.stoN === 128 },
  "sto-256": { t: "256GB storage", f: (p) => p.stoN === 256 },
  "sto-512-plus": { t: "512GB+ storage", f: (p) => (p.stoN ?? 0) >= 512 },
  "core-i9": { t: "Core i9", f: (p) => p.cpu === "i9" },
  dell: { t: "Dell", f: (p) => p.brand === "Dell" },
  hp: { t: "HP", f: (p) => p.brand === "HP" },
  lenovo: { t: "Lenovo", f: (p) => p.brand === "Lenovo" },
  "core-i3": { t: "Core i3", f: (p) => p.cpu === "i3" },
  "core-i5": { t: "Core i5", f: (p) => p.cpu === "i5" },
  "core-i7": { t: "Core i7", f: (p) => p.cpu === "i7" },
  "gen-10-plus": { t: "10th gen and newer", f: (p) => (p.gen ?? 0) >= 10 },
  "ram-4gb": { t: "4GB RAM", f: (p) => p.ramN === 4 },
  "ram-8gb": { t: "8GB RAM", f: (p) => p.ramN === 8 },
  "ram-16gb": { t: "16GB RAM", f: (p) => p.ramN === 16 },
  "screen-13": { t: '13.3" screens', f: (p) => Math.floor(p.size ?? 0) === 13 },
  "screen-14": { t: '14" screens', f: (p) => Math.floor(p.size ?? 0) === 14 },
  "screen-15": { t: '15.6" screens', f: (p) => Math.floor(p.size ?? 0) === 15 },
  "under-40k": { t: "Laptops under Rs 40,000", f: (p) => p.comp && p.pricePaisa < 4_000_000 },
  "40k-60k": { t: "Laptops Rs 40,000 – 60,000", f: (p) => p.comp && p.pricePaisa >= 4_000_000 && p.pricePaisa <= 6_000_000 },
  "over-60k": { t: "Laptops over Rs 60,000", f: (p) => p.comp && p.pricePaisa > 6_000_000 },
  touchscreen: { t: "Touchscreen", f: (p) => p.touch },
  chromebooks: { t: "Chromebooks", f: (p) => p.cat === "chromebook" },
};

export type V5Link = { label: string; href: string; count: number | string };

export function v5Link(P: V5Product[], id: string): V5Link {
  const c = V5_COLS[id];
  return { label: c.t, href: "/collections/" + id, count: P.filter(c.f).length };
}

export type V5MenuGroup = { title: string; items: V5Link[] };

/** V5 `menu()` without the Help group's live compare count (rendered client-side). */
export function v5Menu(P: V5Product[]): V5MenuGroup[] {
  const L = (ids: string[]) => ids.map((id) => v5Link(P, id));
  return [
    { title: "Category", items: L(["laptops", "gaming-laptops", "macbooks", "chromebooks", "tablets", "accessories", "all"]) },
    { title: "Brand", items: L(["dell", "hp", "lenovo", "microsoft", "apple"]) },
    { title: "Processor", items: L(["core-i3", "core-i5", "core-i7", "core-i9", "gen-6-7", "gen-8", "gen-10-plus"]) },
    { title: "Memory", items: L(["ram-4gb", "ram-8gb", "ram-16gb"]) },
    { title: "Storage", items: L(["sto-128", "sto-256", "sto-512-plus"]) },
    { title: "Screen", items: L(["screen-13", "screen-14", "screen-15", "touchscreen"]) },
    { title: "Budget", items: L(["under-40k", "40k-60k", "over-60k"]) },
    { title: "Shop by use", items: L(["business", "workstations", "2-in-1", "chargers"]) },
    {
      title: "Help",
      items: [
        { label: "Buying guides", href: "/guides", count: "" },
        { label: "Compare laptops", href: "/compare", count: "__compare__" },
        { label: "FAQ", href: "/pages/faq", count: "" },
        { label: "Contact us", href: "/pages/contact", count: "" },
      ],
    },
  ];
}

/** Card props (V5 `card()`), serialisable for client components. */
export type V5Card = {
  h: string;
  title: string;
  href: string;
  model: string;
  config: string;
  brand: string;
  cond: string;
  sku: string | null;
  img: string | null;
  img2: string | null;
  alt: string;
  chips: string[];
  priceText: string;
  pricePaisa: number;
  avail: boolean;
  badge: string;
  variantId: string;
  maxPerOrder: number;
};

export function v5Card(p: V5Product): V5Card {
  return {
    h: p.h,
    title: p.t,
    href: "/products/" + encodeURIComponent(p.h),
    model: p.model,
    config: p.config,
    brand: p.brand,
    cond: p.cond || "Condition not listed",
    sku: p.sku,
    img: p.imgs[0]?.u ?? null,
    img2: p.imgs[1]?.u ?? null,
    alt: p.model + (p.config ? ", " + p.config : "") + " (photo 1 of " + p.imgs.length + ")",
    chips: p.chips,
    priceText: fmtPkr(p.pricePaisa),
    pricePaisa: p.pricePaisa,
    avail: p.avail,
    badge: p.badge,
    variantId: p.variantId,
    maxPerOrder: p.maxPerOrder,
  };
}

/** V5 search text (`prods()` `text`), lower-cased. */
export function v5Text(p: V5Product) {
  return (
    p.t +
    " " +
    p.brand +
    " " +
    (p.catLabel || "") +
    " " +
    (p.sub || "") +
    " " +
    Object.values(p.specs).join(" ") +
    (p.touch ? " touch touchscreen" : "") +
    (p.cat === "macbook" ? " macbook apple" : "") +
    (p.cat === "chromebook" ? " chromebook chromeos" : "")
  ).toLowerCase();
}

/** V5 `searchList`: every whitespace token must appear in the product text; catalog order. */
export function v5Search(P: V5Product[], q: string) {
  const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  return P.filter((p) => {
    const text = v5Text(p);
    return toks.every((t) => text.includes(t));
  });
}

export type V5SearchHit = { href: string; img: string | null; model: string; config: string; priceText: string; stock: string };

export function v5SearchHit(p: V5Product): V5SearchHit {
  return {
    href: "/products/" + encodeURIComponent(p.h),
    img: p.imgs[0]?.u ?? null,
    model: p.model,
    config: p.config,
    priceText: fmtPkr(p.pricePaisa),
    stock: p.badge,
  };
}

/** V5 PDP spec sheet order and labels (`order` in the product branch), over public spec keys. */
const SPEC_ORDER: [string, string][] = [
  ["Processor", "Processor"],
  ["Memory", "Memory"],
  ["Storage", "Storage"],
  ["Graphics", "Graphics"],
  ["Display", "Display"],
  ["Resolution / panel", "Resolution"],
  ["Touch", "Touch"],
  ["Operating system", "Operating system"],
  ["Condition", "Condition"],
];

export function v5SpecRows(p: V5Product) {
  return SPEC_ORDER.filter(([k]) => p.specs[k])
    .map(([k, label]) => ({ k: label, v: p.specs[k] }))
    .concat(p.sku ? [{ k: "SKU", v: p.sku }] : []);
}

/** V5 PDP key spec tiles. */
export function v5KeySpecs(p: V5Product) {
  const os = p.specs["Operating system"];
  const res = p.specs["Resolution / panel"];
  return [
    p.cpu ? { k: "Processor", v: cpuFmt(p.cpu) + (p.gen ? ", " + ord(p.gen) + " gen" : "") } : null,
    p.ramN ? { k: "Memory", v: p.ramN + "GB" } : null,
    p.stoN ? { k: "Storage", v: stoFmt(p.stoN) } : null,
    p.size || res ? { k: "Screen", v: [p.size ? p.size + '"' : null, res].filter(Boolean).join(" · ") + (p.touch ? " · Touch" : "") } : null,
    p.specs.Graphics ? { k: "Graphics", v: p.specs.Graphics } : null,
    os ? { k: "Operating system", v: os } : null,
  ].filter((x): x is { k: string; v: string } => !!x);
}

/** V5 related products: same category, same brand first, then nearest price. */
export function v5Related(P: V5Product[], p: V5Product) {
  return P.filter((x) => x.cat === p.cat && x.h !== p.h)
    .sort((a, b) => Number(b.brand === p.brand) - Number(a.brand === p.brand) || Math.abs(a.pricePaisa - p.pricePaisa) - Math.abs(b.pricePaisa - p.pricePaisa))
    .slice(0, 4);
}

/** V5 compare column (`cmpHeads`) plus the row values the compare table needs. */
export type V5CompareCol = {
  h: string;
  href: string;
  img: string | null;
  model: string;
  title: string;
  avail: boolean;
  variantId: string;
  pricePaisa: number;
  maxPerOrder: number;
  config: string;
  sku: string | null;
  values: Record<string, string | null>;
};

/** Row labels in V5 order (`rows` in the compare branch). */
export const V5_COMPARE_ROWS = ["Price", "Category", "Brand", "Processor", "Generation", "Memory", "Storage", "Graphics", "Display", "Resolution", "Touchscreen", "Operating system", "Condition"];

export function v5CompareCol(p: V5Product): V5CompareCol {
  const sp = p.specs;
  return {
    h: p.h,
    href: "/products/" + encodeURIComponent(p.h),
    img: p.imgs[0]?.u ?? null,
    model: p.model,
    title: p.t,
    avail: p.avail,
    variantId: p.variantId,
    pricePaisa: p.pricePaisa,
    maxPerOrder: p.maxPerOrder,
    config: p.config,
    sku: p.sku,
    values: {
      Price: fmtPkr(p.pricePaisa),
      Category: p.badge,
      Brand: p.brand,
      Processor: sp.Processor || null,
      Generation: p.gen ? ord(p.gen) + " gen" : null,
      Memory: p.ramN ? p.ramN + "GB" : null,
      Storage: p.stoN ? stoFmt(p.stoN) : null,
      Graphics: sp.Graphics || null,
      Display: sp.Display || null,
      Resolution: sp["Resolution / panel"] || null,
      Touchscreen: p.touch ? "Yes" : "Not listed",
      "Operating system": sp["Operating system"] || null,
      Condition: p.cond,
    },
  };
}
