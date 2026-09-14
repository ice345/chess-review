import { expect, test } from "@playwright/test";
import { seedReview } from "./fixtures";
import { REVIEW_SHORTCUTS } from "../apps/web/src/lib/review-shortcuts";

/* Board ergonomics: keyboard shortcuts, the persisted desktop board size and
   Focus board. These are the interaction contracts of the review workspace, so
   they are asserted on the real board rather than through unit tests. */

async function openReview(page: import("@playwright/test").Page) {
  const fixture = await seedReview(page);
  await page.goto(`/review/${fixture.record.id}`);
  await expect(page.getByRole("region", { name: "Persistent board workspace" })).toBeVisible();
  await expect(page.locator(".board-wrap img").first()).toBeVisible();
  return fixture;
}

async function boardWidth(page: import("@playwright/test").Page): Promise<number> {
  const box = await page.locator(".board-wrap").boundingBox();
  if (!box) throw new Error("The board is not visible.");
  return Math.round(box.width);
}

test("drives the review from the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openReview(page);
  const status = page.locator(".move-status");

  await page.keyboard.press("ArrowRight");
  await expect(status).toContainText("1. e4");
  await page.keyboard.press("k");
  await expect(status).toContainText("1… e5");
  await page.keyboard.press("j");
  await expect(status).toContainText("1. e4");
  await page.keyboard.press("ArrowUp");
  await expect(status).toContainText("Starting position");
  await page.keyboard.press("ArrowDown");
  await expect(status).toContainText("21 / 21 ply");
  await page.keyboard.press("ArrowUp");

  // F flips the board. a1 must change sides of the board, not just its square color.
  const a1 = page.locator('[data-square="a1"]');
  const h1 = page.locator('[data-square="h1"]');
  expect((await a1.boundingBox())!.x).toBeLessThan((await h1.boundingBox())!.x);
  await page.keyboard.press("f");
  await expect.poll(async () => (await a1.boundingBox())!.x).toBeGreaterThan((await h1.boundingBox())!.x);
  await page.keyboard.press("f");
  await expect.poll(async () => (await a1.boundingBox())!.x).toBeLessThan((await h1.boundingBox())!.x);

  // Space plays and pauses, and the transport reports the state it is in.
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Pause playback" })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Play game" })).toBeVisible();
  await page.keyboard.press("ArrowUp");

  // `?` opens the shortcut list, and the workspace stops consuming keys until
  // the list closes, so navigation cannot happen behind the dialog.
  await page.keyboard.press("?");
  const help = page.getByRole("dialog", { name: "Shortcuts" });
  await expect(help).toBeVisible();
  await expect(help).toContainText("Previous move");
  await expect(help).toContainText("Next move");
  await page.keyboard.press("ArrowRight");
  await expect(status).toContainText("Starting position");
  await page.keyboard.press("Escape");
  await expect(help).toHaveCount(0);

  // A control that owns the arrow keys keeps them: the board must not move.
  await page.locator(".board-controls > summary").click();
  const slider = page.getByRole("slider", { name: "Board size" });
  await slider.focus();
  const sliderValue = await slider.inputValue();
  await page.keyboard.press("ArrowRight");
  await expect(slider).not.toHaveValue(sliderValue);
  await expect(status).toContainText("Starting position");
  await page.keyboard.press("Escape");

  // Escape also leaves a temporary variation, which is now part of the same map.
  await page.locator('[data-square="d2"]').click();
  await page.locator('[data-square="d4"]').click();
  await expect(page.getByText(/Analysis variation · d4/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText(/Analysis variation/)).toHaveCount(0);
});

test("keeps the desktop board size under the visitor's control", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openReview(page);
  const workspace = page.locator(".review-workspace");
  const automatic = await boardWidth(page);

  await page.locator(".board-controls > summary").click();
  const slider = page.getByRole("slider", { name: "Board size" });
  // The control reports what the layout granted, not what was requested.
  await expect(slider).toHaveValue(String(automatic));
  await expect(page.locator(".board-size-row small")).toContainText(`Automatic · ${automatic} px`);

  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(workspace).toHaveAttribute("style", /--review-board-preference: \d+px/);
  await expect.poll(() => boardWidth(page)).toBeGreaterThan(automatic);
  const grown = await boardWidth(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // The size survives a reload because it is a stored preference.
  await page.reload();
  await expect(page.getByRole("region", { name: "Persistent board workspace" })).toBeVisible();
  await expect.poll(() => boardWidth(page)).toBe(grown);

  // Returning to the automatic size clears the preference for good.
  await page.locator(".board-controls > summary").click();
  await page.getByRole("button", { name: "Use the automatic size" }).click();
  await expect(workspace).not.toHaveAttribute("style", /--review-board-preference/);
  await expect.poll(() => boardWidth(page)).toBe(automatic);
  await page.reload();
  await expect(page.getByRole("region", { name: "Persistent board workspace" })).toBeVisible();
  await expect(page.locator(".review-workspace")).not.toHaveAttribute("style", /--review-board-preference/);
  expect(await boardWidth(page)).toBe(automatic);

  // Narrow layouts stay responsive and hide a control that could not apply.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".board-controls")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("publishes the same shortcut list on Help", async ({ page }) => {
  await page.goto("/help");
  const section = page.locator("#shortcuts");
  await expect(section).toBeVisible();
  await expect(section.locator("dl > div")).toHaveCount(REVIEW_SHORTCUTS.length);
  await expect(section).toContainText("Previous move");
  await expect(section).toContainText("← / J");
  await expect(section).toContainText("exit focus board");
});

test("focus board maximizes the board and keeps an obvious exit", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openReview(page);
  const workspace = page.locator(".review-workspace");
  const panel = page.locator(".context-panel");
  await expect(panel).toBeVisible();
  const normal = await boardWidth(page);

  await page.keyboard.press("z");
  await expect(workspace).toHaveClass(/focus-board/);
  await expect(panel).toBeHidden();
  await expect(page.getByRole("button", { name: "Exit focus board" })).toBeVisible();
  await expect.poll(() => boardWidth(page)).toBeGreaterThan(normal);
  // The board stays usable: transport and player strips are kept.
  await expect(page.getByRole("button", { name: "Next move" })).toBeVisible();
  await expect(page.locator(".player-strip").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.keyboard.press("Escape");
  await expect(workspace).not.toHaveClass(/focus-board/);
  await expect(panel).toBeVisible();
  await expect.poll(() => boardWidth(page)).toBe(normal);

  await page.getByRole("button", { name: "Focus board" }).click();
  await expect(workspace).toHaveClass(/focus-board/);
  // Focus is session state: a reload returns to the normal workspace.
  await page.reload();
  await expect(page.getByRole("region", { name: "Persistent board workspace" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Focus board" })).toBeVisible();
  await expect(workspace).not.toHaveClass(/focus-board/);
});
