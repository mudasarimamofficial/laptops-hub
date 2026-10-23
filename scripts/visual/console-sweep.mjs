import { chromium } from "@playwright/test";
import path from "path"; import os from "os";
const exe = path.join(os.homedir(),"AppData","Local","ms-playwright","chromium-1248","chrome-win64","chrome.exe");
const B = process.argv[2] || "http://127.0.0.1:3000";
const routes = ["/","/collections/laptops","/collections/chromebooks","/search?q=thinkpad","/products/dell-latitude-7420-core-i5-11th-gen-16gb-ram-256gb-storage","/cart","/compare","/pages/about","/pages/contact","/pages/faq","/pages/shipping","/pages/privacy","/guides","/guides/how-much-ram","/no-such-page"];
const b = await chromium.launch({ executablePath: exe });
let problems = 0;
for (const vp of [[1440,900],[390,844]]) {
  // Optional storage state (argv[3]) for SSO-protected Vercel previews.
  const ctx = await b.newContext({ viewport:{width:vp[0],height:vp[1]}, storageState: process.argv[3] || undefined });
  for (const r of routes) {
    const p = await ctx.newPage(); const errs=[];
    p.on("console", m=>{ if (m.type()==="error" && !/status of 404|404 \(Not Found\)/.test(m.text())) errs.push(m.text().slice(0,140)); });
    p.on("pageerror", e=>errs.push("PAGEERROR "+e.message.slice(0,140)));
    p.on("requestfailed", q=>{ if (q.url().startsWith(B) && !/_rsc=/.test(q.url())) errs.push("REQFAIL "+q.url().slice(B.length,B.length+80)); });
    await p.goto(B+r,{waitUntil:"load"}); await p.waitForTimeout(1200);
    const ov = await p.evaluate(()=>document.documentElement.scrollWidth - innerWidth);
    if (errs.length || ov>0) { problems++; console.log(vp[0], r, "overflow", ov, errs.slice(0,3)); }
    await p.close();
  }
  await ctx.close();
}
console.log(problems ? `${problems} route(s) with problems` : `clean: ${routes.length*2} page loads, no console/hydration errors, no failed requests, no horizontal overflow`);
await b.close();
