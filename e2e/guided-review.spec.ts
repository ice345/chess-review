import { expect, test } from "@playwright/test";
import { seedReview, writeStores } from "./fixtures";

/* Guided review: key-moment navigation, the practice handoff with a hint, and
   the end-of-review state.
 *
 * The fixture seeds one key moment — a Black blunder on ply 2 worth 28% win
 * probability. It is patched the same way `mistake-practice.spec.ts` patches its
 * faults, because a practisable moment needs canonical engine evidence for a
 * better move than the one played. */

function reviewEnd(page: import("@playwright/test").Page) {
  return page.getByRole("region", { name: /Review (complete|summary)/ });
}

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
  fixture.analysis.black.phaseAccuracy = { opening: 95, middlegame: 88 };
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
  const first = page.getByRole("button", { name: "First key moment" });

  await expect(progress).toHaveText("1 key moment · 0 seen");
  await expect(page.getByRole("button", { name: "← Previous key moment" })).toHaveCount(0);
  await expect(first).toBeEnabled();

  await first.click();

  await expect(page.locator(".move-status")).toContainText("1… e5");
  await expect(progress).toHaveText("Moment 1 of 1");
  const previous = page.getByRole("button", { name: "← Previous key moment" });
  const next = page.getByRole("button", { name: "Next key moment →" });
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
  await page.getByRole("button", { name: "First key moment" }).click();


  // Guided navigation offers the moment blind: the answer stays withheld until the
  // visitor chooses to solve it or to reveal it.
  const action = page.locator(".key-moment-action");
  await expect(action).toContainText("Solve this position before seeing what the engine says about it.");
  await expect(action).not.toContainText("Blunder");
  await expect(page.locator(".objective-route > .dual-verdict")).toHaveCount(0);
  await expect(page.locator(".objective-route > .position-analysis")).toHaveCount(0);

  await action.getByRole("button", { name: "Try it" }).click();
  // Concealed, not exposed: a solve here is a first-time find.
  await expect(page.locator(".retro-practice")).not.toContainText("Review practice");

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
  const completion = reviewEnd(page);
  await expect(completion).toContainText("Solved 0, hinted 1.");
  await expect(completion).toContainText("A hinted position is not counted as solved.");
  // A blind attempt is not a review of an answer that was already on screen.
  await expect(completion).not.toContainText("followed a position whose analysis you had already seen");
});

test("keeps guided progress across routes and a refresh", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuidedReview(page);
  await page.getByRole("button", { name: "First key moment" }).click();

  await expect(page.locator(".key-moment-progress")).toHaveText("Moment 1 of 1");

  // Step off the moment, so a session that reset would be visible.
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator(".key-moment-progress")).toHaveText("1 key moment · 1 seen");

  // Scope to the review's own section nav: the rail also has a Review row.
  const sections = page.getByRole("navigation", { name: "Review sections" });
  await sections.getByRole("link", { name: "Study", exact: true }).click();
  await sections.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page.locator(".key-moment-progress")).toHaveText("1 key moment · 1 seen");

  await page.reload();
  await expect(page.locator(".key-moment-progress")).toHaveText("1 key moment · 1 seen");
});

test("marks practice that follows an answer the visitor already saw", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuidedReview(page);

  await page.getByRole("button", { name: "First key moment" }).click();

  const action = page.locator(".key-moment-action");
  // Choosing to look retires the blind offer and shows the analysis.
  await action.getByRole("button", { name: "Show the analysis" }).click();
  await expect(page.locator(".objective-route > .dual-verdict")).toBeVisible();
  await expect(action).toContainText("Blunder");

  await action.getByRole("button", { name: "Try again" }).click();
  const practice = page.getByRole("region", { name: "Learn from your mistakes" });
  await expect(practice).toContainText("Review practice");
  await expect(practice).toContainText("already seen this position");
  await expect(practice).not.toContainText(/Best was/);

  // The analysis exports contain the answer, so they wait for the attempt.
  await page.getByText("Export", { exact: true }).click();
  const canonicalJson = page.getByRole("button", { name: "Canonical JSON" });
  await expect(canonicalJson).toBeDisabled();
  await expect(page.getByText("Analysis exports are withheld while you solve this position.")).toBeVisible();
  await page.getByText("Export", { exact: true }).click();

  await practice.getByRole("button", { name: "View the solution" }).click();
  await practice.getByRole("button", { name: "Exit" }).click();
  await page.getByText("Export", { exact: true }).click();
  await expect(canonicalJson).toBeEnabled();
  await page.getByText("Export", { exact: true }).click();

  await page.locator(".key-moment-finish").getByRole("button", { name: /Finish review/ }).click();
  const completion = reviewEnd(page);
  await expect(completion).toContainText("1 of them followed a position whose analysis you had already seen");
});

test("adds this game's positions to Training from the end of the review", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuidedReview(page);
  await page.locator(".key-moment-finish").getByRole("button", { name: /Finish review/ }).click();
  const completion = reviewEnd(page);

  // The manual import has no learner, so the visitor names the side; the offer
  // starts on the side that actually recorded a trainable position.
  await expect(completion.getByRole("button", { name: "Black" })).toHaveAttribute("aria-pressed", "true");
  await expect(completion).toContainText("1 position will join 1 practice task");
  await completion.getByRole("button", { name: "Add this position to Practice" }).click();

  await expect(completion).toContainText("Added 1 position to 1 task");
  await expect(completion).toContainText("1 position from this game is already in Practice across 1 task");
  await expect(completion.getByRole("link", { name: "Open the task →" })).toHaveAttribute("href", /^\/training\?player=manual%3A/);
  await expect(completion.getByRole("button", { name: /Add .* to Practice/ })).toHaveCount(0);
});

test("counts what was actually viewed when the review ends early", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuidedReview(page);
  // The board starts before the only moment, so nothing has been viewed yet.
  await page.locator(".key-moment-finish").getByRole("button", { name: "Finish review early" }).click();

  const completion = reviewEnd(page);
  await expect(completion).toContainText("0 of 1 key moment viewed");
  await expect(completion).toContainText("1 moment is still unseen");
  await expect(completion).not.toContainText(/reviewed/);

  // The state is not a trap: continuing returns to the same place in the tour.
  await completion.getByRole("button", { name: "Back to key moments" }).click();
  await expect(page.locator(".key-moment-progress")).toHaveText("1 key moment · 0 seen");
});

test("names a key-moment icon by the move's own label", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuidedReview(page);
  await page.locator(".game-summary-section > summary").click();
  // The only key moment is a blunder, so its icon must not read as "Critical".
  const icon = page.locator(".critical-list button").first().getByRole("img");
  await expect(icon).toHaveAccessibleName("Blunder");
});

test("ends the review with canonical facts and a next step", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuidedReview(page);
  await page.getByRole("button", { name: "First key moment" }).click();
  const finish = page.locator(".key-moment-finish");


  await expect(finish).toContainText("You have seen every key moment.");
  await finish.getByRole("button", { name: "Finish review" }).click();

  const completion = reviewEnd(page);
  await expect(completion).toHaveAccessibleName("Review complete");
  await expect(completion).toContainText("The only key moment was viewed");
  // The record is a manual import, so the summary covers both sides and states
  // the mover instead of pretending one of them is the visitor.
  await expect(completion).toContainText("Most important mistake");
  await expect(completion).toContainText("1… e5");
  await expect(completion).toContainText("gave up 28.0% win probability");
  await expect(completion).toContainText("Worth another look");
  await expect(completion).toContainText("White's middlegame was the lowest-scoring phase in this game: Accuracy 60.0.");
  await expect(completion).toContainText("No position from this game is in Practice yet.");
  await expect(completion.getByRole("link", { name: "Open Practice" })).toHaveAttribute("href", "/training");
  await expect(completion.getByRole("link", { name: "Study this game" })).toBeVisible();
  await expect(completion.locator(".bluebird-motif")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/bluebird-revision/review-complete-1440.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/bluebird-revision/review-complete-390.png" });
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflowX, "phone review must not scroll sideways").toBe(0);
  await page.setViewportSize({ width: 1440, height: 900 });

  // The summary is a state, not a trap: the guided navigation returns.
  await completion.getByRole("button", { name: "Back to key moments" }).click();
  await expect(page.locator(".key-moment-nav")).toBeVisible();
});

test("clicking next move does not scroll the document", async ({ page }) => {
  const { record } = await seedReview(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/review/${record.id}`);
  const next = page.getByRole("button", { name: "Next move" });
  await expect(next).toBeVisible();
  await next.click();
  const before = await page.evaluate(() => ({ y: window.scrollY, top: document.querySelector(".move-transport")?.getBoundingClientRect().top ?? 0 }));
  await next.click();
  await page.screenshot({ path: "/tmp/bluebird-revision/review-after-next.png" });
  await next.click();
  const after = await page.evaluate(() => ({ y: window.scrollY, top: document.querySelector(".move-transport")?.getBoundingClientRect().top ?? 0 }));
  expect(after.y).toBe(before.y);
  expect(Math.abs(after.top - before.top)).toBeLessThan(2);
});
