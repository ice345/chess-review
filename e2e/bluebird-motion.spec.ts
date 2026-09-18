import { expect, test, type Page } from "@playwright/test";
import { openReviewGameSummary, seedReview, writeStores } from "./fixtures";

/* Bluebird motion: Review workspace Tier A/B. Cognitive mode changes must
 * animate the contextual panel without moving the board column, and reduced
 * motion must collapse the entrance to an instant state change. */

async function openGuidedReview(page: Page) {
  const fixture = await seedReview(page, { visualLabels: true });
  const moment = fixture.analysis.moves[1]!;
  moment.classificationReason = { ...moment.classificationReason, isBook: false };
  moment.stockfish = {
    fen: moment.fenBefore,
    depth: 12,
    score: { kind: "cp", cp: 24 },
    bestMove: "b8c6",
    lines: [
      { rank: 1, depth: 12, score: { kind: "cp", cp: 24 }, pv: ["b8c6", "g1f3"] },
      { rank: 2, depth: 12, score: { kind: "cp", cp: 12 }, pv: ["g8f6", "g1f3"] },
      { rank: 3, depth: 12, score: { kind: "cp", cp: -240 }, pv: ["f7f6"] },
    ],
  };
  fixture.analysis.division = { totalPlies: fixture.analysis.division.totalPlies, middlePly: 11 };
  fixture.analysis.white.phaseAccuracy = { opening: 92, middlegame: 60 };
  fixture.analysis.black.phaseAccuracy = { opening: 95, middlegame: 88 };
  await writeStores(page, { "objective-analyses": [[fixture.cacheKey, fixture.analysis]] });

  await page.goto(`/review/${fixture.record.id}`);
  await expect(page.getByRole("region", { name: "Persistent board workspace" })).toBeVisible();
  await expect(page.locator(".key-moment-nav")).toBeVisible();
  return fixture;
}

function modePanel(page: Page) {
  return page.locator(".review-mode-panel");
}

async function settledTransform(page: Page): Promise<string> {
  const panel = modePanel(page);
  await expect.poll(async () => panel.evaluate((element) => getComputedStyle(element).transform)).toMatch(/^(none|matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\))$/);
  return panel.evaluate((element) => getComputedStyle(element).transform);
}

function animationDurationMs(value: string): number {
  const trimmed = value.trim();
  if (trimmed.endsWith("ms")) return Number.parseFloat(trimmed);
  return Number.parseFloat(trimmed) * 1000;
}

async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

test("stepping from the start ply to a key moment changes cognitive mode and settles", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuidedReview(page);

  await expect(modePanel(page)).toHaveAttribute("data-mode", "start");
  await page.getByRole("button", { name: "First key moment" }).click();

  await expect(modePanel(page)).toHaveAttribute("data-mode", "moment");
  await expect(page.locator(".key-moment-progress")).toHaveText("Moment 1 of 1");

  const transform = await settledTransform(page);
  expect(transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);

  const offset = await modePanel(page).evaluate((element) => {
    const style = getComputedStyle(element);
    if (style.transform === "none") return { x: 0, y: 0, opacity: Number(style.opacity) };
    const matrix = new DOMMatrixReadOnly(style.transform);
    return { x: matrix.m41, y: matrix.m42, opacity: Number(style.opacity) };
  });
  expect(offset.x).toBe(0);
  expect(offset.y).toBe(0);
  expect(offset.opacity).toBe(1);

  await page.screenshot({ path: test.info().outputPath("mode-start-to-moment.png") });
});

test("a mode change plays inside the Tier B budget and leaves an opened report open", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuidedReview(page);

  // The visitor opened a report. Stepping the game must never close it, and the
  // mode-change animation must not remount the panel to replay itself.
  await openReviewGameSummary(page);
  const summary = page.locator("details.game-summary-section");
  await expect(summary).toHaveAttribute("open", "");

  await page.getByRole("button", { name: "First key moment" }).click();

  await expect(modePanel(page)).toHaveAttribute("data-mode", "moment");

  // Sampled inside the page, one frame at a time, so the tier is measured rather
  // than inferred from a class that has already been cleaned up.
  const duration = await page.evaluate(async () => {
    const panel = document.querySelector(".review-mode-panel");
    if (!panel) return -1;
    const deadline = performance.now() + 1500;
    while (performance.now() < deadline) {
      const animation = panel.getAnimations().find((entry) => entry instanceof CSSAnimation);
      if (animation) return Number(animation.effect?.getTiming().duration ?? -1);
      const frame = Promise.withResolvers<void>();
      requestAnimationFrame(() => frame.resolve());
      await frame.promise;
    }
    return -1;
  });
  expect(duration, "mode entrance must be a Tier B transition").toBeGreaterThanOrEqual(180);
  expect(duration).toBeLessThanOrEqual(320);

  await expect(summary, "the opened report survived the mode change").toHaveAttribute("open", "");
  await settledTransform(page);
  await expect(modePanel(page)).not.toHaveClass(/mode-enter/);
});

test("starting practice keeps working controls and does not move the board column", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuidedReview(page);
  await page.getByRole("button", { name: "First key moment" }).click();

  await expect(modePanel(page)).toHaveAttribute("data-mode", "moment");

  const board = page.locator(".analysis-column");
  const before = await board.boundingBox();
  expect(before).not.toBeNull();

  await page.locator(".key-moment-action").getByRole("button", { name: "Try it" }).click();
  await expect(modePanel(page)).toHaveAttribute("data-mode", "practice");

  const drift = await page.evaluate(async () => {
    const column = document.querySelector(".analysis-column");
    if (!column) return { samples: 0, moved: true };
    const origin = column.getBoundingClientRect();
    const t0 = performance.now();
    let moved = false;
    let samples = 0;
    while (performance.now() - t0 < 280) {
      const rect = column.getBoundingClientRect();
      samples += 1;
      if (Math.abs(rect.x - origin.x) > 0.5 || Math.abs(rect.y - origin.y) > 0.5 || Math.abs(rect.width - origin.width) > 0.5 || Math.abs(rect.height - origin.height) > 0.5) {
        moved = true;
        break;
      }
      const frame = Promise.withResolvers<void>();
      requestAnimationFrame(frame.resolve);
      await frame.promise;
    }
    return { samples, moved };
  });
  expect(drift.moved, "board column moved during practice entrance").toBe(false);
  expect(drift.samples).toBeGreaterThan(0);

  const practice = page.getByRole("region", { name: "Learn from your mistakes" });
  await expect(practice).toBeVisible();
  await expect(practice.getByRole("button", { name: "Hint" })).toBeVisible();
  await expect(practice.getByRole("button", { name: "View the solution" })).toBeVisible();
  await expect(practice.getByRole("button", { name: "Skip" })).toBeVisible();

  const after = await board.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after!.x - before!.x)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(after!.width - before!.width)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(0.5);

  await settledTransform(page);
  await page.screenshot({ path: test.info().outputPath("mode-moment-to-practice.png") });
});

test("reduced motion keeps the state changes and collapses animation duration", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuidedReview(page);

  await expect(modePanel(page)).toHaveAttribute("data-mode", "start");
  const startDuration = animationDurationMs(await modePanel(page).evaluate((element) => getComputedStyle(element).animationDuration));
  expect(startDuration).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "First key moment" }).click();

  await expect(modePanel(page)).toHaveAttribute("data-mode", "moment");
  const momentDuration = animationDurationMs(await modePanel(page).evaluate((element) => getComputedStyle(element).animationDuration));
  expect(momentDuration).toBeLessThanOrEqual(1);

  await page.locator(".key-moment-action").getByRole("button", { name: "Try it" }).click();
  await expect(modePanel(page)).toHaveAttribute("data-mode", "practice");
  const practiceDuration = animationDurationMs(await modePanel(page).evaluate((element) => getComputedStyle(element).animationDuration));
  expect(practiceDuration).toBeLessThanOrEqual(1);
  await expect(page.getByRole("region", { name: "Learn from your mistakes" }).getByRole("button", { name: "Hint" })).toBeVisible();

  const transform = await settledTransform(page);
  expect(transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);
});

test("mode changes do not cause horizontal overflow at 1280×720 or 390×844", async ({ page }) => {
  await openGuidedReview(page);

  for (const [width, height] of [[1280, 720], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await expect(modePanel(page)).toBeVisible();
    await expect(modePanel(page)).toHaveAttribute("data-mode", /start|moment|practice/);

    if (await modePanel(page).getAttribute("data-mode") !== "start") {
      await page.goto(page.url());
      await expect(page.locator(".key-moment-nav")).toBeVisible();
    }
    await expect(modePanel(page)).toHaveAttribute("data-mode", "start");
    expect(await noHorizontalOverflow(page), `${width}×${height} start`).toBe(true);

    await page.getByRole("button", { name: "First key moment" }).click();

    await expect(modePanel(page)).toHaveAttribute("data-mode", "moment");
    await settledTransform(page);
    expect(await noHorizontalOverflow(page), `${width}×${height} moment`).toBe(true);

    await page.locator(".key-moment-action").getByRole("button", { name: "Try it" }).click();
    await expect(modePanel(page)).toHaveAttribute("data-mode", "practice");
    await settledTransform(page);
    expect(await noHorizontalOverflow(page), `${width}×${height} practice`).toBe(true);
  }
});
