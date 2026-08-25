import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { SAMPLE_PGN, mockLocalAi, seedAdvancedStudy, seedConnectedLibrary, seedReview, seedUnanalyzedReview } from "./fixtures";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

test("imports a PGN from Home and enters the review workspace", async ({ page }) => {
  await page.goto("http://127.0.0.1:3000/");
  await page.getByRole("button", { name: "PGN", pressed: true }).click();
  await page.getByLabel("Paste a complete PGN").fill(SAMPLE_PGN);
  await page.getByRole("button", { name: "Analyze game →" }).click();
  await expect(page).toHaveURL(/\/review\/[a-f0-9]{20}$/);
  await expect(page.getByText("Ada vs Mikhail", { exact: true })).toBeVisible();
  await expect(page.getByText("MOVE QUALITY", { exact: true })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("button", { name: "Analyze game" })).toHaveCount(0);
});

test("runs a real uncached Stockfish game review from Analyze game", async ({ page }) => {
  const record = await seedUnanalyzedReview(page);
  await page.goto(`/review/${record.id}`);
  const analyze = page.getByRole("button", { name: "Analyze game" });
  await expect(analyze).toBeVisible();
  await analyze.click();
  await expect(page.getByText("MOVE QUALITY", { exact: true })).toBeVisible({ timeout: 40_000 });
  await expect(analyze).toHaveCount(0);
});

test("completes a real Stockfish review when the PGN ends in checkmate", async ({ page }) => {
  const record = await seedUnanalyzedReview(page, `[Event "Terminal Stockfish E2E"]
[White "Ada"]
[Black "Mikhail"]
[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1`);
  await page.goto(`/review/${record.id}`);
  await page.getByRole("button", { name: "Analyze game" }).click();
  await expect(page.getByText("MOVE QUALITY", { exact: true })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("button", { name: "Analyze game" })).toHaveCount(0);
  await page.getByRole("button", { name: "Last position" }).click();
  await expect(page.getByText("Checkmate · no legal continuation.", { exact: true })).toBeVisible();
  await expect(page.locator(".continuation-list + .error")).toHaveCount(0);
});

test("completes a real Stockfish review when the PGN ends in stalemate", async ({ page }) => {
  const record = await seedUnanalyzedReview(page, `[Event "Terminal Stockfish E2E"]
[White "Ada"]
[Black "Mikhail"]
[Result "1/2-1/2"]
[SetUp "1"]
[FEN "7k/4Q3/6K1/8/8/8/8/8 w - - 0 1"]

1. Qf7 1/2-1/2`);
  await page.goto(`/review/${record.id}`);
  await page.getByRole("button", { name: "Analyze game" }).click();
  await expect(page.getByText("MOVE QUALITY", { exact: true })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("button", { name: "Analyze game" })).toHaveCount(0);
  await page.getByRole("button", { name: "Last position" }).click();
  await expect(page.getByText("Stalemate · no legal continuation.", { exact: true })).toBeVisible();
  await expect(page.locator(".continuation-list + .error")).toHaveCount(0);
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

test("non-submit Home controls never submit the import form", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const state = window as Window & { __unexpectedSubmits?: number };
    state.__unexpectedSubmits = 0;
    document.querySelector("form.import-card")?.addEventListener("submit", (event) => {
      event.preventDefault();
      state.__unexpectedSubmits = (state.__unexpectedSubmits ?? 0) + 1;
    });
  });
  await page.getByRole("button", { name: "FEN" }).click();
  await page.getByRole("button", { name: "PGN" }).click();
  await page.getByRole("button", { name: "Load example game" }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __unexpectedSubmits?: number }).__unexpectedSubmits)).toBe(0);
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
  await expect(page.locator('.board-quality-badge')).toHaveAttribute("aria-label", / on d5$/, { timeout: 30_000 });
  await expect(page.locator('.move-status small')).toContainText(/Accuracy/);
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
  await page.getByRole("button", { name: /Maia · 1400/ }).click();
  await expect(page.getByText(/Local Maia service is offline/)).toBeVisible();
});

test("keeps move N, position N, model identity and persisted Coach facts aligned", async ({ page }) => {
  const mocked = await mockLocalAi(page, "available");
  const { record, analysis, cacheKey } = await seedReview(page);
  await page.goto(`/review/${record.id}`);
  await page.getByRole("button", { name: "Next move" }).click();
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator(".move-status").getByText("1… e5", { exact: true })).toBeVisible();
  const stockfishVerdict = await page.locator(".objective-verdict strong").innerText();
  const objectiveBoardBadge = await page.locator(".board-quality-badge").getAttribute("aria-label");
  expect(objectiveBoardBadge).toBeTruthy();
  await expect(page.locator(".human-verdict")).toHaveCount(0);

  await page.getByRole("button", { name: /Maia · 1400/ }).click();
  await expect(page.getByText(/2\. e5 · .* to find/)).toBeVisible();
  await expect(page.locator(".eval-bar")).toHaveAttribute("aria-label", /Maia predicted human-game WDL/);
  await expect(page.locator(".objective-verdict")).toHaveCount(0);
  await expect(page.locator(".human-verdict")).toContainText("MAIA · HUMAN FIND DIFFICULTY");
  await expect(page.locator(".board-quality-badge")).toHaveAttribute("aria-label", objectiveBoardBadge!);
  await expect(page.locator(".board-human-difficulty-badge")).toHaveCount(0);
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
  await expect(page.locator(".objective-verdict strong")).toHaveText(stockfishVerdict);
  await expect(page.locator(".human-verdict")).toHaveCount(0);
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.locator(".eval-bar")).toHaveAttribute("aria-label", /with Maia human marker/);
  await expect(page.locator(".objective-verdict strong")).toHaveText(stockfishVerdict);
  await expect(page.locator(".human-verdict")).toContainText("MAIA · HUMAN FIND DIFFICULTY");
  await expect(page.locator(".board-quality-badge")).toHaveAttribute("aria-label", objectiveBoardBadge!);
  await expect(page.locator(".board-human-difficulty-badge")).toHaveCount(0);
  await page.getByRole("button", { name: /Maia · 1400/ }).click();
  await page.getByText("Maia settings", { exact: true }).click();
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
      const request = indexedDB.open("open-chess-review", 4);
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
  await page.getByRole("link", { name: "Explain this move: e5" }).click();
  await expect(page).toHaveURL(`/review/${record.id}/coach`);
  await expect(page.locator(".move-status")).toContainText("1… e5");
  await expect(page.getByRole("link", { name: "Study" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".coach-provenance")).toContainText("MAIA-3 23M @ 1600");
  await expect(page.locator(".coach-fact-boundaries")).toHaveCount(0);
});

test("uses exact candidate identities for shared destinations and unbiased Compare branches", async ({ page }) => {
  const mocked = await mockLocalAi(page, "available", {
    positionCandidates: ["g1f3", "e2e4", "c2c4"],
    responseDelayMs: 40,
  });
  const { record } = await seedReview(page);
  await page.goto(`/review/${record.id}`);

  await expect(page.locator('[data-candidate-uci="f2f3"]')).toBeVisible();
  await expect(page.locator('[data-candidate-uci="g1f3"]')).toBeVisible();
  await page.getByRole("button", { name: "Stockfish candidate #3 g1f3" }).click();
  await expect(page.locator(".move-status")).toContainText("Analysis variation · Nf3");
  await page.locator(".position-workspace .return-to-game").click();
  await expect(page.locator(".move-status")).toContainText("Starting position");

  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".lens-switch button")];
    const click = (name: string) => buttons.find((button) => button.textContent?.startsWith(name))?.click();
    click("Maia"); click("Stockfish"); click("Maia"); click("Compare");
  });
  await expect(page.getByRole("button", { name: "Compare", pressed: true })).toBeVisible();
  await expect(page.getByText("Objective and human recommendations diverge")).toBeVisible();
  await expect(page.getByTestId("compare-arrow-overlap")).toHaveText("2 exact UCI arrow overlaps");
  await expect.poll(() => mocked.requests.filter((request) => request.path === "/maia/position-analysis").length).toBe(1);

  await page.getByRole("button", { name: "Maia candidate #3 c2c4" }).click();
  await expect(page.locator(".move-status")).toContainText("Analysis variation · c4");
  await page.locator(".position-workspace .return-to-game").click();
  await expect(page.locator(".move-status")).toContainText("Starting position");
});

test("keeps Coach generation alive across review routes, guards rapid calls, and exports V3 review PNGs", async ({ page }, testInfo) => {
  const mocked = await mockLocalAi(page, "available", { responseDelayMs: 350 });
  const { record } = await seedReview(page, { visualLabels: true });
  await page.goto(`/review/${record.id}/coach`);
  await page.getByRole("button", { name: "Next move" }).click();
  await page.evaluate(() => {
    const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent?.includes("讲解 e4"));
    button?.click();
    button?.click();
  });
  await expect(page.getByRole("link", { name: /Study/ })).toContainText("Generating…");
  await page.getByRole("link", { name: "Moves" }).click();
  await expect(page).toHaveURL(`/review/${record.id}/moves`);
  await expect(page.getByRole("link", { name: /Study/ })).toBeVisible();
  await page.getByRole("link", { name: /Study/ }).click();
  await expect(page.getByText(/已使用确定性中文回退/)).toBeVisible();
  expect(mocked.requests.filter((request) => request.path === "/coach/explain")).toHaveLength(1);
  await page.getByRole("button", { name: "生成整盘学习计划" }).click();
  await expect(page.locator(".game-coach-result")).toContainText("训练建议");
  expect(mocked.requests.filter((request) => request.path === "/coach/game-summary")).toHaveLength(1);

  await page.getByRole("button", { name: "Flip board" }).click();
  await page.getByText("Export", { exact: true }).click();
  const positionDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Position PNG" }).click();
  const positionPng = await positionDownload;
  expect(positionPng.suggestedFilename()).toMatch(/\.png$/);
  const positionPath = testInfo.outputPath("position.png");
  await positionPng.saveAs(positionPath);
  const positionBytes = await readFile(positionPath);
  expect(positionBytes.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE);
  expect(positionBytes.byteLength).toBeGreaterThan(10_000);
  await testInfo.attach("position-png", { path: positionPath, contentType: "image/png" });

  const reviewDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Review PNG" }).click();
  const reviewPng = await reviewDownload;
  expect(reviewPng.suggestedFilename()).toMatch(/\.png$/);
  const reviewPath = testInfo.outputPath("review.png");
  await reviewPng.saveAs(reviewPath);
  const reviewBytes = await readFile(reviewPath);
  expect(reviewBytes.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE);
  expect(reviewBytes.byteLength).toBeGreaterThan(10_000);
  await testInfo.attach("review-png", { path: reviewPath, contentType: "image/png" });
});

test("renders a large connected Library progressively", async ({ page }) => {
  await seedConnectedLibrary(page, 84);
  await page.goto("/history");
  await expect(page.locator(".history-game")).toHaveCount(60);
  await page.getByRole("button", { name: /Load 24 more/ }).click();
  await expect(page.locator(".history-game")).toHaveCount(84);
});

test("builds advanced study evidence and persists an actionable training queue", async ({ page }) => {
  const fixtures = await seedAdvancedStudy(page);
  await page.goto("/training");

  await expect(page.getByRole("heading", { name: "Progress and training" })).toBeVisible();
  await expect(page.getByLabel("Study player")).toHaveValue("ada");
  await expect(page.locator(".study-metrics")).toContainText("3");
  await expect(page.getByText("Italian Game", { exact: true })).toBeVisible();
  await expect(page.getByText("Opening decisions", { exact: true })).toBeVisible();
  await expect(page.getByText("Missed opportunities", { exact: true })).toBeVisible();

  const missedCard = page.locator(".weakness-grid > article").filter({ hasText: "Missed opportunities" });
  await missedCard.getByRole("button", { name: "Add to training queue" }).click();
  await expect(page.getByRole("status")).toContainText("added to the training queue");
  await expect(page.locator(".training-list")).toContainText("Missed opportunities");

  await page.locator(".training-list").getByRole("button", { name: "Start" }).click();
  await expect(page.locator(".training-list")).toContainText("in progress");
  await page.reload();
  await expect(page.locator(".training-list")).toContainText("in progress");

  await page.locator(".training-sources a").first().click();
  await expect(page).toHaveURL(new RegExp(`/review/(?:${fixtures[0]!.record.id}|${fixtures[1]!.record.id})/moves\\?ply=3$`));
  await expect(page.locator(".move-status")).toContainText("2. Nf3");
});
