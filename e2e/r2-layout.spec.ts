import { test, expect } from "@playwright/test";
import { seedReview, mockLocalAi } from "./fixtures";
import { mkdir, writeFile } from "node:fs/promises";

test("import actions and board navigation fit the first screen across six sizes", async ({ page }, testInfo) => {
  const directory = testInfo.outputPath("layouts");
  await mkdir(directory, { recursive: true });
  await mockLocalAi(page, "offline");
  const { record } = await seedReview(page, { visualLabels: true });
  const measurements = [];
  for (const [width, height] of [[1280,720],[1366,768],[1440,900],[1920,1080],[390,844],[320,740]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.locator(".import-card")).toBeVisible();
    const home = await page.locator(".import-submit").boundingBox();
    expect(home!.y + home!.height).toBeLessThanOrEqual(height);
    expect(home!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width < 820) {
      const board = await page.locator(".home-board").boundingBox();
      expect(home!.y + home!.height).toBeLessThan(board!.y);
    }
    await page.screenshot({ path: `${directory}/home-${width}.png`, fullPage: true });
    await page.goto(`/review/${record.id}`);
    await expect(page.getByText("MOVE QUALITY", { exact: true })).toBeVisible();
    await page.screenshot({ path: `${directory}/review-${width}.png` });
    const review = await page.evaluate(() => {
      const bounds = (selector: string) => {
        const r = document.querySelector(selector)!.getBoundingClientRect();
        return { x:r.x, y:r.y, width:r.width, height:r.height, bottom:r.bottom };
      };
      return { board: bounds(".board-wrap"), controls: bounds(".move-transport"), panel: bounds(".context-panel"), horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(review.horizontalOverflow).toBe(false);
    expect(review.controls.bottom).toBeLessThanOrEqual(height);
    if (width >= 1280) {
      expect(review.board.width).toBeGreaterThanOrEqual(width >= 1440 ? 500 : 420);
      expect(review.panel.width / review.board.width).toBeLessThan(1.3);
    }
    expect((await page.getByRole("button", { name: "Next move" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator(".context-panel .timeline-panel[open]")).toHaveCount(1);
    measurements.push({ width, height, homeSubmit: home, ...review });
  }
  await writeFile(`${directory}/measurements.json`, JSON.stringify(measurements, null, 2));
  await testInfo.attach("layout-measurements", { path: `${directory}/measurements.json`, contentType: "application/json" });
});
