import { expect, test } from "@playwright/test";
import { mockLocalAi, openReviewMore, openReviewTimeline, seedReview } from "./fixtures";

test("capture review second cut", async ({ page }) => {
  await mockLocalAi(page, "available");
  const { record } = await seedReview(page, { visualLabels: true });
  await page.setViewportSize({ width: 1728, height: 1117 });
  await page.goto(`/review/${record.id}`);
  await openReviewMore(page);
  await expect(page.getByRole("link", { name: "Engine", exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/review-cut2-overview.png" });
  await openReviewTimeline(page);
  await page.getByRole("button", { name: "Go to ply 2, Blunder" }).click();
  await page.screenshot({ path: "/tmp/review-cut2-overview-move.png" });
  await page.waitForTimeout(1200);

  await page.goto(`/review/${record.id}/moves`);
  await expect(page.locator(".review-move-list")).toBeVisible();
  await page.screenshot({ path: "/tmp/review-cut2-moves.png" });

  await page.goto(`/review/${record.id}/coach`);
  await expect(page.locator(".coach-game-facts, .coach-move-facts")).toBeVisible();
  await page.screenshot({ path: "/tmp/review-cut2-study.png" });
  await page.goto(`/review/${record.id}/coach?ply=2`);
  await expect(page.locator(".coach-move-facts")).toBeVisible();
  await page.screenshot({ path: "/tmp/review-cut2-study-move.png" });

  await page.goto(`/review/${record.id}/engine`);
  await expect(page.getByRole("link", { name: "Engine", exact: true })).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: "/tmp/review-cut2-engine.png" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/review/${record.id}`);
  await page.screenshot({ path: "/tmp/review-cut2-390.png" });
});
