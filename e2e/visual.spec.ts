import { expect, test } from "@playwright/test";
import { mockLocalAi, openReviewTimeline, seedConnectedLibrary, seedReview } from "./fixtures";

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

/**
 * A screenshot must never catch a transition mid-flight. The review panel's mode
 * change is a 180–320ms entrance, so without this the baseline would depend on
 * machine speed and the same commit would fail its own snapshot on a slow run.
 */
async function settle(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== "running"));
}

test("representative Phase 5.3 workspace states", async ({ page }) => {
  await mockLocalAi(page, "available");
  const { record } = await seedReview(page, { visualLabels: true });
  await seedConnectedLibrary(page, 84);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await settle(page);
  await expect(page).toHaveScreenshot("home-connected-1440.png");

  await page.setViewportSize({ width: 1728, height: 1117 });
  await page.goto(`/review/${record.id}`);
  await openReviewTimeline(page);
  await page.getByRole("button", { name: "Go to ply 1, Brilliant" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  await expect(page).toHaveScreenshot("review-white-brilliant-stockfish-1728.png");

  await page.getByRole("button", { name: "Go to ply 2, Blunder" }).click();
  await page.getByRole("button", { name: "Flip board" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  await expect(page).toHaveScreenshot("review-black-blunder-1728.png");

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole("button", { name: "First position" }).click();
  await dragChessPiece(page, "d2", "d4");
  await settle(page);
  await expect(page).toHaveScreenshot("analysis-variation-1920.png");
  await page.locator(".position-workspace .return-to-game").click();

  await page.setViewportSize({ width: 1440, height: 900 });
  // Load the game again and step to ply 2 from the timeline: whether the earlier
  // jump recorded the moment as viewed is state the panel keeps, so the snapshot
  // must not depend on how the previous step left it.
  await page.goto(`/review/${record.id}`);
  await openReviewTimeline(page);
  await page.getByRole("button", { name: "Go to ply 2, Blunder" }).click();
  await page.getByRole("button", { name: "Stockfish" }).click();
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.getByText("Stockfish and Maia recommend the same move")).toBeVisible();
  // Same reason as the two states above: the document scroll must be part of the
  // baseline's input, not whatever the previous step left behind.
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  await expect(page).toHaveScreenshot("combined-stockfish-maia-1440.png");

  await page.setViewportSize({ width: 1728, height: 1117 });
  await page.goto(`/review/${record.id}/coach?ply=2`);
  await page.getByRole("button", { name: "Explain e5" }).click();
  await expect(page.getByText(/Deterministic fallback used/)).toBeVisible();
  await page.getByRole("button", { name: "Build whole-game study" }).click();
  await expect(page.locator(".game-coach-result")).toContainText("Practice recommendations");
  await settle(page);
  await expect(page).toHaveScreenshot("coach-grounded-fallback-1728.png");

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/history");
  await expect(page.locator(".history-list > article, .history-list > a")).toHaveCount(60);
  await settle(page);
  await expect(page).toHaveScreenshot("library-1920.png");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/design/quality-icons");
  await expect(page.locator(".quality-fixture-grid > section")).toHaveCount(14);
  await settle(page);
  await expect(page).toHaveScreenshot("quality-icons-v3-1440.png", { fullPage: true });

  await page.goto("/design/pieces");
  // Rendering and recognition passes are asserted in `piece-fixture.spec.ts`;
  // this suite owns the full-page screenshot baseline.
  await expect(page.locator(".piece-fixture-row")).toHaveCount(48);
  await settle(page);
  await expect(page).toHaveScreenshot("pieces-windowlight-1440.png", { fullPage: true });
});
