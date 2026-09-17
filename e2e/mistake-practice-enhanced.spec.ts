import { expect, test } from "@playwright/test";
import { mockLocalAi, seedReview, writeStores } from "./fixtures";

// Enhanced Local only. This spec deliberately does NOT run in
// `playwright.release.config.ts`: that suite exercises the public Browser Core
// production build, which by design never probes a visitor's local AI services,
// so no Maia request can ever fire there. It runs under the development config,
// where the local service is part of the product surface.
test.use({ serviceWorkers: "block" });

async function play(page: import("@playwright/test").Page, from: string, to: string) {
  await page.locator(`.board-wrap [data-square="${from}"]`).first().click();
  await page.locator(`.board-wrap [data-square="${to}"]`).first().click();
}

test("records the fault's human facts in a real Enhanced Local run", async ({ page }) => {
  // The explanation depends on Maia facts for the fault move. Practice holds the
  // board on the position BEFORE the fault, so without pointing the human request
  // at the fault itself that evidence is never fetched and the headline feature
  // would be silently dead. Measured: the move review only fires once practice is
  // active, because at ply 0 there is no current move to review.
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockLocalAi(page, "available", { positionCandidates: ["d2d4", "g1f3"] });
  const fixture = await seedReview(page);
  const fault = fixture.analysis.moves[8]!;
  fault.quality = "mistake";
  fault.stockfish = { fen: fault.fenBefore, depth: 12, score: { kind: "cp", cp: 22 }, bestMove: "d2d4", lines: [
    { rank: 1, depth: 12, score: { kind: "cp", cp: 22 }, pv: ["d2d4", "d7d5"] },
  ] };
  fixture.analysis.moves.forEach((item, index) => { if (index !== 8) { item.quality = "best"; item.annotations = []; } });
  await writeStores(page, { "objective-analyses": [[fixture.cacheKey, fixture.analysis]] });
  await page.goto(`/review/${fixture.record.id}`);

  const moveReviews: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/maia/move-review")) moveReviews.push(request.url()); });

  await page.getByRole("button", { name: "Maia · " }).first().click();
  await page.getByRole("button", { name: /Practice (White|Black)'s \d+ positions?/ }).click();
  await expect(page.locator(".retro-practice")).toContainText("Find a better move");

  // The fault's own review must be requested once practice holds its position; at
  // ply 0 there is no current move to review, so this only happens here.
  await expect.poll(() => moveReviews.length, { timeout: 30_000 }).toBeGreaterThan(0);

  await play(page, "d2", "d4");
  await expect(page.locator(".retro-practice")).toContainText("That move keeps the position");
  await expect(page.locator(".retro-practice").locator(".retro-human")).toContainText("Why the original move felt natural", { timeout: 30_000 });
});

