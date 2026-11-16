import { chromium, webkit } from "@playwright/test";
const base = process.argv[2] || "https://www.laptopshub.pk";
const out = [];
for (const [name, eng] of [["chromium", chromium], ["webkit", webkit]]) {
  const b = await eng.launch();
  // Keyboard: focus moves into the map (as Tab does) and must not stay hidden under the footer (WCAG 2.4.11).
  {
    const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    await p.goto(base + "/", { waitUntil: "load" });
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.getByTestId("store-map-open").focus();
    await p.waitForTimeout(500);
    const visible = await p.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!a.closest('[data-testid="store-map-open"]') && r.top >= 0 && r.bottom <= innerHeight && !!el?.closest('[data-testid="store-map-open"]'); });
    out.push({ name, check: "keyboard focus on Open in Google Maps is visible, not under the footer", ok: visible });
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const embed = await p.getByTestId("store-map-iframe").getAttribute("src", { timeout: 15_000 });
    out.push({ name, check: "embed src", ok: /^https:\/\/www\.google\.com\/maps\/embed\?pb=/.test(embed || ""), detail: (embed || "").slice(0, 60) + "…" });
  }
  // Reduced motion: map is a plain section (not sticky underlay).
  {
    const p = await (await b.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } })).newPage();
    await p.goto(base + "/", { waitUntil: "load" });
    const pos = await p.evaluate(() => { const el = document.querySelector('[data-testid="store-map"]'); return el ? getComputedStyle(el).position : "missing"; });
    out.push({ name, check: "reduced motion: map not sticky", ok: pos !== "sticky" && pos !== "missing", detail: pos });
  }
  // Touch: phone context, swipe/scroll to bottom, link tappable.
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: name !== "firefox" });
    const p = await ctx.newPage();
    await p.goto(base + "/", { waitUntil: "load" });
    for (let i = 0; i < 3; i++) { await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(800); }
    const link = p.getByTestId("store-map-open");
    const box = await link.boundingBox();
    const hit = box && (await p.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-testid="store-map-open"]'), { x: box.x + box.width / 2, y: box.y + box.height / 2 }));
    const href = await link.getAttribute("href");
    out.push({ name, check: "touch phone: link tappable at bottom, Google Maps href", ok: !!hit && /^https:\/\/((www\.|maps\.)?google\.[a-z.]+\/(maps|\?cid=)|maps\.app\.goo\.gl\/)/.test(href || ""), detail: (href || "").slice(0, 70) });
  }
  await b.close();
}
for (const r of out) console.log(r.ok ? "PASS" : "FAIL", r.name, r.check, r.detail ? "— " + r.detail : "");
process.exit(out.every((r) => r.ok) ? 0 : 1);
