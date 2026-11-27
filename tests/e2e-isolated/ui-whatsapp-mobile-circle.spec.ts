/**
 * VIS-006 (2026-11-27) on the ISOLATED stack: on phones the floating WhatsApp button is a true circle (equal sides,
 * centred icon, no label, no pill padding); on wide screens the labelled pill is unchanged. The merchant's link and
 * accessible name are kept, and keyboard focus is visible.
 */
import { expect, test, type Page } from "@playwright/test";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

test.beforeAll(async () => {
  await assertLocalOnly("whatsapp circle");
});

async function geometry(page: Page) {
  // page.evaluate, not a locator: Firefox locators wait for the heavy homepage's pending load to finish.
  return page.evaluate(() => {
    const a = document.querySelector('[data-testid="whatsapp-float"]') as HTMLElement;
    const r = a.getBoundingClientRect();
    const icon = (a.querySelector(".lh-wa-icon") as HTMLElement).getBoundingClientRect();
    const label = a.querySelector("span.v5-d-only") as HTMLElement | null;
    const cs = getComputedStyle(a);
    return {
      w: r.width,
      h: r.height,
      radius: parseFloat(cs.borderTopLeftRadius),
      padL: parseFloat(cs.paddingLeft),
      padR: parseFloat(cs.paddingRight),
      dx: Math.abs(icon.left + icon.width / 2 - (r.left + r.width / 2)),
      dy: Math.abs(icon.top + icon.height / 2 - (r.top + r.height / 2)),
      labelVisible: !!label && label.getBoundingClientRect().width > 0,
      right: window.innerWidth - r.right,
      bottom: window.innerHeight - r.bottom,
      href: a.getAttribute("href"),
      name: a.getAttribute("aria-label"),
    };
  });
}

async function open(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect
    .poll(() => page.evaluate(() => (document.querySelector('[data-testid="whatsapp-float"]')?.getBoundingClientRect().width ?? 0) > 0), {
      timeout: 20_000,
    })
    .toBe(true);
}

test("phones: a centred 56px circle at every phone width; wide screens keep the labelled pill", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const desk = await geometry(page);
  expect(desk.labelVisible, "desktop label shown").toBe(true);
  expect(desk.w).toBeGreaterThan(desk.h + 40); // pill
  expect(desk.h).toBeGreaterThanOrEqual(52);
  expect(desk.href).toMatch(/^https:\/\//);
  expect(desk.name).toMatch(/opens in a new tab/);

  for (const w of [320, 360, 375, 390, 414, 430, 759]) {
    await page.setViewportSize({ width: w, height: 800 });
    await open(page);
    const g = await geometry(page);
    expect(Math.abs(g.w - g.h), `${w}px: width equals height`).toBeLessThanOrEqual(0.5);
    expect(g.w, `${w}px: 56px`).toBeCloseTo(56, 0);
    expect(g.radius, `${w}px: round`).toBeGreaterThanOrEqual(28);
    expect(g.padL + g.padR, `${w}px: no pill padding`).toBe(0);
    expect(g.dx, `${w}px: icon centred horizontally`).toBeLessThanOrEqual(1);
    expect(g.dy, `${w}px: icon centred vertically`).toBeLessThanOrEqual(1);
    expect(g.labelVisible, `${w}px: no label`).toBe(false);
    expect(g.right).toBeGreaterThanOrEqual(15); // inside the screen, off the edge
    expect(g.bottom).toBeGreaterThanOrEqual(15);
    expect(g.href, "same merchant link as desktop").toBe(desk.href);
    expect(g.name).toBe(desk.name);
  }

  // Wide again (resize without reload): back to the pill.
  await page.setViewportSize({ width: 1024, height: 800 });
  const back = await geometry(page);
  expect(back.labelVisible).toBe(true);
  expect(back.w).toBeGreaterThan(back.h + 40);
});

test("keyboard focus on the phone circle is visible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  // A key press first, so the programmatic focus counts as keyboard focus (:focus-visible). Tab itself is not used:
  // WebKit (like Safari) skips links on Tab by default.
  await page.keyboard.press("Shift");
  await page.getByTestId("whatsapp-float").focus();
  const outline = await page.getByTestId("whatsapp-float").evaluate((a) => {
    const cs = getComputedStyle(a);
    return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), focused: document.activeElement === a };
  });
  expect(outline.focused).toBe(true);
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThanOrEqual(2);
});
