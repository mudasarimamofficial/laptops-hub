import type { PublicProduct } from "@/types/catalog";

export type RuleCondition = {
  field: string;
  op: "eq" | "neq" | "contains" | "gte" | "lte" | "gt" | "lt" | "in" | "exists";
  value?: unknown;
};

export type CollectionRule = {
  match?: "all" | "any";
  conditions?: RuleCondition[];
};

function readField(p: PublicProduct, field: string): unknown {
  switch (field) {
    case "manufacturer":
    case "vendor":
      return p.manufacturer;
    case "title":
      return p.title;
    case "handle":
      return p.handle;
    case "type":
    case "product_type":
      return p.productType;
    case "category":
      return p.category;
    case "tags":
      return p.tags;
    case "price":
    case "price_paisa":
      return p.pricePaisa;
    case "price_pkr":
      return p.pricePaisa / 100;
    case "featured":
      return p.featured;
    case "available":
      return p.available;
    default: {
      if (field.startsWith("specs.")) {
        const key = field.slice("specs.".length);
        const specs = p.specs || {};
        // try exact, then case-insensitive / common aliases
        if (key in specs) return specs[key];
        const lower = key.toLowerCase();
        for (const [k, v] of Object.entries(specs)) {
          if (k.toLowerCase() === lower) return v;
          if (k.toLowerCase().replace(/\s+/g, "_") === lower) return v;
        }
        // ram_gb convenience: parse from specs.RAM or Memory
        if (lower === "ram_gb") {
          const ram = specs.RAM ?? specs.Memory ?? specs.ram ?? specs["RAM (GB)"];
          if (typeof ram === "number") return ram;
          if (typeof ram === "string") {
            const m = ram.match(/(\d+)\s*GB/i);
            if (m) return Number(m[1]);
            const n = Number(ram);
            if (!Number.isNaN(n)) return n;
          }
        }
        return undefined;
      }
      return undefined;
    }
  }
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function asString(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

export function evalCondition(p: PublicProduct, c: RuleCondition): boolean {
  const left = readField(p, c.field);
  const op = c.op;
  const right = c.value;

  switch (op) {
    case "exists":
      return left !== undefined && left !== null && left !== "";
    case "eq":
      if (Array.isArray(left)) return left.map(asString).map((s) => s.toLowerCase()).includes(asString(right).toLowerCase());
      return asString(left).toLowerCase() === asString(right).toLowerCase();
    case "neq":
      return asString(left).toLowerCase() !== asString(right).toLowerCase();
    case "contains":
      if (Array.isArray(left)) {
        return left.some((t) => asString(t).toLowerCase().includes(asString(right).toLowerCase()));
      }
      return asString(left).toLowerCase().includes(asString(right).toLowerCase());
    case "in": {
      const list = Array.isArray(right) ? right.map(asString) : asString(right).split(",").map((s) => s.trim());
      return list.map((s) => s.toLowerCase()).includes(asString(left).toLowerCase());
    }
    case "gte":
    case "lte":
    case "gt":
    case "lt": {
      const ln = asNumber(left);
      const rn = asNumber(right);
      if (ln == null || rn == null) return false;
      if (op === "gte") return ln >= rn;
      if (op === "lte") return ln <= rn;
      if (op === "gt") return ln > rn;
      return ln < rn;
    }
    default:
      return false;
  }
}

export function productMatchesRule(p: PublicProduct, rule: CollectionRule | null | undefined): boolean {
  if (!rule || !Array.isArray(rule.conditions) || rule.conditions.length === 0) return false;
  const mode = rule.match === "any" ? "any" : "all";
  if (mode === "any") return rule.conditions.some((c) => evalCondition(p, c));
  return rule.conditions.every((c) => evalCondition(p, c));
}

export function isAutomatedRule(rule: unknown): rule is CollectionRule {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) return false;
  const r = rule as CollectionRule;
  return Array.isArray(r.conditions) && r.conditions.length > 0;
}
