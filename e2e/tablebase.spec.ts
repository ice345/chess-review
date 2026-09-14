import { expect, test, type Page } from "@playwright/test";
import { seedReview, writeStores } from "./fixtures";

/* Tablebase panel.
 *
 * The endpoint is mocked: the contract under test is that a covered position is
 * shown as proven evidence with every legal move grouped by result, that an
 * uncovered position is never asked about and never translated into a claim, and
 * that the panel states what leaves the machine. */

const ENDGAME_FEN = "8/8/8/8/8/4k3/8/4K2R w - - 0 1";

const TABLEBASE_PAYLOAD = {
  position: {
    version: 1,
    fen: "8/8/8/8/8/4k3/8/4K2R w - -",
    source: "lichess",
    tables: "syzygy-7",
    pieceCount: 3,
    category: "win",
    dtz: 12,
    dtm: 21,
    checkmate: false,
    stalemate: false,
    moves: [
      { uci: "h1h8", san: "Rh8", category: "win", dtz: 11, dtm: 20, zeroing: false, conversion: false },
      { uci: "e1d2", san: "Kd2", category: "draw", dtz: 0, zeroing: false, conversion: false },
    ],
  },
};

async function openEndgameStudy(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "FEN" }).click();
  await page.getByLabel("Paste an explicit FEN").fill(ENDGAME_FEN);
  await page.getByRole("button", { name: "Open Engine Lab →" }).click();
  await expect(page).toHaveURL(/\/engine$/);
}

test("shows a proven result with every move grouped by outcome", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requests: string[] = [];
  await page.route("**/api/tablebase*", async (request) => {
    requests.push(request.request().url());
    await request.fulfill({ json: TABLEBASE_PAYLOAD });
  });
  await openEndgameStudy(page);

  await page.getByRole("tab", { name: "Tablebase" }).click();
  const panel = page.getByRole("region", { name: "Tablebase" });
  await expect(panel).toContainText("White wins");
  await expect(panel).toContainText("DTZ 12 · DTM 21 · 3 pieces · Syzygy");
  await expect(panel).toContainText("fetched just now");
  await expect(panel).toContainText("Sends this position to the public Syzygy tablebase");

  const moves = panel.locator(".tablebase-moves button");
  await expect(moves).toHaveCount(2);
  await expect(moves.nth(0)).toContainText("Rh8");
  await expect(moves.nth(0)).toContainText("DTZ 11");
  // A move that does not win is reported as a draw, not hidden.
  await expect(moves.nth(1)).toContainText("Kd2");
  await expect(moves.nth(1)).toContainText("Draw");

  // Only the position is forwarded.
  expect(requests).toHaveLength(1);
  const requested = new URL(requests[0]!);
  expect(requested.pathname).toBe("/api/tablebase");
  expect([...requested.searchParams.keys()]).toEqual(["fen"]);

  // Exploring a move keeps the canonical board and becomes a variation.
  await moves.nth(0).click();
  await expect(page.getByText(/Analysis variation · Rh8/)).toBeVisible();
});

test("never asks about a position the tables do not cover", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let asked = 0;
  await page.route("**/api/tablebase*", async (request) => { asked += 1; await request.fulfill({ json: TABLEBASE_PAYLOAD }); });
  const { record } = await seedReview(page);
  await page.goto(`/review/${record.id}/engine`);
  await page.getByRole("tab", { name: "Tablebase" }).click();

  const panel = page.getByRole("region", { name: "Tablebase" });
  await expect(panel).toContainText("cover positions with at most 7 pieces");
  await expect(panel).toContainText("Stockfish evaluation is the only evidence available here — it is not a theoretical result.");
  expect(asked).toBe(0);
});

test("states a failure instead of showing a result", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/tablebase*", async (request) => {
    await request.fulfill({ status: 429, json: { error: "The tablebase is rate limiting requests. Try again shortly." } });
  });
  await openEndgameStudy(page);
  await page.getByRole("tab", { name: "Tablebase" }).click();
  await expect(page.getByRole("region", { name: "Tablebase" }).getByRole("alert")).toContainText("rate limiting");
  await expect(page.locator(".tablebase-moves")).toHaveCount(0);
});

test("keeps the tablebase away while a practice answer is owed", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/tablebase*", async (request) => request.fulfill({ json: TABLEBASE_PAYLOAD }));
  const fixture = await seedReview(page, { visualLabels: true });
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

  await page.locator("details.review-more summary").click();
  await page.locator("details.review-more .action-menu").getByRole("link", { name: "Engine", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Tablebase" })).toHaveCount(0);
});
