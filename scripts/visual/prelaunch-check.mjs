/**
 * Site-mode checks (read-only HTTP): indexing headers/meta, canonical, robots, sitemap, admin auth, CMS gating,
 * disabled checkout and — in restricted mode — that no catalog page, API or remote image is served.
 *
 *   node scripts/visual/prelaunch-check.mjs <baseUrl> <launch|prelaunch|restricted> [--host=laptops-hub.vercel.app] [--share=<url>]
 */
const [base0, mode] = process.argv.slice(2);
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=") || d;
const base = base0.replace(/\/$/, "");
const host = arg("host", "laptops-hub.vercel.app");
const share = arg("share", "");
if (!["launch", "prelaunch", "restricted"].includes(mode)) throw new Error("mode must be launch|prelaunch|restricted");

let cookie = "";
if (share) {
  const r = await fetch(share, { redirect: "manual" });
  cookie = (r.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
}
const results = [];
const ok = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};
const get = async (p, init = {}) => {
  const r = await fetch(base + p, { redirect: "manual", ...init, headers: { ...(cookie ? { cookie } : {}), ...(init.headers || {}) } });
  const body = await r.text();
  return { status: r.status, xrt: r.headers.get("x-robots-tag") || "", loc: r.headers.get("location") || "", body };
};
const metaRobots = (html) => (html.match(/<meta name="robots" content="([^"]+)"/) || [])[1] || "";
const canonical = (html) => (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || "";

const STORY = "dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage";
// Previously discoverable (in the live sitemap) and newer URLs.
const PAGES = ["/", `/products/${STORY}`, "/collections/laptops", "/collections/all", "/collections/chromebooks", "/compare", "/pages/faq", "/pages/contact", "/pages/shipping", "/guides", "/guides/how-much-ram"];

for (const p of PAGES) {
  const r = await get(p);
  const meta = metaRobots(r.body);
  if (mode === "launch") {
    ok(`${p} 200, indexable`, r.status === 200 && !/noindex/.test(r.xrt), `status=${r.status} x-robots-tag='${r.xrt}' meta='${meta}'`);
  } else {
    ok(`${p} 200 + X-Robots-Tag noindex`, r.status === 200 && r.xrt.split(",").map((s) => s.trim()).includes("noindex"), `status=${r.status} x-robots-tag='${r.xrt}'`);
    ok(`${p} meta noindex,follow (no contradiction)`, /noindex/.test(meta) && !/(^|,\s*)index/.test(meta.replace("noindex", "")) && !canonical(r.body), `meta='${meta}' canonical='${canonical(r.body)}'`);
  }
  if (mode === "restricted") {
    ok(`${p} → coming soon, no catalog data`, /Our online store is on its way/.test(r.body) && !/cdn\.shopify\.com|Latitude|price_paisa|Add to cart/i.test(r.body), "");
  }
}

// Home: launch has no notice; prelaunch has the notice and the storefront; restricted has neither storefront.
{
  const r = await get("/");
  const notice = /Pre-launch notice/.test(r.body);
  if (mode === "launch") ok("home: no pre-launch notice", !notice);
  if (mode === "prelaunch") ok("home: notice + storefront visible", notice && /Laptops HUB/.test(r.body) && /cdn\.shopify\.com/.test(r.body));
  if (mode === "restricted") ok("home: no storefront header/footer", !/Primary/.test(r.body) && !/Pre-launch notice/.test(r.body));
}

// Product page canonical / content.
{
  const r = await get(`/products/${STORY}`);
  if (mode === "launch") ok("product canonical on production host", canonical(r.body) === `https://${host}/products/${STORY}`, canonical(r.body));
  if (mode === "prelaunch") ok("product page renders (title, price, photo)", /Latitude 7420/.test(r.body) && /Rs/.test(r.body) && /cdn\.shopify\.com/.test(r.body));
}

// Gated CMS page stays gated (never published by a mode change).
if (mode !== "restricted") {
  const r = await get("/pages/shipping");
  ok("unpublished policy stays gated", /BEING FINALISED/.test(r.body) && /noindex/.test(metaRobots(r.body)), metaRobots(r.body));
}

// robots.txt
{
  const r = await get("/robots.txt");
  const t = r.body;
  const disallowAll = /^Disallow:\s*\/\s*$/m.test(t);
  ok("robots.txt keeps private routes disallowed", /Disallow: \/admin\//.test(t) && /Disallow: \/api\//.test(t) && /Disallow: \/checkout/.test(t));
  if (mode === "launch") ok("robots.txt advertises production sitemap", t.includes(`Sitemap: https://${host}/sitemap.xml`) && !disallowAll, t.replace(/\n/g, " | "));
  else ok("robots.txt: public pages crawlable, no sitemap, no Disallow: /", /Allow: \/\s*$/m.test(t) && !/Sitemap:/i.test(t) && !disallowAll, t.replace(/\n/g, " | "));
}

// sitemap.xml
{
  const r = await get("/sitemap.xml");
  const locs = r.body.match(/<loc>[^<]+<\/loc>/g) || [];
  if (mode === "launch") {
    const hosts = [...new Set(locs.map((l) => new URL(l.slice(5, -6)).host))];
    ok("sitemap: production host only, catalog listed, no content pages", r.status === 200 && locs.length > 200 && hosts.length === 1 && hosts[0] === host && !locs.some((l) => /\/pages\/|\/guides/.test(l)), `urls=${locs.length} hosts=${hosts}`);
  } else ok("sitemap: valid and empty", r.status === 200 && locs.length === 0 && /<urlset/.test(r.body), `status=${r.status} urls=${locs.length}`);
}

// Admin auth still enforced; login reachable.
{
  const a = await get("/admin");
  ok("/admin redirects to sign-in", a.status >= 300 && a.status < 400 && /\/admin\/login/.test(a.loc), `${a.status} ${a.loc}`);
  const l = await get("/admin/login");
  ok("/admin/login reachable", l.status === 200);
  const api = await get("/api/admin/cod-collections", { method: "POST", headers: { "content-type": "application/json", origin: base }, body: "{}" });
  ok("admin API requires a session", api.status === 401, `status=${api.status}`);
}

// Checkout disabled; public APIs.
{
  const c = await get("/api/checkout/cod", { method: "POST", headers: { "content-type": "application/json", origin: base }, body: "{}" });
  if (mode === "restricted") ok("checkout API blocked (503)", c.status === 503, `status=${c.status}`);
  else ok("checkout disabled (403)", c.status === 403 && /checkout_disabled/.test(c.body), `status=${c.status}`);
  const s = await get("/api/catalog/search?q=dell");
  if (mode === "restricted") ok("catalog API blocked (503)", s.status === 503 && !/cdn\.shopify/.test(s.body), `status=${s.status}`);
  else ok("catalog API serves", s.status === 200, `status=${s.status}`);
}

// Image optimiser.
{
  const remote = encodeURIComponent("https://cdn.shopify.com/s/files/1/0981/4720/5393/files/01-main_75861162.jpg");
  const r = await get(`/_next/image?url=${remote}&w=640&q=75`);
  if (mode === "restricted") ok("remote catalog photo not served by the app", r.status === 404, `status=${r.status}`);
  const l = await get(`/_next/image?url=${encodeURIComponent("/v5/stage.webp")}&w=640&q=75`);
  ok("local image served", l.status === 200, `status=${l.status}`);
}

// coming-soon route only exists in restricted mode.
if (mode !== "restricted") {
  const r = await get("/coming-soon");
  ok("/coming-soon not available outside restricted mode", r.status === 404, `status=${r.status}`);
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${mode}: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
