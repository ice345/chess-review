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
    // Measured from the DOM, not from Playwright's box: below the rail breakpoint
    // Playwright's box for this frame carries a constant offset, so it reports a
    // position the render does not have. `getBoundingClientRect` is what the
    // painted page shows.
    const home = await page.evaluate(() => document.querySelector(".import-submit")!.getBoundingClientRect().toJSON());
    expect(home.y + home.height).toBeLessThanOrEqual(height);
    expect(home.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width < 820) {
      const board = await page.evaluate(() => document.querySelector(".home-board")!.getBoundingClientRect().toJSON());
      expect(home.y + home.height).toBeLessThan(board.y);
    }
    await page.screenshot({ path: `${directory}/home-${width}.png`, fullPage: true });
    await page.goto(`/review/${record.id}`);
    await expect(page.getByText("GAME SUMMARY", { exact: true })).toBeVisible();
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
      expect(review.board.width).toBeGreaterThanOrEqual(width >= 1440 ? 540 : 480);
      expect(review.panel.width / review.board.width).toBeLessThan(1.3);
    }
    expect((await page.getByRole("button", { name: "Next move" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator(".context-panel .timeline-panel[open]")).toHaveCount(0);
    measurements.push({ width, height, homeSubmit: home, ...review });
  }
  await writeFile(`${directory}/measurements.json`, JSON.stringify(measurements, null, 2));
  await testInfo.attach("layout-measurements", { path: `${directory}/measurements.json`, contentType: "application/json" });
});

test("the application rail frames every route and becomes a drawer below its breakpoint", async ({ page }) => {
  await mockLocalAi(page, "offline");
  const { record } = await seedReview(page, { visualLabels: true });

  // Desktop: one persistent column, one navigation landmark, and the route
  // content starts to its right rather than under it.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/history");
  await expect(page.locator(".app-rail")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Application navigation" })).toHaveCount(1);
  await expect(page.locator(".rail-trigger")).toBeHidden();
  await expect(page.locator('.rail-nav a[aria-current="page"]')).toHaveText("Library");
  const frame = await page.evaluate(() => {
    const rail = document.querySelector(".app-rail")!.getBoundingClientRect();
    const content = document.querySelector(".app-content")!.getBoundingClientRect();
    return { railRight: rail.right, contentLeft: content.left, railHeight: rail.height };
  });
  expect(frame.railRight).toBeGreaterThanOrEqual(160);
  expect(frame.contentLeft).toBeGreaterThanOrEqual(frame.railRight);
  expect(frame.railHeight).toBeGreaterThanOrEqual(600);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // Review keeps its own titlebar as game context inside the frame, and neither
  // the titlebar nor the board is allowed to slide under the rail.
  for (const [width, height] of [[1440, 900], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`/review/${record.id}`);
    await expect(page.getByRole("region", { name: "Persistent board workspace" })).toBeVisible();
    const geometry = await page.evaluate(() => {
      const rail = document.querySelector(".app-rail")!.getBoundingClientRect();
      const board = document.querySelector(".board-wrap")!.getBoundingClientRect();
      const titlebar = document.querySelector(".review-titlebar")!.getBoundingClientRect();
      return { railRight: rail.right, boardLeft: board.left, titlebarLeft: titlebar.left, boardWidth: board.width };
    });
    expect(geometry.boardLeft, `board must clear the rail at ${width}×${height}`).toBeGreaterThanOrEqual(geometry.railRight);
    expect(geometry.titlebarLeft, `review titlebar must clear the rail at ${width}×${height}`).toBeGreaterThanOrEqual(geometry.railRight);
    expect(geometry.boardWidth).toBeGreaterThanOrEqual(480);
    // A review lives under Review, and the rail says so, exactly as the design
    // reference highlights that row while its workspace is open.
    await expect(page.locator('.rail-nav a[aria-current="page"]')).toHaveText("Review");
  }

  // Below the breakpoint the bar replaces the column and the same element
  // becomes a drawer: keyboard reachable, dismissible, and unambiguous. A closed
  // drawer is display:none, so it is not a landmark on the page at all.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const nav = page.locator("#app-nav");
  const trigger = page.getByRole("button", { name: "Menu" });
  await expect(nav).toHaveCount(1);
  await expect(nav).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Application navigation" })).toHaveCount(0);
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".app-rail")).toHaveCSS("position", "relative");

  await trigger.click();
  await expect(nav).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Application navigation" })).toHaveCount(1);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  // The first row is Home, so that is where opening the drawer puts focus.
  await expect(nav.getByRole("link", { name: "Home" })).toBeFocused();
  const drawer = await nav.boundingBox();
  expect(drawer!.x).toBeGreaterThanOrEqual(0);
  expect(drawer!.x + drawer!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.keyboard.press("Escape");
  await expect(nav).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await nav.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(nav).toBeHidden();
});

test("every rail row opens the screen it names and marks itself current", async ({ page }) => {
  await mockLocalAi(page, "offline");
  await seedReview(page, { visualLabels: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  const rows: [string, string][] = [
    ["Home", "/"],
    ["Import", "/import"],
    ["Review", "/review"],
    ["Practice", "/training"],
    ["Library", "/history"],
    ["Stats", "/stats"],
    ["Settings", "/settings"],
  ];
  await page.goto("/");
  for (const [label, path] of rows) {
    await page.locator(".rail-nav").getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replace("/", "\\/")}$`));
    await expect(page.locator('.rail-nav a[aria-current="page"]'), label).toHaveText(label);
    // Each destination opens with the route head, so a row can never land on a
    // blank or half-built screen.
    await expect(page.locator(".page-head .page-display"), label).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label).toBe(true);
  }
});
