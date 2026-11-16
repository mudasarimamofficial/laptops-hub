/**
 * Old-code compatibility smoke: the CURRENTLY DEPLOYED production commit, built and started locally against the LOCAL
 * Supabase with ALL migrations applied, must keep working (migrations are applied before the new code is deployed).
 * Routes are those that exist in the deployed commit (cb638b7 has no /admin/staff, /admin/reviews; its contact page is unpublished, so a published content page is used).
 * Usage: node scripts/rehearsal/old-code-compat-smoke.mjs http://127.0.0.1:3201
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";

const base = process.argv[2] || "http://127.0.0.1:3201";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error("local only");
const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const P = fx.products[0].handle;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

for (const path of ["/", `/products/${P}`, "/collections/all", "/search?q=dell", "/pages/shipping", "/cart", "/checkout", "/track-order", "/admin/login"]) {
  const r = await fetch(base + path, { redirect: "manual" });
  check(`GET ${path}`, r.status < 400, `status ${r.status}`);
}
// Public contact form still inserts (anon insert kept by migration 24).
const c = await fetch(base + "/api/contact", {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ name: "Compat Check", phone: "03001234567", email: "compat@example.test", message: "Old code on migrated schema smoke test." }),
});
check("POST /api/contact (old code, anon insert)", c.status === 200 || c.status === 201, `status ${c.status}`);

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base + "/admin/login");
await page.getByLabel("Email").fill(fx.staff.owner.email);
await page.getByLabel("Password").fill(fx.staff.owner.password);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(/\/admin(\?|$|\/(?!login))/, { timeout: 60_000 });
for (const path of ["/admin", "/admin/products", `/admin/products/${P}`, "/admin/orders", "/admin/inventory", "/admin/collections", "/admin/settings", "/admin/online-store", "/admin/inquiries"]) {
  const r = await page.goto(base + path);
  const text = await page.locator("body").innerText();
  const broken = /Application error|Something went wrong|could not be loaded/i.test(text);
  check(`admin ${path}`, !!r && r.status() < 400 && !broken && !page.url().includes("/forbidden"), `status ${r?.status()}${broken ? " (error text on page)" : ""}`);
}
check("no client errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
fs.mkdirSync("docs/evidence/migrations", { recursive: true });
fs.writeFileSync("docs/evidence/migrations/old_code_compat.json", JSON.stringify({ at: new Date().toISOString(), base, results }, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
