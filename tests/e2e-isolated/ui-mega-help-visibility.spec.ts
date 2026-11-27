/**
 * VIS-005 (2026-11-27) on the ISOLATED stack: in the desktop mega menu every category group, including the last one
 * (Help), is fully visible inside the menu body, not cut off by the footer or by the sticky column being taller than
 * the scrolling body. Footer and Close stay reachable; Escape and Close close the menu. If there are more groups than
 * fit, the column scrolls by itself and the last group can be brought fully into view.
 *
 * Geometry is read with page.evaluate (actual layout), never guessed.
 */
import { expect, test, type Page } from "@playwright/test";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

test.beforeAll(async () => {
  await assertLocalOnly("mega help visibility");
});

async function openMega(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const trigger = page.getByTestId("desktop-mega-trigger");
  await expect(trigger).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  await trigger.click();
  await expect
    .poll(() => page.evaluate(() => !!document.querySelector('[data-testid="desktop-mega-menu"]')), { timeout: 10_000 })
    .toBe(true);
}

/** Every group button's box against the visible part of the menu body and of the groups column. */
async function groupGeometry(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-testid="desktop-mega-menu"]') as HTMLElement;
    const body = panel.querySelector(".v5-mega-body") as HTMLElement;
    const col = panel.querySelector(".v5-mega-groups") as HTMLElement;
    const footer = panel.querySelector(".v5-mega-footer") as HTMLElement;
    const close = panel.querySelector('[data-testid="desktop-mega-close"]') as HTMLElement;
    const b = body.getBoundingClientRect();
    const c = col.getBoundingClientRect();
    // Visible boxes (clientHeight excludes any horizontal scrollbar).
    const bodyVis = { top: b.top + body.clientTop, bottom: b.top + body.clientTop + body.clientHeight };
    const colVis = { top: c.top + col.clientTop, bottom: c.top + col.clientTop + col.clientHeight };
    const f = footer.getBoundingClientRect();
    const cl = close.getBoundingClientRect();
    const buttons = [...col.querySelectorAll<HTMLElement>('[data-testid^="mega-group-"]')].map((el) => {
      const r = el.getBoundingClientRect();
      const top = Math.max(bodyVis.top, colVis.top);
      const bottom = Math.min(bodyVis.bottom, colVis.bottom, f.top);
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        id: el.dataset.testid as string,
        top: r.top,
        bottom: r.bottom,
        fullyVisible: r.height > 0 && r.top >= top - 0.5 && r.bottom <= bottom + 0.5,
        hitSelf: !!hit && (hit === el || el.contains(hit)),
      };
    });
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      panelBottom: panel.getBoundingClientRect().bottom,
      bodyScrollTop: body.scrollTop,
      bodyScrollable: body.scrollHeight - body.clientHeight,
      colScrollable: col.scrollHeight - col.clientHeight,
      colPosition: getComputedStyle(col).position,
      footerInViewport: f.height > 0 && f.top >= 0 && f.bottom <= window.innerHeight + 1,
      closeInViewport: cl.height > 0 && cl.top >= 0 && cl.bottom <= window.innerHeight + 1,
      buttons,
    };
  });
}

// The six viewports from the owner's report: with the live menu (nine groups) every group fits with no scrolling.
const FIT = [
  { width: 1180, height: 900 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1754, height: 864 },
  { width: 1918, height: 542 },
  { width: 1280, height: 600 }, // inside the 581–700px band
  { width: 1024, height: 768 }, // narrow desktop, no featured card
];

for (const vp of FIT) {
  test(`${vp.width}×${vp.height}: every group, including Help, is fully visible; each selects; Close reachable`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(vp);
    await openMega(page);
    const g = await groupGeometry(page);
    expect(g.buttons.length, "menu groups render").toBeGreaterThan(3);
    for (const btn of g.buttons) {
      expect(btn.fullyVisible, `${btn.id} fully inside the visible menu body (top ${btn.top}, bottom ${btn.bottom})`).toBe(true);
      expect(btn.hitSelf, `${btn.id} is the element under its own centre (nothing painted over it)`).toBe(true);
    }
    expect(g.colScrollable, "category column needs no scrolling of its own").toBeLessThanOrEqual(1);
    expect(g.footerInViewport, "footer inside the window").toBe(true);
    expect(g.closeInViewport, "Close inside the window").toBe(true);
    expect(g.panelBottom).toBeLessThanOrEqual(g.vh + 1);

    // Each group selects and shows its links; after selecting, the groups are still all visible (a long link list may
    // scroll the body: the sticky column must stay whole).
    for (const btn of g.buttons) {
      await page.getByTestId(btn.id).click();
      await expect(page.getByTestId(btn.id)).toHaveAttribute("aria-pressed", "true");
      expect(await page.locator(".v5-mega-links-grid a").count(), `${btn.id} lists links`).toBeGreaterThan(0);
    }
    // Scroll the body to its end (the longest list case) and check again.
    await page.evaluate(() => {
      const body = document.querySelector(".v5-mega-body") as HTMLElement;
      body.scrollTop = body.scrollHeight;
    });
    const end = await groupGeometry(page);
    for (const btn of end.buttons) expect(btn.fullyVisible, `after body scroll: ${btn.id}`).toBe(true);

    await page.getByTestId("desktop-mega-close").click();
    await expect
      .poll(() => page.evaluate(() => !!document.querySelector('[data-testid="desktop-mega-menu"]')))
      .toBe(false);
  });
}

test("keyboard: focusing the last group selects it and it is visible; Escape closes", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openMega(page);
  const last = page.locator('[data-testid^="mega-group-"]').last();
  await page.keyboard.press("Shift");
  await last.focus();
  await expect(last).toHaveAttribute("aria-pressed", "true");
  const g = await groupGeometry(page);
  expect(g.buttons[g.buttons.length - 1].fullyVisible).toBe(true);
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.evaluate(() => !!document.querySelector('[data-testid="desktop-mega-menu"]')))
    .toBe(false);
});

test("more groups than fit (very short window, or a longer merchant menu): the column scrolls and the last group is reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 500 });
  await openMega(page);
  // Layout-only stress: add copies of the group buttons so the list is longer than any panel (no data is written).
  await page.evaluate(() => {
    const col = document.querySelector(".v5-mega-groups") as HTMLElement;
    const src = [...col.children];
    for (let i = 0; i < 2; i++) for (const el of src) col.appendChild(el.cloneNode(true));
  });
  const before = await groupGeometry(page);
  expect(before.colScrollable, "the long column scrolls by itself").toBeGreaterThan(0);
  expect(before.colPosition).toBe("sticky");
  // Natural scrolling of the column brings the last row fully into view (not hidden under a pinned sticky top).
  await page.evaluate(() => {
    const col = document.querySelector(".v5-mega-groups") as HTMLElement;
    col.scrollTop = col.scrollHeight;
  });
  const after = await groupGeometry(page);
  const lastBtn = after.buttons[after.buttons.length - 1];
  expect(lastBtn.fullyVisible, `last row fully visible after scrolling (top ${lastBtn.top}, bottom ${lastBtn.bottom})`).toBe(true);
  expect(after.footerInViewport).toBe(true);
  expect(after.closeInViewport).toBe(true);
});
