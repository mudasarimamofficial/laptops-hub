import { chromium, devices } from "playwright";
import fs from "node:fs";

const css = ".v5-hero-ghost{display:none!important}";
const targets = [
  ["prod-home", "http://127.0.0.1:3000/"],
  ["hero-only-HPV", "http://127.0.0.1:3000/diag/lcp-lab-home?only=v5_cinematic_hero"],
  ["hero+story", "http://127.0.0.1:3000/diag/lcp-lab-home?only=v5_cinematic_hero,v5_product_story"],
  ["hero+featured", "http://127.0.0.1:3000/diag/lcp-lab-home?only=v5_cinematic_hero,v5_featured_products"],
  ["all-published", "http://127.0.0.1:3000/diag/lcp-lab-home"],
  ["hero-in-chrome", "http://127.0.0.1:3000/diag/lcp-lab-hero-in-chrome"],
];

async function once(url, hide, run) {
  const b = await chromium.launch({ headless: true, channel: "chrome" });
  const c = await b.newContext({ ...devices["Pixel 7"] });
  const p = await c.newPage();
  await p.addInitScript((cssText) => {
    window.__l = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const el = e.element;
        window.__l.push({
          t: Math.round(e.startTime),
          s: e.size,
          tag: el?.tagName,
          cls: (el?.className || "").toString().slice(0, 40),
          u: (e.url || "").slice(-50),
        });
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
    if (cssText) {
      const inject = () => {
        let s = document.getElementById("lcp-lab-hide-ghost");
        if (!s) {
          s = document.createElement("style");
          s.id = "lcp-lab-hide-ghost";
          (document.head || document.documentElement).appendChild(s);
        }
        s.textContent = cssText;
      };
      inject();
      new MutationObserver(inject).observe(document.documentElement, { childList: true, subtree: true });
    }
  }, hide ? css : null);
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(5500);
  const d = await p.evaluate(() => ({
    lcp: window.__l,
    fcp: performance.getEntriesByType("paint").find((x) => x.name === "first-contentful-paint")?.startTime,
  }));
  await b.close();
  return { run, fcp: d.fcp ? Math.round(d.fcp) : null, lcpCount: d.lcp.length, lcp: d.lcp.at(-1) || null };
}

const summary = {};
for (const [id, url] of targets) {
  const rows = [];
  for (let run = 1; run <= 3; run++) rows.push(await once(url, true, run));
  const pass = rows.filter((r) => r.lcpCount > 0).length;
  summary[id] = { pass: `${pass}/3`, rows };
  console.log(JSON.stringify({ id, pass: `${pass}/3`, sample: rows.find((r) => r.lcp)?.lcp || null }));
}
fs.writeFileSync("docs/visual-evidence/p0-perf-2026-11-23/lcp-ghost-hide-bisect.json", JSON.stringify({ at: new Date().toISOString(), summary }, null, 2));
console.log(JSON.stringify(summary, null, 2));
