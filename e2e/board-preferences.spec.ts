import { expect, test } from "@playwright/test";
import { arrowCount } from "./arrow-helpers";
import { seedReview } from "./fixtures";

/* Board feedback preferences. Each one is asserted on the real board, because a
   setting that is stored but not applied is worse than no setting at all. */

async function openReview(page: import("@playwright/test").Page, id: string) {
  await page.goto(`/review/${id}`);
  await expect(page.getByRole("region", { name: "Persistent board workspace" })).toBeVisible();
  await expect(page.locator(".board-wrap img").first()).toBeVisible();
}

test("board display preferences apply to the review board and persist", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { record } = await seedReview(page, { visualLabels: true });

  // Defaults: coordinates inside, arrows drawn, badge shown.
  await openReview(page, record.id);
  await expect(page.locator('[data-square="a1"]')).toContainText("a");
  expect(await arrowCount(page)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Next move" }).click();
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator(".board-quality-badge")).toHaveCount(1);

  await page.goto("/settings");
  await page.getByLabel("Coordinates").selectOption("off");
  await page.getByRole("checkbox", { name: "Analysis arrows" }).uncheck();
  await page.getByRole("checkbox", { name: "Move Quality badge on the board" }).uncheck();

  await openReview(page, record.id);
  await expect(page.locator('[data-square="a1"]')).toBeEmpty();
  expect(await arrowCount(page)).toBe(0);
  await page.getByRole("button", { name: "Next move" }).click();
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator(".move-status")).toContainText("1… e5");
  await expect(page.locator(".board-quality-badge")).toHaveCount(0);

  // The preferences survive a reload rather than only the current session.
  await page.reload();
  await expect(page.getByRole("region", { name: "Persistent board workspace" })).toBeVisible();
  await expect(page.locator('[data-square="a1"]')).toBeEmpty();
  expect(await arrowCount(page)).toBe(0);

  // Turning them back on restores the default board.
  await page.goto("/settings");
  await page.getByLabel("Coordinates").selectOption("inside");
  await page.getByRole("checkbox", { name: "Analysis arrows" }).check();
  await page.getByRole("checkbox", { name: "Move Quality badge on the board" }).check();
  await openReview(page, record.id);
  await expect(page.locator('[data-square="a1"]')).toContainText("a");
  expect(await arrowCount(page)).toBeGreaterThan(0);
});

test("move list emphasis calms non-key moves without hiding them", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { record } = await seedReview(page, { visualLabels: true });

  // The seeded fixture marks exactly one key moment (ply 2) out of 21 plies.
  await openReview(page, record.id);
  const rows = page.locator(".review-move-list button");
  await expect(rows).toHaveCount(21);
  await expect(page.locator('.review-move-list button[data-emphasis="quiet"]')).toHaveCount(20);

  await page.goto("/settings");
  await page.getByLabel("Move list emphasis").selectOption("all");
  await openReview(page, record.id);
  await expect(page.locator(".review-move-list button")).toHaveCount(21);
  await expect(page.locator('.review-move-list button[data-emphasis="quiet"]')).toHaveCount(0);

  // Every row keeps its Accuracy even when it is drawn quietly.
  await page.goto("/settings");
  await page.getByLabel("Move list emphasis").selectOption("key");
  await openReview(page, record.id);
  const quiet = page.locator('.review-move-list button[data-emphasis="quiet"]').first();
  await expect(quiet).toBeVisible();
  await expect(quiet.locator("small")).not.toBeEmpty();
});

test("the Moves filter names the key moments in the visitor's language", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { record } = await seedReview(page, { visualLabels: true });
  await page.goto(`/review/${record.id}/moves`);
  const filters = page.locator(".move-filters");
  await expect(filters.getByRole("button")).toHaveText(["All", "Key", "Errors"]);

  await filters.getByRole("button", { name: "Key" }).click();
  await expect(page.locator(".review-move-list button")).toHaveCount(1);
  await expect(page.locator(".review-move-list")).toContainText("e5");
  await filters.getByRole("button", { name: "All" }).click();
  await expect(page.locator(".review-move-list button")).toHaveCount(21);
});
