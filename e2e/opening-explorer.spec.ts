import { expect, test } from "@playwright/test";
import { goToReviewSection, seedReview, writeStores } from "./fixtures";

/* Opening Explorer: a deliberately network-backed panel.
 *
 * The endpoint is always mocked here — the product contract under test is what
 * the panel does with a valid payload, an empty position, a failure, a rate
 * limit and an unreachable service, that its own retry re-issues only this
 * request without reloading Review, that a late answer for a position the
 * visitor has left is never shown as the current one, and that it stays away
 * while a practice answer is owed. */

const START_EPD = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";
const AFTER_E4_EPD = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -";
// The panel names the board's own FEN, which carries the move counters; the
// request itself sends only the position identity (EPD).
const START_FEN = `${START_EPD} 0 1`;
const AFTER_E4_FEN = `${AFTER_E4_EPD} 0 1`;

const EXPLORER_PAYLOAD = {
  position: {
    version: 1,
    fen: START_EPD,
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

/** A payload for whatever position was asked about, with a distinguishing total. */
function payloadFor(fen: string, totalGames: number) {
  return {
    position: {
      ...EXPLORER_PAYLOAD.position,
      fen,
      totalGames,
      white: Math.round(totalGames / 2),
      draws: Math.round(totalGames / 3),
      black: totalGames - Math.round(totalGames / 2) - Math.round(totalGames / 3),
    },
  };
}

test("shows position frequencies with their source, sample, position and age", async ({ page }) => {
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

  // The numbers state which database, which population and which position they
  // describe, so they cannot be read as an evaluation of the board.
  await expect(panel).toContainText("All players database · rated 1600+ · blitz, rapid, classical");
  await expect(panel).toContainText(`Position ${START_FEN}`);
  await expect(panel).toContainText("not an evaluation");

  // Rows carry the SAN, the game count and the score split, in frequency order.
  const rows = panel.locator(".explorer-moves button");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("e4");
  await expect(rows.nth(0)).toContainText("600,000");
  await expect(rows.nth(0)).toContainText("W 50% D 33.3% B 16.7%");
  await expect(rows.nth(1)).toContainText("d4");

  // The request carries the position, the database and the population — and nothing
  // about the visitor's own games or account.
  expect(requests).toHaveLength(1);
  const requested = new URL(requests[0]!);
  expect(requested.pathname).toBe("/api/explorer");
  expect(requested.searchParams.get("fen")).toContain("rnbqkbnr");
  expect(requested.searchParams.get("source")).toBe("lichess");
  expect(requested.searchParams.get("rating")).toBe("1600");
  expect(requested.searchParams.get("speeds")).toBe("blitz,rapid,classical");
  expect([...requested.searchParams.keys()].sort()).toEqual(["fen", "rating", "source", "speeds"]);

  // Selecting a move explores it on the board as a variation.
  await rows.nth(0).click();
  await expect(page.getByText(/Analysis variation · e4/)).toBeVisible();
});

test("answers only about the population that was asked for", async ({ page }) => {
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

  // Wait for the first answer to land before changing the population: a change while a
  // lookup is in flight aborts it, and an aborted request never reaches interception.
  await expect(panel).toHaveAttribute("data-state", "fresh");
  const filtered = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/explorer" && url.searchParams.get("rating") === "2000" && url.searchParams.get("speeds") === "rapid";
  });
  await page.getByLabel("Explorer rating filter").selectOption("2000");
  await page.getByLabel("Explorer speed filter").selectOption("rapid");

  // The numbers name the games they count, and the request asks for that population.
  await expect(panel).toContainText("All players database · rated 2000+ · rapid");
  const latest = new URL((await filtered).url());
  expect(latest.searchParams.get("rating")).toBe("2000");
  expect(latest.searchParams.get("speeds")).toBe("rapid");

  // The masters cohort has no rating buckets: the control disappears with it, and the
  // source it switches to still names the population it does cover.
  await expect(panel).toHaveAttribute("data-state", "fresh");
  const masters = page.waitForRequest((request) => new URL(request.url()).searchParams.get("source") === "masters");
  await page.getByRole("button", { name: "Masters" }).click();
  await expect(page.getByLabel("Explorer rating filter")).toHaveCount(0);
  await expect(panel).toContainText("Masters database · human master games");
  expect(new URL((await masters).url()).searchParams.get("source")).toBe("masters");
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
  await expect(panel).toHaveAttribute("data-state", "empty");
  await expect(panel).toContainText("No games in this database reached this position.");
  await expect(panel).toContainText("Nobody in the Masters sample has played it.");
  await expect(panel.locator(".explorer-moves")).toHaveCount(0);
  expect(sources).toContain("masters");

  // An empty position is not a dead end: the same panel retry re-checks it, and
  // a database that has games answers with them.
  const asked = sources.length;
  await panel.getByRole("button", { name: "Retry explorer" }).click();
  await expect.poll(() => sources.length).toBeGreaterThan(asked);
  await expect(panel).toHaveAttribute("data-state", "empty");
});

test("says a deployment without an explorer token is unconfigured, not broken", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/explorer*", async (route) => {
    await route.fulfill({
      status: 503,
      json: { error: "The opening explorer needs a Lichess API token on this deployment.", unconfigured: true },
    });
  });
  const { record } = await seedReview(page, { visualLabels: true });
  await page.goto(`/review/${record.id}/engine`);
  await page.getByRole("tab", { name: "Explorer" }).click();

  const panel = page.getByRole("region", { name: "Opening explorer" });
  // The explorer has required a token since 2026-03-03: a missing one is deployment
  // configuration, and it must not read as a rate limit or as "no games here".
  await expect(panel).toHaveAttribute("data-state", "unconfigured");
  await expect(panel).toContainText("This deployment has no Lichess explorer token");
  await expect(panel).not.toContainText("No games in this database reached this position");
  await expect(panel).not.toContainText("rate-limited");
});

test("reports a rate limit and recovers it with this panel's retry, without reloading Review", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { record } = await seedReview(page, { visualLabels: true });
  let limited = true;
  await page.route("**/api/explorer*", async (request) => {
    if (limited) {
      await request.fulfill({ status: 429, json: { error: "The opening explorer is rate limiting requests. Try again shortly." } });
      return;
    }
    await request.fulfill({ json: EXPLORER_PAYLOAD });
  });
  await page.goto(`/review/${record.id}/engine`);
  await page.getByRole("tab", { name: "Explorer" }).click();
  const panel = page.getByRole("region", { name: "Opening explorer" });

  await expect(panel).toHaveAttribute("data-state", "rate-limited");
  await expect(panel.getByRole("alert")).toContainText("rate-limited right now");
  await expect(panel.getByRole("alert")).toContainText("The opening explorer is rate limiting requests.");

  // Passing a marker through the page proves the recovery happens in place.
  await page.evaluate(() => { (window as unknown as { explorerStillOpen: string }).explorerStillOpen = "same document"; });

  limited = false;
  await panel.getByRole("button", { name: "Retry explorer" }).click();
  await expect(panel).toHaveAttribute("data-state", "fresh");
  await expect(panel).toContainText("1,234,567");
  await expect(panel.getByRole("alert")).toHaveCount(0);

  // The board is untouched, the document was never reloaded, and the loaded
  // analysis is still the cached one — the retry re-ran the explorer only.
  await expect(page.locator(".board-wrap img").first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { explorerStillOpen?: string }).explorerStillOpen)).toBe("same document");
  expect(new URL(page.url()).pathname).toBe(`/review/${record.id}/engine`);
  await page.getByRole("tab", { name: "Engine" }).click();
  await expect(page.locator(".engine-diagnostics")).toContainText("Loaded from IndexedDB");
});

test("recovers a failed lookup and an unreachable service in place", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { record } = await seedReview(page, { visualLabels: true });
  let mode: "failed" | "offline" | "ok" = "failed";
  await page.route("**/api/explorer*", async (request) => {
    if (mode === "offline") return request.abort("connectionrefused");
    if (mode === "failed") return request.fulfill({ status: 502, json: { error: "The opening explorer request failed (502)." } });
    await request.fulfill({ json: EXPLORER_PAYLOAD });
  });
  await page.goto(`/review/${record.id}/engine`);
  await page.getByRole("tab", { name: "Explorer" }).click();
  const panel = page.getByRole("region", { name: "Opening explorer" });
  await page.evaluate(() => { (window as unknown as { explorerStillOpen: string }).explorerStillOpen = "same document"; });

  // A server failure is distinguishable from a lost connection, and it retries.
  await expect(panel).toHaveAttribute("data-state", "failed");
  await expect(panel.getByRole("alert")).toContainText("The All players lookup failed.");
  mode = "offline";
  await panel.getByRole("button", { name: "Retry explorer" }).click();
  await expect(panel).toHaveAttribute("data-state", "offline");
  await expect(panel.getByRole("alert")).toContainText("could not be reached");

  mode = "ok";
  await panel.getByRole("button", { name: "Retry explorer" }).click();
  await expect(panel).toHaveAttribute("data-state", "fresh");
  await expect(panel).toContainText("1,234,567");
  await expect(page.locator(".board-wrap img").first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { explorerStillOpen?: string }).explorerStillOpen)).toBe("same document");
});

test("never leaves a previous position's numbers on screen when the position changes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { record } = await seedReview(page, { visualLabels: true });
  await page.route("**/api/explorer*", async (request) => {
    const fen = new URL(request.request().url()).searchParams.get("fen") ?? "";
    // The position the visitor moves *to* answers slowly, so the window where a
    // previous answer could be mistaken for the current one is observable.
    if (fen === AFTER_E4_EPD) {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 1_200);
      await promise;
    }
    await request.fulfill({ json: payloadFor(fen, fen === START_EPD ? 111_111 : 222_222) }).catch(() => {});
  });
  await page.goto(`/review/${record.id}/engine`);
  await page.getByRole("tab", { name: "Explorer" }).click();
  const panel = page.getByRole("region", { name: "Opening explorer" });

  await expect(panel).toHaveAttribute("data-state", "fresh");
  await expect(panel).toContainText("111,111");
  await expect(panel).toContainText(`Position ${START_FEN}`);

  // The visitor moves on. The starting position's answer must not stay on screen
  // as though it described the new position, and the panel still names the
  // position it is working on.
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(panel).toHaveAttribute("data-state", "loading");
  await expect(panel).toContainText(`Position ${AFTER_E4_FEN}`);
  await expect(panel).not.toContainText("111,111");
  await expect(panel.locator(".explorer-moves")).toHaveCount(0);

  // When the new position's own answer arrives, only it is shown.
  await expect(panel).toHaveAttribute("data-state", "fresh");
  await expect(panel).toContainText("222,222");
  await expect(panel).toContainText(`Position ${AFTER_E4_FEN}`);
  await expect(panel).not.toContainText("111,111");
});

test("keeps a stale answer usable and offers a refresh that recovers it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { record } = await seedReview(page, { visualLabels: true });
  let mode: "fresh" | "fail" = "fresh";
  await page.route("**/api/explorer*", async (request) => {
    if (mode === "fail") return request.fulfill({ status: 502, json: { error: "The opening explorer request failed (502)." } });
    await request.fulfill({ json: EXPLORER_PAYLOAD });
  });
  await page.goto(`/review/${record.id}/engine`);
  await page.getByRole("tab", { name: "Explorer" }).click();
  const panel = page.getByRole("region", { name: "Opening explorer" });
  await expect(panel).toHaveAttribute("data-state", "fresh");

  // Age the cached answer past its lifetime, then fail every refresh. The panel
  // still shows the usable numbers — labelled as cached, with the failed refresh.
  await page.evaluate(() => {
    const original = Date.now;
    (window as unknown as { restoreExplorerClock: () => void }).restoreExplorerClock = () => { Date.now = original; };
    Date.now = () => original() + 25 * 60 * 60 * 1000;
  });
  mode = "fail";
  await panel.getByRole("button", { name: "Masters" }).click();
  await expect(panel).toHaveAttribute("data-state", "failed");
  await panel.getByRole("button", { name: "All players" }).click();
  await expect(panel).toHaveAttribute("data-state", "stale");
  await expect(panel).toContainText("Cached answer · this refresh failed");
  await expect(panel).toContainText("1,234,567");
  await expect(panel).toContainText("not a best-move ranking");

  // The refresh is the panel's own retry, and the board is untouched.
  await page.evaluate(() => { (window as unknown as { explorerStillOpen: string }).explorerStillOpen = "same document"; });
  mode = "fresh";
  await panel.getByRole("button", { name: "Retry explorer" }).click();
  await expect(panel).toHaveAttribute("data-state", "fresh");
  await expect(panel).not.toContainText("Cached answer");
  await expect(page.locator(".board-wrap img").first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { explorerStillOpen?: string }).explorerStillOpen)).toBe("same document");
  await page.evaluate(() => (window as unknown as { restoreExplorerClock: () => void }).restoreExplorerClock());
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
  // The side that recorded a fault is the default, so the launcher starts it
  // directly; the side chooser only appears when a side has nothing to practise.
  await page.getByRole("button", { name: /Practice Black's 1 position/ }).click();
  await expect(page.locator(".retro-practice")).toContainText("1 / 1");

  // Client-side navigation keeps the session, and the explorer stays hidden.
  await goToReviewSection(page, "Analysis");
  await expect(page.getByRole("tab", { name: "Explorer" })).toHaveCount(0);
  await expect(page.getByText(/hidden while you solve this position/)).toBeVisible();
});
