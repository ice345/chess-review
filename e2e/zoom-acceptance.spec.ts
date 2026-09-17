import { expect, test, type Page } from "@playwright/test";
import { seedReview } from "./fixtures";

/* Browser zoom acceptance (UI audit F-level item: real zoom, not only fixed
   viewports).
 *
 * Page zoom and CSS viewport size are layout-equivalent — a 1440x900 window at
 * 150% lays out exactly like a 960x600 CSS viewport — so each level is driven by
 * shrinking the viewport, which is what the media queries see in a real zoomed
 * browser. The overlays are additionally checked with a CSS zoom on the document,
 * because fixed and absolutely positioned surfaces are where zoom actually breaks. */

const WINDOW = { width: 1440, height: 900 };
const ZOOMS = [100, 125, 150, 200] as const;

function zoomed(percent: number) {
  return { width: Math.round(WINDOW.width / (percent / 100)), height: Math.round(WINDOW.height / (percent / 100)) };
}

async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

async function expectInsideViewport(page: Page, selector: string): Promise<void> {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, selector).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(box!.width, `${selector} width`).toBeGreaterThan(0);
  expect(box!.x, `${selector} left edge`).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width, `${selector} right edge`).toBeLessThanOrEqual(viewport.width + 1);
}

for (const zoom of ZOOMS) {
  test(`Review stays usable at ${zoom}% browser zoom`, async ({ page }) => {
    await page.setViewportSize(zoomed(zoom));
    const { record } = await seedReview(page, { visualLabels: true });
    await page.goto(`/review/${record.id}`);
    await expect(page.getByRole("region", { name: "Persistent board workspace" })).toBeVisible();

    // The board stays usable and inside the window.
    const board = await page.locator(".board-wrap").boundingBox();
    expect(board!.width).toBeGreaterThanOrEqual(240);
    expect(board!.x).toBeGreaterThanOrEqual(-1);
    expect(board!.x + board!.width).toBeLessThanOrEqual(zoomed(zoom).width + 1);
    expect(await noHorizontalOverflow(page)).toBe(true);

    // Basic transport stays reachable and touch-sized.
    await expectInsideViewport(page, ".move-transport");
    const next = page.getByRole("button", { name: "Next move" });
    await expect(next).toBeVisible();
    expect((await next.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await next.click();
    await expect(page.locator(".move-status")).toContainText("1. e4");

    // The titlebar keeps a reachable disclosure even where the Settings shortcut
    // is deliberately hidden.
    await expectInsideViewport(page, "details.review-more");
    await page.locator("details.review-more summary").click();
    await expect(page.locator("details.review-more .action-menu")).toBeVisible();
    await page.locator("details.review-more summary").click();

    // Focus board and the shortcut overlay both stay inside the window.
    await page.keyboard.press("z");
    await expect(page.locator(".review-workspace")).toHaveClass(/focus-board/);
    await expect(page.locator(".context-panel")).toBeHidden();
    expect(await noHorizontalOverflow(page)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator(".context-panel")).toBeVisible();

    await page.keyboard.press("?");
    const help = page.getByRole("dialog", { name: "Shortcuts" });
    await expect(help).toBeVisible();
    await expectInsideViewport(page, ".shortcut-help");
    await page.getByRole("button", { name: "Close" }).click();
    await expect(help).toHaveCount(0);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
}

test("the promotion chooser stays reachable with a zoomed document", async ({ page }) => {
  await page.setViewportSize(WINDOW);
  await page.goto("/");
  await page.getByRole("button", { name: "FEN" }).click();
  await page.getByLabel("Paste an explicit FEN").fill("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  await page.getByRole("button", { name: "Open Engine Lab →" }).click();
  await expect(page).toHaveURL(/\/engine$/);
  const reviewUrl = page.url();

  // Chrome implements page zoom as a scale on the document, which is the hostile
  // case for fixed and absolutely positioned overlays. Each pass starts from the
  // canonical position again.
  for (const percent of [150, 200]) {
    await page.goto(reviewUrl);
    await expect(page.getByRole("region", { name: "Persistent board workspace" })).toBeVisible();
    await page.evaluate((value) => { document.documentElement.style.zoom = `${value}%`; }, percent);
    await page.locator('[data-square="a7"]').click();
    await page.locator('[data-square="a8"]').click();
    const chooser = page.getByRole("dialog", { name: "Choose promotion piece" });
    await expect(chooser).toBeVisible();
    await chooser.getByRole("button", { name: "Queen" }).click();
    await expect(page.locator(".move-status")).toContainText("a8=Q");
  }
});
