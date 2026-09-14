import { expect, test } from "@playwright/test";
import { goToReviewMoreSection, seedReview, writeStores } from "./fixtures";

/* Opening Explorer: a deliberately network-backed panel.
 *
 * The endpoint is always mocked here — the product contract under test is what
 * the panel does with a valid payload, an empty position and a rate limit, what
 * it tells the visitor about the request it makes, and that it stays away while a
 * practice answer is owed. */

const EXPLORER_PAYLOAD = {
  position: {
    version: 1,
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
    source: "lichess",
    totalGames: 1_234_567,
    white: 500_000,
    draws: 400_000,
    black: 334_567,
    whitePercent: 40.5,
    drawPercent: 32.4,
    blackPercent: 27.1,
    moves: [
      { uci: "e2e4", san: "e4", games: 600_000, white: 300_000, draws: 200_000, black: 100_000, whitePercent: 50, drawPercent: 33.3, blackPercent: 16.7 },
      { uci: "d2d4", san: "d4", games: 400_000, white: 150_000, draws: 150_000, black: 100_000, whitePercent: 37.5, drawPercent: 37.5, blackPercent: 25 },
    ],
    opening: { eco: "C20", name: "King's Pawn Game" },
  },
};

test("shows position frequencies with their source, age and privacy note", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requests: string[] = [];
  await page.route("**/api/explorer*", async (request) => {
    requests.push(request.request().url());
    await request.fulfill({ json: EXPLORER_PAYLOAD });
  });
  const { record } = await seedReview(page, { visualLabels: true });
  await page.goto(`/review/${record.id}/engine`);
  await page.getByRole("tab", { name: "Explorer" }).click();

  const panel = page.getByRole("region", { name: "Opening explorer" });
  await expect(panel).toContainText("1,234,567");
  await expect(panel).toContainText("All players games");
  await expect(panel).toContainText("C20 · King's Pawn Game");
  await expect(panel).toContainText("fetched just now");
  await expect(panel).toContainText("sends the current position to lichess.org");

  // Rows carry the SAN, the game count and the score split, in frequency order.
  const rows = panel.locator(".explorer-moves button");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("e4");
  await expect(rows.nth(0)).toContainText("600,000");
  await expect(rows.nth(0)).toContainText("W 50% D 33.3% B 16.7%");
  await expect(rows.nth(1)).toContainText("d4");

  // The request carries only the position and the database.
  expect(requests).toHaveLength(1);
  const requested = new URL(requests[0]!);
  expect(requested.pathname).toBe("/api/explorer");
  expect(requested.searchParams.get("fen")).toContain("rnbqkbnr");
  expect(requested.searchParams.get("source")).toBe("lichess");
  expect([...requested.searchParams.keys()].sort()).toEqual(["fen", "source"]);

  // Selecting a move explores it on the board as a variation.
  await rows.nth(0).click();
  await expect(page.getByText(/Analysis variation · e4/)).toBeVisible();
});

test("switches database, reports an empty position, and never invents games", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const sources: string[] = [];
  const { record } = await seedReview(page, { visualLabels: true });
  await page.route("**/api/explorer*", async (request) => {
    const url = new URL(request.request().url());
    sources.push(url.searchParams.get("source") ?? "");
    if (url.searchParams.get("source") === "masters") {
      await request.fulfill({ json: { position: { ...EXPLORER_PAYLOAD.position, source: "masters", totalGames: 0, white: 0, draws: 0, black: 0, whitePercent: 0, drawPercent: 0, blackPercent: 0, moves: [] } } });
      return;
    }
    await request.fulfill({ json: EXPLORER_PAYLOAD });
  });
  await page.goto(`/review/${record.id}/engine`);
  await page.getByRole("tab", { name: "Explorer" }).click();
  const panel = page.getByRole("region", { name: "Opening explorer" });
  await expect(panel).toContainText("1,234,567");

  await panel.getByRole("button", { name: "Masters" }).click();
  await expect(panel).toContainText("No games in this database reached this position.");
  await expect(panel.locator(".explorer-moves")).toHaveCount(0);
  expect(sources).toContain("masters");

  // A failed request states the failure instead of showing an empty table. The
  // position changes first: a fresh cached answer is served without a request,
  // which is the point of the cache.
  await page.route("**/api/explorer*", async (request) => {
    await request.fulfill({ status: 429, json: { error: "The opening explorer is rate limiting requests. Try again shortly." } });
  });
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(panel.getByRole("alert")).toContainText("rate limiting");
});

test("keeps the explorer away while a practice answer is owed", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/explorer*", async (request) => request.fulfill({ json: EXPLORER_PAYLOAD }));
  const fixture = await seedReview(page, { visualLabels: true });
  // Make the seeded blunder practisable, as `mistake-practice.spec.ts` does.
  const fault = fixture.analysis.moves[1]!;
  fault.quality = "mistake";
  fault.classificationReason = { ...fault.classificationReason, isBook: false };
  fault.stockfish = {
    fen: fault.fenBefore,
    depth: 12,
    score: { kind: "cp", cp: 22 },
    bestMove: "b8c6",
    lines: [{ rank: 1, depth: 12, score: { kind: "cp", cp: 22 }, pv: ["b8c6"] }],
  };
  await writeStores(page, { "objective-analyses": [[fixture.cacheKey, fixture.analysis]] });

  await page.goto(`/review/${fixture.record.id}`);
  await page.getByRole("group", { name: "Which side to practise" }).getByRole("button", { name: "Black" }).click();
  await page.getByRole("button", { name: /Review Black's 1 position/ }).click();
  await expect(page.locator(".retro-practice")).toContainText("1 / 1");

  // Client-side navigation keeps the session, and the explorer stays hidden.
  await goToReviewMoreSection(page, "Engine");
  await expect(page.getByRole("tab", { name: "Explorer" })).toHaveCount(0);
  await expect(page.getByText(/hidden while you solve this position/)).toBeVisible();
});
