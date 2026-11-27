/**
 * Accessibility (2026-11-27) on the ISOLATED stack: collection/search filters. An option with no matching products is
 * dimmed AND disabled (inactive control, so the contrast rule does not apply and keyboard users skip it); options with
 * products stay enabled and work. axe-core reports no WCAG 2.x A/AA violations in the filter panel.
 */
import { expect, test, type Page } from "@playwright/test";
import fs from "fs";
import { assertLocalOnly } from "../../scripts/lib/local-only.mjs";

test.beforeAll(async () => {
  await assertLocalOnly("filter a11y");
});

const axeSource = fs.readFileSync("node_modules/axe-core/axe.min.js", "utf8");

async function filterState(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("aside label, fieldset label")]
      .map((l) => {
        const input = l.querySelector("input") as HTMLInputElement | null;
        if (!input) return null;
        return {
          label: (l.textContent || "").trim(),
          opacity: +getComputedStyle(l).opacity,
          disabled: input.disabled,
          checked: input.checked,
        };
      })
      .filter(Boolean) as { label: string; opacity: number; disabled: boolean; checked: boolean }[],
  );
}

for (const url of ["/search?q=dell", "/collections/all"]) {
  test(`${url}: dimmed filter options are disabled, others enabled; no axe violations in the filters`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: "load" });
    await expect.poll(async () => (await filterState(page)).length, { timeout: 20_000 }).toBeGreaterThan(2);
    const opts = await filterState(page);
    for (const o of opts) {
      if (o.opacity < 1) {
        expect(o.disabled, `dimmed "${o.label}" is disabled`).toBe(true);
        expect(o.checked, `dimmed "${o.label}" is not ticked`).toBe(false);
      } else {
        expect(o.disabled, `available "${o.label}" stays enabled`).toBe(false);
      }
    }
    await page.addScriptTag({ content: axeSource });
    const violations = await page.evaluate(async () => {
      // @ts-expect-error injected
      const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
      return r.violations.map((v: { id: string; nodes: { target: string[] }[] }) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    });
    expect(violations, `${url} axe WCAG A/AA`).toEqual([]);
  });
}

test("an available filter option still filters (URL updates) and can be unticked", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/collections/all", { waitUntil: "load" });
  await expect.poll(async () => (await filterState(page)).length, { timeout: 20_000 }).toBeGreaterThan(2);
  const target = page.locator("fieldset label").filter({ has: page.locator("input[type=checkbox]:not([disabled])") }).first();
  const label = ((await target.textContent()) || "").replace(/\d+$/, "").trim();
  await expect(target.locator("input")).toBeEnabled();
  // The filters are controlled by the URL: a click navigates, then the box reflects the new URL.
  await target.locator("input").click();
  await expect.poll(() => page.url(), { timeout: 15_000 }).toMatch(/\?/);
  const ticked = page.locator("fieldset label").filter({ hasText: label }).first().locator("input");
  await expect(ticked).toBeChecked({ timeout: 15_000 });
  await expect(ticked).toBeEnabled(); // a ticked option is never disabled, so it can be unticked
  await ticked.click();
  await expect(ticked).not.toBeChecked({ timeout: 15_000 });
});
