import { expect, test } from "@playwright/test";
import { SAMPLE_PGN, mockLocalAi, seedConnectedLibrary, seedReview } from "./fixtures";

test("imports a PGN from Home and enters the review workspace", async ({ page }) => {
  await page.goto("http://127.0.0.1:3000/");
  await page.getByRole("button", { name: "PGN", pressed: true }).click();
  await page.getByLabel("Paste a complete PGN").fill(SAMPLE_PGN);
  await page.getByRole("button", { name: "Analyze game →" }).click();
  await expect(page).toHaveURL(/\/review\/[a-f0-9]{20}$/);
  await expect(page.getByText("Ada vs Mikhail", { exact: true })).toBeVisible();
});

test("opens the matching account controls from the Home source links", async ({ page }) => {
  await page.route("**/api/platforms/chesscom/link", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ account: {
      id: "chesscom:ada",
      provider: "chesscom",
      username: "ada",
      displayName: "Ada",
      authMode: "public-username",
      verified: false,
      linkedAt: "2026-08-24T00:00:00.000Z",
    } }),
  }));
  await page.goto("/");
  await page.getByRole("link", { name: "Connect Chess.com in Settings" }).click();
  await expect(page).toHaveURL(/\/settings#chesscom-link$/);
  await page.getByLabel("Chess.com username").fill("ada");
  await page.locator("#chesscom-link").getByRole("button", { name: "Link" }).click();
  await expect(page.getByRole("status")).toContainText("ada linked as a public, unverified Chess.com profile");

  await page.goto("/");
  await page.getByRole("link", { name: "Connect Lichess in Settings" }).click();
  await expect(page).toHaveURL(/\/settings#lichess-link$/);
  await expect(page.locator("#lichess-link").getByRole("button")).toBeVisible();
});

test("navigates, flips, explores a branch, and returns to canonical play", async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 1117 });
  const { record } = await seedReview(page);
  await page.goto(`/review/${record.id}`);
  await expect(page.getByRole("region", { name: "Persistent board workspace" })).toBeVisible();

  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator(".move-status").getByText("1. e4", { exact: true })).toBeVisible();
  const evaluation = page.locator(".eval-bar");
  const beforeFlip = await evaluation.getAttribute("aria-label");
  await page.getByRole("button", { name: "Flip board" }).click();
  await expect(evaluation).not.toHaveAttribute("aria-label", beforeFlip ?? "");

  await page.getByRole("button", { name: "First position" }).click();
  await page.waitForTimeout(200);
  await page.locator('[data-square="d2"]').click();
  await expect(page.locator('[data-square="d4"] > div')).toHaveAttribute("style", /radial-gradient/);
  await page.locator('[data-square="d4"]').click();
  await expect(page.getByText(/Analysis branch · root ply 0/)).toBeVisible();
  await page.locator('[data-square="d7"]').click();
  await expect(page.locator('[data-square="d5"] > div')).toHaveAttribute("style", /radial-gradient/);
  await page.locator('[data-square="d5"]').click();
  await expect(page.getByText(/Analysis variation · d5/)).toBeVisible();
  await expect(page.locator('.continuation-list > button').first()).toBeVisible({ timeout: 30_000 });
  await page.locator(".position-workspace .return-to-game").click();
  await expect(page.getByText(/Analysis branch · root ply/)).toHaveCount(0);

  await page.getByRole("button", { name: "Go to ply 2, Best" }).click();
  await expect(page.locator(".move-status").getByText("1… e5", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Last position" }).click();
  await expect(page.getByText("21 / 21 ply", { exact: true })).toBeVisible();
});

test("shows deterministic offline and mocked Maia states without live services", async ({ page }) => {
  await mockLocalAi(page, "available");
  const { record } = await seedReview(page);
  await page.goto(`/review/${record.id}`);
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.getByText("Stockfish and Maia recommend the same move")).toBeVisible();
  await expect(page.getByText(/predicts human choices and outcomes/)).toBeVisible();
  await expect(page.getByText("NaN%", { exact: true })).toHaveCount(0);

  await page.unrouteAll({ behavior: "wait" });
  await mockLocalAi(page, "offline");
  await page.reload();
  await page.getByRole("button", { name: "Maia", exact: true }).click();
  await expect(page.getByText(/Local Maia service is offline/)).toBeVisible();
});

test("keeps move N, position N, model identity and persisted Coach facts aligned", async ({ page }) => {
  const mocked = await mockLocalAi(page, "available");
  const { record, analysis, cacheKey } = await seedReview(page);
  await page.goto(`/review/${record.id}`);
  await page.getByRole("button", { name: "Next move" }).click();
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator(".move-status").getByText("1… e5", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Maia", exact: true }).click();
  await expect(page.getByText(/2\. e5 · .* to find/)).toBeVisible();
  await expect(page.locator(".eval-bar")).toHaveAttribute("aria-label", /Maia predicted human-game WDL/);
  await expect.poll(() => mocked.requests.filter((request) => request.path === "/maia/move-review").length).toBeGreaterThan(0);
  const firstMoveRequest = mocked.requests.find((request) => request.path === "/maia/move-review");
  const firstPositionRequest = mocked.requests.find((request) => request.path === "/maia/position-analysis");
  expect(firstMoveRequest?.body).toMatchObject({
    fen_before: analysis.moves[1]?.fenBefore,
    played_move: analysis.moves[1]?.uci,
    model: "maia3-5m",
    target_elo: 1400,
  });
  expect(firstPositionRequest?.body).toMatchObject({ fen: analysis.moves[1]?.fenAfter });

  await page.getByRole("button", { name: "Stockfish" }).click();
  await expect(page.locator(".eval-bar")).toHaveAttribute("aria-label", /Stockfish objective evaluation/);
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.locator(".eval-bar")).toHaveAttribute("aria-label", /with Maia human marker/);
  await page.getByRole("button", { name: "Maia", exact: true }).click();
  await page.getByLabel("Target Elo").selectOption("1600");
  await page.getByLabel("Maia model").selectOption("maia3-23m");
  await expect(page.getByText(/maia3-23m @ 1600 predicts/i)).toBeVisible();
  await expect.poll(() => mocked.requests.some((request) => (
    request.path === "/maia/move-review"
    && request.body.model === "maia3-23m"
    && request.body.target_elo === 1600
  ))).toBe(true);

  await expect.poll(async () => page.evaluate(async (key) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("open-chess-review", 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = database.transaction("objective-analyses").objectStore("objective-analyses").get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    const human = (value as { moves?: Array<{ human?: { model?: string; targetElo?: number; version?: string } }> })?.moves?.[1]?.human;
    return human ? `${human.version}:${human.model}:${human.targetElo}` : "missing";
  }, cacheKey)).toBe("human-v2:maia3-23m:1600");

  await expect(page.getByText("MOVE QUALITY", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Coach" }).click();
  await expect(page.locator(".coach-fact-boundaries")).toContainText("maia3-23m @ 1600");
  await expect(page.locator(".coach-fact-boundaries")).toContainText("Policy rank #");
});

test("renders a large connected Library progressively", async ({ page }) => {
  await seedConnectedLibrary(page, 84);
  await page.goto("/history");
  await expect(page.locator(".history-game")).toHaveCount(60);
  await page.getByRole("button", { name: /Load 24 more/ }).click();
  await expect(page.locator(".history-game")).toHaveCount(84);
});
