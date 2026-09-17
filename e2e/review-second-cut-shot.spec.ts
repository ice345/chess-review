import { expect, test } from "@playwright/test";
import { mockLocalAi, openReviewMore, openReviewTimeline, seedReview } from "./fixtures";

test("capture review second cut", async ({ page }) => {
  await mockLocalAi(page, "available");
  const { record } = await seedReview(page, { visualLabels: true });
  await page.setViewportSize({ width: 1728, height: 1117 });
  await page.goto(`/review/${record.id}`);
  await openReviewMore(page);
  await expect(page.getByRole("navigation", { name: "Review sections" }).getByRole("link", { name: "Analysis", exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/review-cut2-overview.png" });
  await openReviewTimeline(page);
  await page.getByRole("button", { name: "Go to ply 2, Blunder" }).click();
  await page.screenshot({ path: "/tmp/review-cut2-overview-move.png" });
  await page.waitForTimeout(1200);

  await page.goto(`/review/${record.id}/moves`);
  await expect(page.locator(".review-move-list")).toBeVisible();
  await page.screenshot({ path: "/tmp/review-cut2-moves.png" });

  // Study leads with an action; the grounded lesson appears once it is asked for.
  await page.goto(`/review/${record.id}/coach`);
  await page.getByRole("button", { name: /Build whole-game study|Review the game from facts/ }).click();
  await expect(page.locator(".coach-result, .game-coach-result")).toBeVisible();
  await page.screenshot({ path: "/tmp/review-cut2-study.png" });
  await page.goto(`/review/${record.id}/coach?ply=2`);
  await page.getByRole("button", { name: /Explain |Review .* from facts/ }).click();
  await expect(page.locator(".coach-result")).toBeVisible();
  await page.screenshot({ path: "/tmp/review-cut2-study-move.png" });

  await page.goto(`/review/${record.id}/engine`);
  await openReviewMore(page);
  await expect(page.getByRole("navigation", { name: "Review sections" }).getByRole("link", { name: "Analysis", exact: true })).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: "/tmp/review-cut2-engine.png" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/review/${record.id}`);
  await page.screenshot({ path: "/tmp/review-cut2-390.png" });
});
