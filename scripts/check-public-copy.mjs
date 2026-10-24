/**
 * Public copy gate (Bible ch. 03): crawl the running site and fail on unfinished customer-facing copy or broken links.
 * Read-only — safe against any environment, including Production.
 *
 *   node scripts/check-public-copy.mjs <baseUrl> [--strict-policies]
 *
 * Checks every page reachable from the homepage, the sitemap, the header/footer, and every /pages/* and /guides/*
 * route: each must answer 200 with no banned phrase, or a clean 404 (unpublished). Every internal link found must not
 * answer 4xx/5xx except links to unpublished content, which must not exist. --strict-policies also requires the five
 * policy pages to be public (launch gate G2).
 */
const base = (process.argv[2] || "http://127.0.0.1:3001").replace(/\/+$/, "");
const strictPolicies = process.argv.includes("--strict-policies");
const BANNED = [
  /being finali[sz]ed/i,
  /pending business approval/i,
  /to be confirmed/i,
  /\bTBD\b/,
  /\bTODO\b/,
  /lorem ipsum/i,
  /we haven[’']t published/i,
  /will be published here/i,
  />\s*SOON\s*</,
  /coming soon/i,
];
const PAGES = ["about", "why-laptops-hub", "contact", "faq", "shipping", "returns", "warranty", "condition-guide", "how-to-choose", "comparison-guide", "order-inquiries", "privacy", "terms"];
const ARTICLES = ["processor-generations-explained", "how-much-ram", "choosing-storage", "business-laptop-lines"];
const POLICIES = ["shipping", "returns", "warranty", "privacy", "terms"];

const failures = [];
const seen = new Map(); // path → status
const queue = ["/", "/collections/all", "/compare", "/search", "/track-order", "/cart", ...PAGES.map((p) => `/pages/${p}`), "/guides", ...ARTICLES.map((a) => `/guides/${a}`)];

async function sitemapPaths() {
  const xml = await (await fetch(`${base}/sitemap.xml`)).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
}

/** Visible text approximation: drop scripts/styles, tags and entities. Scripts are checked separately for leaks. */
const visible = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&");

async function visit(p) {
  if (seen.has(p)) return;
  seen.set(p, 0);
  const res = await fetch(base + p, { redirect: "manual" });
  seen.set(p, res.status);
  if (res.status >= 300 && res.status < 400) return;
  const html = await res.text();
  const isContent = /^\/(pages|guides)(\/|$)/.test(p);
  if (res.status === 404 && isContent) return; // unpublished: clean 404 is correct
  if (res.status !== 200) return failures.push(`${p}: HTTP ${res.status}`);
  for (const re of BANNED) {
    if (re.test(visible(html))) failures.push(`${p}: visible text matches ${re}`);
    // Server payloads must not carry unfinished template text for public pages either.
    else if (re.test(html) && !/^\/(admin)/.test(p)) failures.push(`${p}: page payload contains ${re}`);
  }
  for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
    const link = m[1];
    if (/^\/(_next|api|admin|order\/)/.test(link) || /\.(png|jpg|svg|ico|xml|txt|webmanifest)$/.test(link)) continue;
    if (!seen.has(link) && (/^\/(pages|guides|collections|products)\//.test(link) || link === "/guides" || queue.length < 400)) queue.push(link);
    linkFrom.push([p, link]);
  }
}
const linkFrom = [];

queue.push(...(await sitemapPaths().catch(() => [])));
while (queue.length) {
  const batch = queue.splice(0, 8).filter((p) => !seen.has(p));
  await Promise.all(batch.map(visit));
  if (seen.size > 600) break;
}
// Links must work: no link may point at an unpublished (404) content page or any broken route.
const reported = new Set();
for (const [from, to] of linkFrom) {
  const st = seen.get(to);
  if (st && st >= 400 && !reported.has(to)) {
    reported.add(to);
    failures.push(`${from} links to ${to} → HTTP ${st}`);
  }
}
if (strictPolicies) for (const s of POLICIES) if (seen.get(`/pages/${s}`) !== 200) failures.push(`policy /pages/${s} is not public (launch gate)`);

const publicContent = [...seen].filter(([p, s]) => /^\/(pages|guides)/.test(p) && s === 200).map(([p]) => p);
console.log(`crawled ${seen.size} paths · public content: ${publicContent.join(", ") || "none"}`);
for (const f of failures.slice(0, 40)) console.log("FAIL ", f);
console.log(failures.length ? `${failures.length} problem(s)` : "no unfinished copy, no broken links");
process.exit(failures.length ? 1 : 0);
