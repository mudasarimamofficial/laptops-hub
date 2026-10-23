/**
 * WCAG 2 A/AA scan (axe-core, already a transitive dependency) over storefront and content routes.
 *   node scripts/visual/axe-sweep.mjs [base]
 */
import fs from "fs";
import path from "path";
import os from "os";
import { chromium } from "@playwright/test";

const B = process.argv[2] || "http://127.0.0.1:3000";
const exe = path.join(os.homedir(), "AppData", "Local", "ms-playwright", "chromium-1248", "chrome-win64", "chrome.exe");
const axe = fs.readFileSync("node_modules/axe-core/axe.min.js", "utf8");
const routes = ["/", "/collections/laptops", "/products/dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage", "/cart", "/compare", "/pages/contact", "/pages/faq", "/pages/shipping", "/guides", "/guides/how-much-ram"];
const b = await chromium.launch({ executablePath: exe });
const out = {};
for (const r of routes) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(B + r, { waitUntil: "load" });
  await p.waitForTimeout(800);
  await p.addScriptTag({ content: axe });
  const res = await p.evaluate(async () => {
    const x = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return x.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0]?.target?.join(" ") }));
  });
  out[r] = res;
  console.log(r.padEnd(70).slice(0, 70), res.length ? res.map((v) => `${v.id}(${v.impact},${v.n})`).join(" ") : "no violations");
  await p.close();
}
fs.writeFileSync("docs/A11Y_AXE_RESULTS.json", JSON.stringify({ base: B, at: new Date().toISOString(), results: out }, null, 2));
await b.close();
