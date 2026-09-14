import { expect, test } from "@playwright/test";
import { seedReview, writeStores } from "./fixtures";

/* Guided review: key-moment navigation, the practice handoff with a hint, and
   the end-of-review state.
 *
 * The fixture seeds one key moment — a Black blunder on ply 2 worth 28% win
 * probability. It is patched the same way `mistake-practice.spec.ts` patches its
 * faults, because a practisable moment needs canonical engine evidence for a
 * better move than the one played. */

async function openGuidedReview(page: import("@playwright/test").Page) {
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
  // The seeded game stays inside the opening structurally, so the completion
  // lesson needs a divider that actually split the game to have anything to say.
  fixture.analysis.division = { totalPlies: fixture.analysis.division.totalPlies, middlePly: 11 };
  fixture.analysis.white.phaseAccuracy = { opening: 92, middlegame: 60 };
  await writeStores(page, { "objective-analyses": [[fixture.cacheKey, fixture.analysis]] });

  await page.goto(`/review/${fixture.record.id}`);
  await expect(page.getByRole("region", { name: "Persistent board workspace" })).toBeVisible();
  await expect(page.locator(".key-moment-nav")).toBeVisible();
  return fixture;
}

test("navigates the key moments and says where the visitor is", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuidedReview(page);
  const progress = page.locator(".key-moment-progress");
  const previous = page.getByRole("button", { name: "← Previous key moment" });
  const next = page.getByRole("button", { name: "Next key moment →" });

  // The board starts before the first moment.
  await expect(progress).toHaveText("1 key moment · 0 seen");
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();

  await next.click();
  await expect(page.locator(".move-status")).toContainText("1… e5");
  await expect(progress).toHaveText("Moment 1 of 1");
  await expect(next).toBeDisabled();

  // The visitor is never locked in: any move is still reachable directly.
  await page.getByRole("button", { name: "Last position" }).click();
  await expect(progress).toHaveText("1 key moment · 1 seen");
  await expect(previous).toBeEnabled();
  await previous.click();
  await expect(progress).toHaveText("Moment 1 of 1");
});

test("practises a key moment with a hint before the answer", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuidedReview(page);
  await page.getByRole("button", { name: "Next key moment →" }).click();

  const action = page.locator(".key-moment-action");
  await expect(action).toContainText("1… e5");
  await expect(action).toContainText("Blunder");
  await action.getByRole("button", { name: "Try again" }).click();

  const practice = page.getByRole("region", { name: "Learn from your mistakes" });
  await expect(practice).toContainText("1 / 1");
  // The guided action stays out of the way while the visitor is solving.
  await expect(page.locator(".key-moment-nav")).toHaveCount(0);
  await expect(practice).not.toContainText(/Best was/);

  // The hint names the piece to move, marks the square, and keeps the answer hidden.
  await practice.getByRole("button", { name: "Hint" }).click();
  await expect(practice.locator(".retro-hint")).toContainText("Look at the piece on");
  await expect(practice.getByRole("button", { name: "Hint" })).toHaveCount(0);
  const hintSquare = (await practice.locator(".retro-hint strong").textContent())?.trim() ?? "";
  expect(hintSquare).toBe("b8");
  await expect(page.locator(`[data-square="${hintSquare}"] > div`)).toHaveAttribute("style", /inset 0 0 0 4px var\(--accent-brass\)/);
  await expect(practice).not.toContainText(/Best was/);

  await practice.getByRole("button", { name: "View the solution" }).click();
  await expect(practice).toContainText("Best was Nc6");
  await practice.getByRole("button", { name: "Exit" }).click();
  await expect(page.locator(".key-moment-nav")).toBeVisible();

  // A hinted position is reported as hinted, never as solved, even after the
  // solution was viewed.
  await page.locator(".key-moment-finish").getByRole("button", { name: /Finish review/ }).click();
  const completion = page.getByRole("region", { name: "Review complete" });
  await expect(completion).toContainText("Solved 0, hinted 1.");
  await expect(completion).toContainText("A hinted position is not counted as solved.");
});

test("ends the review with canonical facts and a next step", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuidedReview(page);
  const finish = page.locator(".key-moment-finish");
  await expect(finish.getByRole("button", { name: "Finish review early" })).toBeVisible();

  await page.getByRole("button", { name: "Next key moment →" }).click();
  await expect(finish).toContainText("You have seen every key moment.");
  await finish.getByRole("button", { name: "Finish review" }).click();

  const completion = page.getByRole("region", { name: "Review complete" });
  await expect(completion).toContainText("1 key moment reviewed");
  await expect(completion).toContainText("Most important mistake");
  await expect(completion).toContainText("gave up 28.0% win probability");
  await expect(completion).toContainText("Best moment");
  await expect(completion).toContainText("Middlegame was the lowest-scoring phase: White Accuracy 60.0.");
  await expect(completion).toContainText("No position from this game is in Training yet.");
  await expect(completion.getByRole("link", { name: "Open Training" })).toHaveAttribute("href", "/training");
  await expect(completion.getByRole("link", { name: "Study this game" })).toBeVisible();

  // The summary is a state, not a trap: the guided navigation returns.
  await completion.getByRole("button", { name: "Back to key moments" }).click();
  await expect(page.locator(".key-moment-nav")).toBeVisible();
});
