import { expect, test } from "@playwright/test";
import { mockLocalAi, seedConnectedLibrary, seedReview } from "./fixtures";

async function dragChessPiece(page: import("@playwright/test").Page, fromSquare: string, toSquare: string) {
  const source = page.locator(`[data-square="${fromSquare}"]`).getByRole("button");
  const target = page.locator(`[data-square="${toSquare}"]`);
  const [sourceBox, targetBox] = await Promise.all([source.boundingBox(), target.boundingBox()]);
  if (!sourceBox || !targetBox) throw new Error(`Cannot drag ${fromSquare} to ${toSquare}: square is not visible.`);
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 12, sourceBox.y + sourceBox.height / 2 + 12, { steps: 4 });
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 16 });
  await page.mouse.up();
}

test("representative Phase 5.1 workspace states", async ({ page }) => {
  await mockLocalAi(page, "available");
  const { record } = await seedReview(page, { visualLabels: true });
  await seedConnectedLibrary(page, 84);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page).toHaveScreenshot("home-connected-1440.png");

  await page.setViewportSize({ width: 1728, height: 1117 });
  await page.goto(`/review/${record.id}`);
  await page.getByRole("button", { name: "Go to ply 1, Brilliant" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("review-white-brilliant-stockfish-1728.png");

  await page.getByRole("button", { name: "Go to ply 2, Blunder" }).click();
  await page.getByRole("button", { name: "Flip board" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("review-black-blunder-1728.png");

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole("button", { name: "First position" }).click();
  await dragChessPiece(page, "d2", "d4");
  await expect(page).toHaveScreenshot("analysis-variation-1920.png");
  await page.locator(".position-workspace .return-to-game").click();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Maia" }).click();
  await expect(page.getByText("Stockfish and Maia recommend the same move")).toBeVisible();
  await expect(page).toHaveScreenshot("combined-stockfish-maia-1440.png");

  await page.setViewportSize({ width: 1728, height: 1117 });
  await page.goto(`/review/${record.id}/coach`);
  await page.getByRole("button", { name: "Go to ply 2, Blunder" }).click();
  await page.getByRole("button", { name: "讲解 e5" }).click();
  await expect(page.getByText(/已使用确定性中文回退/)).toBeVisible();
  await expect(page).toHaveScreenshot("coach-grounded-fallback-1728.png");

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/history");
  await expect(page.locator(".history-list > article, .history-list > a")).toHaveCount(60);
  await expect(page).toHaveScreenshot("library-1920.png");
});
