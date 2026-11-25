import { expect, test, type Page } from "@playwright/test";

/** Read-only layout suite — never points at production; no fixture writes. */
function assertLocalBase() {
  const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3001";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(base.replace(/\/$/, ""))) {
    throw new Error(`mega-menu-responsive refuses non-local baseURL: ${base}`);
  }
}

async function openMega(page: Page) {
  const trigger = page.getByTestId("desktop-mega-trigger");
  await expect(trigger).toBeVisible();
  // Pages load with "domcontentloaded": wait for React's handlers, or the click is a silent no-op.
  await expect(trigger).toHaveAttribute("data-ready", "true", { timeout: 15_000 });
  await trigger.click();
  await expect(page.getByTestId("desktop-mega-menu")).toBeVisible();
}

async function metrics(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-testid="desktop-mega-menu"]');
    const search = document.querySelector(".v5-hov-search") as HTMLElement | null;
    const links = panel?.querySelector(".v5-mega-links-grid") as HTMLElement | null;
    const close = panel?.querySelector('[data-testid="desktop-mega-close"]') as HTMLElement | null;
    const footer = panel?.querySelector(".v5-mega-footer") as HTMLElement | null;
    const box = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, t: r.top, b: r.bottom };
    };
    const linkBoxes = links ? [...links.querySelectorAll("a")].map((a) => a.getBoundingClientRect().width) : [];
    const searchOverflow = search ? search.scrollWidth > search.clientWidth + 2 : false;
    const closeVisible = close
      ? (() => {
          const r = close.getBoundingClientRect();
          return r.height > 0 && r.bottom <= window.innerHeight + 1 && r.top >= 0;
        })()
      : false;
    return {
      panel: box(panel),
      linkCount: linkBoxes.length,
      maxLinkW: linkBoxes.length ? Math.max(...linkBoxes) : 0,
      searchOverflow,
      closeVisible,
      footerVisible: footer
        ? (() => {
            const r = footer.getBoundingClientRect();
            return r.height > 0 && r.bottom <= window.innerHeight + 1;
          })()
        : false,
      // Header/mega must not widen the layout; decorative hero/story ghosts may intentionally overflow.
      headerOverflowX: (() => {
        const header = document.querySelector("header");
        if (!header) return false;
        const r = header.getBoundingClientRect();
        return r.right > window.innerWidth + 2 || r.left < -2;
      })(),
    };
  });
}

test.describe("mega-menu responsive layout", () => {
  test.beforeEach(() => {
    assertLocalBase();
  });

  test("sparse SCREEN links stay compact at wide desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1754, height: 864 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openMega(page);
    const screen = page.getByTestId("mega-group-Screen");
    if (await screen.count()) {
      await screen.click();
      await page.waitForTimeout(150);
    }
    const m = await metrics(page);
    expect(m.linkCount).toBeGreaterThan(0);
    // Links must not stretch to fill the entire middle column (pre-fix used 1fr tracks).
    expect(m.maxLinkW).toBeLessThanOrEqual(200);
    expect(m.searchOverflow).toBe(false);
    expect(m.closeVisible).toBe(true);
    expect(m.footerVisible).toBe(true);
    expect(m.headerOverflowX).toBe(false);
  });

  test("short desktop keeps Close reachable", async ({ page }) => {
    await page.setViewportSize({ width: 1918, height: 542 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openMega(page);
    const m = await metrics(page);
    expect(m.closeVisible).toBe(true);
    expect(m.footerVisible).toBe(true);
    expect(m.panel?.h ?? 999).toBeLessThanOrEqual(440);
    expect(m.searchOverflow).toBe(false);
  });

  test("keyboard Escape closes mega menu", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openMega(page);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("desktop-mega-menu")).toHaveCount(0);
  });

  test("hover-open is not immediately closed by the same click gesture", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const trigger = page.getByTestId("desktop-mega-trigger");
    await expect(trigger).toHaveAttribute("data-ready", "true", { timeout: 15_000 });
    await trigger.hover();
    await expect(page.getByTestId("desktop-mega-menu")).toBeVisible();
    await trigger.click();
    await expect(page.getByTestId("desktop-mega-menu")).toBeVisible();
  });

  test("every catalog group is reachable and lists links", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openMega(page);
    const groups = page.locator('[data-testid^="mega-group-"]');
    const n = await groups.count();
    expect(n).toBeGreaterThan(3);
    for (let i = 0; i < n; i++) {
      const btn = groups.nth(i);
      await btn.click();
      await expect(btn).toHaveAttribute("aria-pressed", "true");
      const links = page.locator(".v5-mega-links-grid a");
      await expect(links.first()).toBeVisible();
      expect(await links.count()).toBeGreaterThan(0);
    }
  });
});
