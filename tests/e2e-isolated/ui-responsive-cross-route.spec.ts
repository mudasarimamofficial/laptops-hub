/**
 * VIS-007 (2026-11-27) on the ISOLATED stack: site-wide responsive and overlay audit.
 *
 * For each public route at phone, landscape, tablet, laptop and short-desktop sizes, at the top, middle and end of the
 * page, checks with real geometry (elementFromPoint) that:
 *  - the page never scrolls sideways;
 *  - nothing from the page paints over the header / promotion bar (VIS-001/002 class of bug);
 *  - at the end of the page, no link or button has its centre covered by a floating overlay (WhatsApp button, sticky
 *    bars), since there it cannot be scrolled out from under it;
 *  - no button or link text is cut off without an ellipsis.
 * Findings are collected for every route and viewport and reported together, so one run shows the whole picture.
 */
import { expect, test, type Page } from "@playwright/test";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

test.beforeAll(async () => {
  await assertLocalOnly("responsive cross-route");
});

const fx = JSON.parse(fs.readFileSync(".isolated/fixture.json", "utf8"));
const ROUTES: [string, string][] = [
  ["home", "/"],
  ["collection", "/collections/all"],
  ["pdp", `/products/${fx.products[0].handle}`],
  ["search", "/search?q=dell"],
  ["compare", "/compare"],
  ["cart", "/cart"],
  ["checkout", "/checkout"],
  ["track", "/track-order"],
  ["guides", "/guides"],
];
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1918, height: 542 },
];

type Finding = { kind: string; where: string; detail: string };

async function audit(page: Page, where: string, atEnd = false): Promise<Finding[]> {
  const raw = await page.evaluate((atEnd) => {
    const out: { kind: string; detail: string }[] = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const describe = (el: Element | null) => {
      if (!el) return "null";
      const h = el as HTMLElement;
      const id = h.id ? `#${h.id}` : "";
      const tid = h.dataset?.testid ? `[data-testid=${h.dataset.testid}]` : "";
      const cls = typeof h.className === "string" && h.className ? `.${h.className.trim().split(/\s+/).slice(0, 2).join(".")}` : "";
      const text = (h.innerText || h.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 40);
      return `${el.tagName.toLowerCase()}${id}${tid}${cls}${text ? ` "${text}"` : ""}`;
    };

    // 1. Sideways scroll.
    const overflow = document.documentElement.scrollWidth - vw;
    if (overflow > 1) out.push({ kind: "overflow-x", detail: `${overflow}px` });

    // 2. Header / promo bar: every sample point must be painted by the header, the promo bar, or something inside
    // them (their own menus), or by deliberate top-layer UI (dialogs, drawers). Anything else is bleed-through.
    const header = document.querySelector("header.lh-site-header") as HTMLElement | null;
    const promo = document.querySelector(".lh-promo-bar") as HTMLElement | null;
    const allowed = (el: Element) =>
      (header && header.contains(el)) ||
      (promo && promo.contains(el)) ||
      !!el.closest('[role="dialog"], [aria-modal="true"], [data-testid="whatsapp-float"]');
    for (const band of [promo, header]) {
      if (!band) continue;
      const r = band.getBoundingClientRect();
      if (r.height <= 0 || r.bottom <= 0 || r.top >= vh) continue;
      const top = Math.max(0, r.top) + 2;
      const bottom = Math.min(vh, r.bottom) - 2;
      for (let y = top; y <= bottom; y += Math.max(4, (bottom - top) / 4)) {
        for (let x = 4; x < vw - 4; x += Math.max(16, vw / 24)) {
          const hit = document.elementFromPoint(x, y);
          if (hit && !allowed(hit)) {
            out.push({ kind: "header-bleed", detail: `(${Math.round(x)},${Math.round(y)}) ${describe(hit)}` });
            break;
          }
        }
      }
    }

    // 3. Visible links/buttons whose centre is covered by a different fixed/sticky element.
    const isPinned = (el: Element | null) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const p = getComputedStyle(n).position;
        if (p === "fixed" || p === "sticky") return n;
      }
      return null;
    };
    // Content scrolling up under the sticky header / promo bar is normal and is not a finding. A floating overlay
    // (e.g. the WhatsApp button) passing over content mid-scroll is normal too; at the END of the page, though, content
    // can no longer scroll out from under it, so anything it covers there is unreachable: that is a finding.
    for (const el of atEnd ? document.querySelectorAll<HTMLElement>("main a[href], main button, footer a[href], footer button") : []) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cx < 0 || cx >= vw || cy < 0 || cy >= vh) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || +cs.opacity === 0) continue;
      const hit = document.elementFromPoint(cx, cy);
      if (!hit || el === hit || el.contains(hit) || hit.contains(el)) continue;
      const cover = isPinned(hit);
      if (!cover || cover.contains(el)) continue;
      if ((header && header.contains(cover)) || (promo && promo.contains(cover))) continue;
      out.push({ kind: "covered-control", detail: `${describe(el)} under ${describe(cover)}` });
    }

    // 4. Cut-off text on links and buttons (no ellipsis): content wider than the box that clips it.
    for (const el of document.querySelectorAll<HTMLElement>("a, button")) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.bottom < 0 || r.top > vh) continue;
      const cs = getComputedStyle(el);
      if (cs.textOverflow === "ellipsis" || cs.overflowX === "visible") continue;
      if (el.scrollWidth > el.clientWidth + 1 && (el.innerText || "").trim()) {
        out.push({ kind: "clipped-text", detail: `${describe(el)} ${el.scrollWidth}>${el.clientWidth}` });
      }
    }
    return out;
  }, atEnd);
  return raw.map((f) => ({ ...f, where }));
}

for (const [name, url] of ROUTES) {
  test(`responsive + overlay audit: ${name}`, async ({ page }) => {
    test.setTimeout(300_000);
    const findings: Finding[] = [];
    for (const vp of VIEWPORTS) {
      await page.setViewportSize(vp);
      const res = await page.goto(`${url}${url.includes("?") ? "&" : "?"}vw=${vp.width}x${vp.height}`, { waitUntil: "domcontentloaded" });
      expect([200, 404], `${url} status`).toContain(res?.status());
      await expect
        .poll(() => page.evaluate(() => !!document.querySelector("main") && document.readyState !== "loading"), { timeout: 20_000 })
        .toBe(true);
      await page.waitForTimeout(400);
      const tag = `${name} ${vp.width}×${vp.height}`;
      findings.push(...(await audit(page, `${tag} top`)));
      for (const [label, frac] of [
        ["middle", 0.5],
        ["end", 1],
      ] as const) {
        await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * f), frac);
        await page.waitForTimeout(350);
        findings.push(...(await audit(page, `${tag} ${label}`, label === "end")));
      }
    }
    // De-duplicate identical findings so the report stays readable.
    const uniq = [...new Map(findings.map((f) => [`${f.kind}|${f.where}|${f.detail}`, f])).values()];
    if (uniq.length) console.log(`\n[${name}] findings:\n` + uniq.map((f) => `  ${f.kind} @ ${f.where}: ${f.detail}`).join("\n"));
    expect(uniq, `${name}: responsive/overlay findings`).toEqual([]);
  });
}
