import { cpuFmt, fmtPkr, ord, stoFmt, v5Card, type V5Card, type V5Product } from "@/lib/catalog/v5-model";

/**
 * V5 collection engine (`dims`, `bands`, `match`, `sorted` and the `isCollection` branch of `renderVals`),
 * evaluated on the server from URL parameters so filtered views are linkable and the full catalog is not
 * shipped to the browser.
 */
type DimKey = "cat" | "brand" | "cpu" | "gen" | "ram" | "sto" | "size";
const DIMS: { k: DimKey; label: string; get: (p: V5Product) => string | number | null; fmt: (v: string) => string; num?: boolean }[] = [
  { k: "cat", label: "Category", get: (p) => p.catLabel, fmt: (v) => v },
  { k: "brand", label: "Brand", get: (p) => p.brand, fmt: (v) => v },
  { k: "cpu", label: "Processor", get: (p) => p.cpu, fmt: (v) => cpuFmt(v) },
  { k: "gen", label: "Generation", get: (p) => p.gen, fmt: (v) => ord(+v) + " gen", num: true },
  { k: "ram", label: "Memory", get: (p) => p.ramN, fmt: (v) => v + "GB", num: true },
  { k: "sto", label: "Storage", get: (p) => p.stoN, fmt: (v) => stoFmt(+v), num: true },
  { k: "size", label: "Screen", get: (p) => p.size, fmt: (v) => v + '"', num: true },
];
const BANDS = [
  { id: "u40", label: "Under Rs 40,000", f: (p: V5Product) => p.pricePaisa < 4_000_000 },
  { id: "m", label: "Rs 40,000 – 60,000", f: (p: V5Product) => p.pricePaisa >= 4_000_000 && p.pricePaisa <= 6_000_000 },
  { id: "o60", label: "Over Rs 60,000", f: (p: V5Product) => p.pricePaisa > 6_000_000 },
];
export const SORT_OPTS = [
  { v: "featured", label: "Featured" },
  { v: "price-asc", label: "Price, low to high" },
  { v: "price-desc", label: "Price, high to low" },
  { v: "gen", label: "Newest generation" },
  { v: "ram", label: "Most memory" },
];
const PAGE = 12;

export type Filters = Record<DimKey, string[]> & { price: string; touch: boolean };
export type RawParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

export function parseFilters(sp: RawParams): { f: Filters; sort: string; page: number } {
  const list = (k: string) =>
    one(sp[k])
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  const f = Object.fromEntries(DIMS.map((d) => [d.k, list(d.k)])) as Record<DimKey, string[]>;
  const price = BANDS.some((b) => b.id === one(sp.price)) ? one(sp.price) : "";
  const sort = SORT_OPTS.some((o) => o.v === one(sp.sort)) ? one(sp.sort) : "featured";
  const page = Math.min(50, Math.max(1, parseInt(one(sp.page)) || 1));
  return { f: { ...f, price, touch: one(sp.touch) === "1" }, sort, page };
}

/** Query string for a filter state (empty values omitted, stable key order). */
export function toQuery(f: Filters, sort: string, page = 1, extra: Record<string, string> = {}) {
  const q = new URLSearchParams(extra);
  for (const d of DIMS) if (f[d.k].length) q.set(d.k, f[d.k].join(","));
  if (f.price) q.set("price", f.price);
  if (f.touch) q.set("touch", "1");
  if (sort !== "featured") q.set("sort", sort);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? "?" + s : "";
}

function match(p: V5Product, f: Filters, ex?: string) {
  for (const d of DIMS) if (ex !== d.k && f[d.k].length && !f[d.k].includes(String(d.get(p)))) return false;
  if (ex !== "price" && f.price) {
    const b = BANDS.find((x) => x.id === f.price);
    if (b && !b.f(p)) return false;
  }
  if (ex !== "touch" && f.touch && !p.touch) return false;
  return true;
}

function sorted(list: V5Product[], sort: string) {
  const by: Record<string, (x: V5Product, y: V5Product) => number> = {
    featured: (x, y) => x.i - y.i,
    "price-asc": (x, y) => x.pricePaisa - y.pricePaisa,
    "price-desc": (x, y) => y.pricePaisa - x.pricePaisa,
    gen: (x, y) => (y.gen || 0) - (x.gen || 0) || x.pricePaisa - y.pricePaisa,
    ram: (x, y) => (y.ramN || 0) - (x.ramN || 0) || x.pricePaisa - y.pricePaisa,
  };
  return list.slice().sort(by[sort] || by.featured);
}

export type FacetOpt = { label: string; count: number; checked: boolean; op: number; href: string };
export type CollectionView = {
  resultText: string;
  resultCount: number;
  shownCount: number;
  shownPct: string;
  hasMore: boolean;
  moreHref: string;
  cards: V5Card[];
  facets: { label: string; opts: FacetOpt[] }[];
  priceOpts: FacetOpt[];
  touchOpt: { checked: boolean; count: number; href: string };
  chips: { label: string; href: string }[];
  clearHref: string;
  sort: string;
  sortHrefs: Record<string, string>;
  noResults: boolean;
  cbPending: boolean;
};

export function buildCollectionView(base: V5Product[], sp: RawParams, opts: { isChromebooks?: boolean; extra?: Record<string, string> } = {}): CollectionView {
  const { f, sort, page } = parseFilters(sp);
  const extra = opts.extra || {};
  const href = (nf: Filters, s = sort) => toQuery(nf, s, 1, extra) || "?";
  const list = sorted(base.filter((p) => match(p, f)), sort);
  const shown = list.slice(0, page * PAGE);

  const facets = DIMS.map((d) => {
    const vals = [...new Set(base.map(d.get).filter((x): x is string | number => x != null))].sort((a, b) =>
      d.num ? Number(a) - Number(b) : String(a).localeCompare(String(b)),
    );
    const pool = base.filter((p) => match(p, f, d.k));
    return {
      label: d.label,
      n: vals.length,
      opts: vals.map((val) => {
        const sv = String(val);
        const count = pool.filter((p) => String(d.get(p)) === sv).length;
        const checked = f[d.k].includes(sv);
        const next = { ...f, [d.k]: checked ? f[d.k].filter((x) => x !== sv) : [...f[d.k], sv] };
        return { label: d.fmt(sv), count, checked, op: count || checked ? 1 : 0.4, href: href(next) };
      }),
    };
  })
    .filter((fc) => fc.n > 1)
    .map(({ label, opts: o }) => ({ label, opts: o }));

  const pricePool = base.filter((p) => match(p, f, "price"));
  const chips: { label: string; href: string }[] = [];
  for (const d of DIMS) for (const sv of f[d.k]) chips.push({ label: d.fmt(sv), href: href({ ...f, [d.k]: f[d.k].filter((x) => x !== sv) }) });
  if (f.price) chips.push({ label: BANDS.find((b) => b.id === f.price)!.label, href: href({ ...f, price: "" }) });
  if (f.touch) chips.push({ label: "Touchscreen", href: href({ ...f, touch: false }) });

  const cbPending = !!opts.isChromebooks && !base.length;
  const empty: Filters = { cat: [], brand: [], cpu: [], gen: [], ram: [], sto: [], size: [], price: "", touch: false };
  return {
    resultText: cbPending ? "No Chromebooks listed" : list.length + (list.length === 1 ? " product" : " products") + (list.length !== base.length ? " of " + base.length : ""),
    resultCount: list.length,
    shownCount: shown.length,
    shownPct: Math.round((shown.length / Math.max(1, list.length)) * 100) + "%",
    hasMore: shown.length < list.length,
    moreHref: toQuery(f, sort, page + 1, extra),
    cards: shown.map(v5Card),
    facets,
    priceOpts: BANDS.map((b) => {
      const count = pricePool.filter(b.f).length;
      const checked = f.price === b.id;
      return { label: b.label, count, checked, op: count || checked ? 1 : 0.4, href: href({ ...f, price: checked ? "" : b.id }) };
    }),
    touchOpt: { checked: f.touch, count: base.filter((p) => p.touch && match(p, f, "touch")).length, href: href({ ...f, touch: !f.touch }) },
    chips,
    clearHref: toQuery(empty, sort, 1, extra) || "?",
    sort,
    sortHrefs: Object.fromEntries(SORT_OPTS.map((o) => [o.v, toQuery(f, o.v, 1, extra) || "?"])),
    noResults: list.length === 0 && !cbPending,
    cbPending,
  };
}

export { fmtPkr };
