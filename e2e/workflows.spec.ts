import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { SAMPLE_PGN, mockLocalAi, openReviewEngineLines, openReviewGameSummary, openReviewMore, openReviewTimeline, seedAdvancedStudy, seedConnectedLibrary, seedHistoricalReviewWithPgnDrift, seedPartialHistoryJob, seedPausedHistoryJob, seedReview, seedUnanalyzedReview, writeStores } from "./fixtures";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

test("imports a PGN from Home and enters the review workspace", async ({ page }) => {
  await page.goto("http://127.0.0.1:3000/");
  await page.getByRole("button", { name: "PGN", pressed: true }).click();
  await page.getByLabel("Paste a complete PGN").fill(SAMPLE_PGN);
  await page.getByRole("button", { name: "Analyze game →" }).click();
  await expect(page).toHaveURL(/\/review\/[a-f0-9]{20}$/);
  await expect(page.getByText("Ada vs Mikhail", { exact: true })).toBeVisible();
  await expect(page.getByText("GAME SUMMARY", { exact: true })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("button", { name: "Analyze game" })).toHaveCount(0);
});

test("restores historical analysis in Review, Moves, Study and Engine after PGN drift", async ({ page }) => {
  const { record } = await seedHistoricalReviewWithPgnDrift(page);
  await page.goto(`/review/${record.id}`);
  await expect(page.getByText("GAME SUMMARY", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Analyze game" })).toHaveCount(0);

  await page.goto(`/review/${record.id}/moves`);
  await expect(page.getByText("Run the objective review first")).toHaveCount(0);
  await expect(page.getByText("e4", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Analyze game" })).toHaveCount(0);

  await page.goto(`/review/${record.id}/coach`);
  await expect(page.getByText("Run the objective review first")).toHaveCount(0);
  await expect(page.locator(".coach-actions")).toBeVisible();
  await expect(page.locator(".coach-engine-line")).toContainText(/(?:depth|深度)\s*10/);

  await page.goto(`/review/${record.id}/engine`);
  await expect(page.getByText("Loaded from IndexedDB", { exact: true })).toBeVisible();
  await expect(page.getByText("No game analysis", { exact: true })).toHaveCount(0);
});

test("runs a real uncached Stockfish game review from Analyze game", async ({ page }) => {
  const record = await seedUnanalyzedReview(page);
  await page.goto(`/review/${record.id}`);
  const analyze = page.getByRole("button", { name: "Analyze game" });
  await expect(analyze).toBeVisible();
  await analyze.click();
  await expect(page.getByText("GAME SUMMARY", { exact: true })).toBeVisible({ timeout: 40_000 });
  await expect(analyze).toHaveCount(0);
});

test("updates the Moves panel when the analysis arrives after it mounted", async ({ page }) => {
  const record = await seedUnanalyzedReview(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // The panel mounts without an analysis, then gains one. A hook after the gate's
  // early return would change the hook count here and throw.
  await page.goto(`/review/${record.id}/moves`);
  await expect(page.getByText("Run the objective review first")).toBeVisible();
  await page.getByRole("button", { name: "Analyze game" }).click();
  await expect(page.locator(".review-move-list")).toBeVisible({ timeout: 40_000 });
  await expect(page.locator(".review-move-list .move-number").first()).toContainText("1.");
  expect(errors).toEqual([]);
});

test("completes a real Stockfish review when the PGN ends in checkmate", async ({ page }) => {
  const record = await seedUnanalyzedReview(page, `[Event "Terminal Stockfish E2E"]
[White "Ada"]
[Black "Mikhail"]
[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1`);
  await page.goto(`/review/${record.id}`);
  await page.getByRole("button", { name: "Analyze game" }).click();
  await expect(page.getByText("GAME SUMMARY", { exact: true })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("button", { name: "Analyze game" })).toHaveCount(0);
  await page.getByRole("button", { name: "Last position" }).click();
  await openReviewEngineLines(page);
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
  await expect(page.getByText("GAME SUMMARY", { exact: true })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("button", { name: "Analyze game" })).toHaveCount(0);
  await page.getByRole("button", { name: "Last position" }).click();
  await openReviewEngineLines(page);
  await expect(page.getByText("Stalemate · no legal continuation.", { exact: true })).toBeVisible();
  await expect(page.locator(".continuation-list + .error")).toHaveCount(0);
});

test("links Chess.com from Home and opens Lichess account controls", async ({ page }) => {
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
  await page.getByLabel("Chess.com username").fill("ada");
  await page.locator("#chesscom-link").getByRole("button", { name: "Link" }).click();
  await expect(page.locator(".account-notice")).toContainText("ada linked as a public, unverified Chess.com profile");

  await page.getByRole("link", { name: "Connect Lichess in Settings" }).click();
  await expect(page).toHaveURL(/\/settings#lichess-link$/);
  await expect(page.locator("#lichess-link").getByRole("button")).toBeVisible();
});

test("non-submit Home controls never submit the import form", async ({ page }) => {
  await page.goto("/");
  const analyze = page.getByRole("button", { name: "Analyze game →" });
  await expect(analyze).toBeDisabled();
  await page.evaluate(() => {
    const state = window as Window & { __unexpectedSubmits?: number };
    state.__unexpectedSubmits = 0;
    document.querySelector("form.import-card")?.addEventListener("submit", (event) => {
      event.preventDefault();
      state.__unexpectedSubmits = (state.__unexpectedSubmits ?? 0) + 1;
    });
  });
  await page.getByRole("button", { name: "FEN", exact: true }).click();
  await page.getByRole("button", { name: "PGN", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __unexpectedSubmits?: number }).__unexpectedSubmits)).toBe(0);
});

test("Load example game starts a review", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load example game" }).click();
  await expect(page).toHaveURL(/\/review\//);
});

test("invalid PGN shows a short import error", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Paste a complete PGN").fill("this is not a chess game 1. e4 e5 2. Ke2 illegal");
  await page.getByRole("button", { name: "Analyze game →" }).click();
  await expect(page.getByText("This PGN could not be parsed.")).toBeVisible();
  await expect(page.getByText("Could not preview this input")).toBeVisible();
});

test("opening-only Review shows Opening Accuracy and Training omits strongest-phase", async ({ page }) => {
  const { record } = await seedReview(page);
  await page.goto(`/review/${record.id}`);
  await openReviewGameSummary(page);
  await expect(page.getByText("Opening Accuracy matches overall Accuracy")).toBeVisible();
  await expect(page.locator(".accuracy-table")).toContainText("Opening");
  await page.goto("/training");
  await expect(page.getByText("Strongest phase")).toHaveCount(0);
});

test("History can delete a review record", async ({ page }) => {
  const { record } = await seedReview(page);
  await page.goto("/history");
  await expect(page.getByText(record.title)).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(record.title)).toHaveCount(0);
});

test("promotion chooser offers four pieces and cancel", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "FEN" }).click();
  await page.getByLabel("Paste an explicit FEN").fill("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  await page.getByRole("button", { name: "Open Engine Lab →" }).click();
  await expect(page).toHaveURL(/\/engine$/);
  await page.locator('[data-square="a7"]').click();
  await page.locator('[data-square="a8"]').click();
  const chooser = page.getByRole("dialog", { name: "Choose promotion piece" });
  await expect(chooser).toBeVisible();
  await expect(page.locator(".board-quality-badge")).toHaveCount(0);
  await expect(chooser).toHaveCSS("z-index", "8");
  await expect(chooser.getByRole("button", { name: "Queen" })).toBeVisible();
  await expect(chooser.getByRole("button", { name: "Rook" })).toBeVisible();
  await expect(chooser.getByRole("button", { name: "Bishop" })).toBeVisible();
  await expect(chooser.getByRole("button", { name: "Knight" })).toBeVisible();
  // The accessible names come from the label text, so assert the piece artwork
  // actually decoded rather than leaving four blank buttons unverified.
  await expect(chooser.locator(".promotion-piece img")).toHaveCount(4);
  await expect.poll(
    () => chooser.locator(".promotion-piece img").evaluateAll(
      (images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
    ),
  ).toBe(true);
  await chooser.getByRole("button", { name: "Cancel" }).click();
  await expect(chooser).toHaveCount(0);
  await expect(page.locator(".move-status")).toContainText("Starting position");
  await page.locator('[data-square="a7"]').click();
  await page.locator('[data-square="a8"]').click();
  await page.getByRole("button", { name: "Queen" }).click();
  await expect(page.locator(".move-status")).toContainText("a8=Q");
});

test("History summary counts the filtered merged library", async ({ page }) => {
  await seedReview(page);
  await seedConnectedLibrary(page, 3);
  await page.goto("/history");

  await expect(page.locator(".history-summary span").filter({ hasText: "All records" }).locator("strong")).toHaveText("4");
  await expect(page.locator(".history-summary")).toContainText("1 Manual");
  await expect(page.locator(".history-summary")).toContainText("3 Chess.com");
});

test("keeps Review desk priorities and fits Moves to the board workspace", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const { record } = await seedReview(page);
  await page.goto(`/review/${record.id}`);

  const nav = page.getByRole("navigation", { name: "Review sections" });
  await expect(nav.getByRole("link", { name: "Review", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Analysis", exact: true })).toBeVisible();
  await openReviewMore(page);
  const more = page.locator("details.review-more .action-menu");
  await expect(more.getByRole("link", { name: "Notebook", exact: true })).toBeVisible();
  for (const name of ["Library", "Practice", "Settings"]) {
    await expect(more.getByRole("link", { name, exact: true })).toHaveCount(0);
  }
  await expect(more.getByRole("link", { name: "Engine", exact: true })).toHaveCount(0);

  await expect(page.locator(".game-summary-section")).toBeVisible();
  await expect(page.locator(".game-summary-section .timeline-panel")).not.toHaveAttribute("open");
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator(".objective-route > .dual-verdict")).toBeVisible();
  await expect(page.locator(".objective-route .position-analysis")).toBeVisible();


  await page.goto(`/review/${record.id}/moves`);
  await expect(page.locator(".game-summary-section")).toHaveCount(0);
  const heights = await page.evaluate(() => ({
    position: document.querySelector(".position-workspace")?.getBoundingClientRect().height ?? 0,
    moves: document.querySelector(".moves-route")?.getBoundingClientRect().height ?? 0,
  }));
  expect(Math.abs(heights.position - heights.moves)).toBeLessThan(1);
  await page.getByRole("button", { name: "Next move" }).click();
  const evidence = await page.locator(".move-evidence").boundingBox();
  const panel = await page.locator(".moves-context").boundingBox();
  expect(evidence!.y + evidence!.height).toBeLessThanOrEqual(panel!.y + panel!.height + 1);
});

test("the Review move list keeps the current ply in view", async ({ page }) => {
  const { record } = await seedReview(page);
  await page.goto(`/review/${record.id}`);
  await page.getByRole("button", { name: "Last position" }).click();
  const visible = await page.evaluate(() => {
    const list = document.querySelector(".objective-route .review-move-list");
    const active = list?.querySelector("button.active");
    if (!list || !active) return false;
    const box = list.getBoundingClientRect();
    const row = active.getBoundingClientRect();
    return row.top >= box.top - 1 && row.bottom <= box.bottom + 1;
  });
  expect(visible).toBe(true);
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
  await openReviewEngineLines(page);
  await expect(page.locator('.continuation-list > button').first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Previous move" }).click();
  await expect(page.getByText(/Analysis variation · d4/)).toBeVisible();
  await page.locator('[data-square="c7"]').click();
  await expect(page.locator('[data-square="c5"] > div')).toHaveAttribute("style", /radial-gradient/);
  await page.locator('[data-square="c5"]').click();
  await expect(page.getByText(/Analysis variation · c5/)).toBeVisible();
  await page.locator(".position-workspace .return-to-game").click();
  await expect(page.getByText(/Analysis branch · root ply/)).toHaveCount(0);
  await openReviewTimeline(page);
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
  const stockfishVerdict = await page.locator(".objective-verdict > strong").innerText();
  const objectiveBoardBadge = await page.locator(".board-quality-badge").getAttribute("aria-label");
  expect(objectiveBoardBadge).toBeTruthy();
  await expect(page.locator(".human-verdict")).toHaveCount(0);

  await page.getByRole("button", { name: /Maia · 1400/ }).click();
  await expect(page.locator(".human-verdict")).toContainText(/e5 · .*to find/);
  await expect(page.locator(".eval-bar")).toHaveAttribute("aria-label", /Maia predicted human-game WDL/);
  await expect(page.locator(".objective-verdict")).toHaveCount(0);
  await expect(page.locator(".human-verdict")).toContainText("MAIA-3 5M @ 1400");
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
  await expect(page.locator(".objective-verdict > strong")).toHaveText(stockfishVerdict);
  await expect(page.locator(".human-verdict")).toHaveCount(0);
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.locator(".eval-bar")).toHaveAttribute("aria-label", /with Maia human marker/);
  await expect(page.locator(".objective-verdict > strong")).toHaveText(stockfishVerdict);
  await expect(page.locator(".human-verdict")).toContainText("MAIA-3 5M @ 1400");
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
      const request = indexedDB.open("open-chess-review");
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

  await expect(page.getByText("GAME SUMMARY", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Explain this move: e5" }).click();
  await expect(page).toHaveURL(new RegExp(`/review/${record.id}/coach(?:\\?ply=\\d+)?$`));
  await expect(page.locator(".move-status")).toContainText("1… e5");
  await expect(page.getByRole("link", { name: "Study" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".coach-engine-line")).toContainText("MAIA-3 23M @ 1600");
  await expect(page.locator(".coach-fact-boundaries")).toHaveCount(0);
});

test("uses exact candidate identities for shared destinations and unbiased Compare branches", async ({ page }) => {
  const mocked = await mockLocalAi(page, "available", {
    positionCandidates: ["g1f3", "e2e4", "c2c4"],
    responseDelayMs: 40,
  });
  const { record } = await seedReview(page);
  await page.goto(`/review/${record.id}`);

  await openReviewEngineLines(page);
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
    const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent?.includes("Explain e4"));
    button?.click();
    button?.click();
  });
  await expect(page.getByRole("link", { name: /Study/ })).toContainText("Generating…");
  await page.getByRole("link", { name: "Moves" }).click();
  await expect(page).toHaveURL(`/review/${record.id}/moves`);
  await expect(page.getByRole("link", { name: /Study/ })).toBeVisible();
  await page.getByRole("link", { name: /Study/ }).click();
  await expect(page.getByText(/Deterministic fallback used/)).toBeVisible();
  expect(mocked.requests.filter((request) => request.path === "/coach/explain")).toHaveLength(1);
  await page.getByRole("button", { name: "Build whole-game study" }).click();
  await expect(page.locator(".game-coach-result")).toContainText("Practice recommendations");
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
  await expect(page.locator(".library-score")).toHaveCount(60);
  await page.getByRole("button", { name: /Load 24 more/ }).click();
  await expect(page.locator(".library-score")).toHaveCount(84);
});

test("offers first-run whole-history analysis and persists bulk cancellation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedConnectedLibrary(page, 2);
  await seedPausedHistoryJob(page, ["chesscom:fixture-0", "chesscom:fixture-1"]);
  await page.goto("/training");

  await expect(page.getByRole("button", { name: "Analyze my history" })).toBeVisible();
  // The account is listed as a population, so the imported games are named here
  // rather than in a first-run empty state.
  await expect(page.locator(".study-runs-only")).toContainText("2 of 2 imported games in this scope have no objective analysis yet");
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator(".history-job-list")).toContainText("cancelled");
  await page.reload();
  await expect(page.locator(".history-job-list")).toContainText("cancelled");
  await expect(page.getByRole("button", { name: "Resume" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("removes only a finished run record and keeps synced data", async ({ page }) => {
  await seedConnectedLibrary(page, 1);
  const job = await seedPausedHistoryJob(page, ["chesscom:fixture-0"]);
  await page.goto("/training");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator(".history-job-list")).toContainText("cancelled");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Remove from history" }).click();
  await expect(page.getByText("Analysis runs", { exact: true })).toHaveCount(0);
  // The synced game itself survives the run removal, and the folded page still
  // names it as unanalyzed work.
  await expect(page.locator(".study-runs-only")).toContainText("1 of 1 imported games in this scope have no objective analysis yet");
  await page.reload();
  await expect(page.locator(".study-runs-only")).toContainText("1 of 1 imported games in this scope have no objective analysis yet");

  const finishedJob = {
    ...job,
    id: "history-job-clear-fixture",
    status: "completed" as const,
    updatedAt: "2026-08-25T00:00:00.000Z",
    completedAt: "2026-08-25T00:00:00.000Z",
    items: job.items.map((item) => ({ ...item, status: "cached" as const })),
  };
  await page.evaluate(async (value) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("open-chess-review");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("history-analysis-jobs", "readwrite");
    transaction.objectStore("history-analysis-jobs").put(value, value.id);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, finishedJob);
  await page.reload();
  await expect(page.getByRole("button", { name: "Clear finished runs" })).toBeVisible();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Clear finished runs" }).click();
  await expect(page.getByText("Analysis runs", { exact: true })).toHaveCount(0);
  await expect(page.locator(".study-runs-only")).toContainText("1 of 1 imported games in this scope have no objective analysis yet");
});

test("shows successful history items and the exact reason for failed items", async ({ page }) => {
  await seedPartialHistoryJob(page);
  await page.goto("/training");

  // The one game in scope cannot carry the statistics report, so the run itself is
  // what Training shows here — and its controls have to be reachable at any population.
  // The select counts the account's imported population; one of the two games has
  // a cached analysis and one failed.
  await expect(page.locator(".study-player-select")).toContainText("2 games");
  await expect(page.locator(".history-run-heading")).toContainText("Analysis runs");
  await expect(page.locator(".history-job-list")).toContainText("1/2 complete · 0 analyzed · 1 cache reused");
  await page.getByText("Why 1 game failed", { exact: true }).click();
  await expect(page.locator(".history-job-details").first()).toContainText("Stockfish worker exited before returning a completed line.");
  await page.getByText("Successful analyses (1)", { exact: true }).click();
  await expect(page.locator(".history-job-details").last()).toContainText("Loaded from objective cache.");
});

test("lists a connected account before any of its games is analyzed", async ({ page }) => {
  await seedReview(page);
  await seedConnectedLibrary(page, 2, { pgn: '[Event "Imported"]\n[White "ice-345"]\n[Black "Rival"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 *' });
  await page.goto("/training");

  // An imported account is a population before it is a report. It is listed, and the
  // folded page offers the work that would analyze it, instead of hiding the account
  // behind the manual player that happens to have one analyzed game.
  await expect(page.locator(".study-player-select select")).toHaveValue("account:chesscom:hikaru");
  await expect(page.locator(".study-player-select")).toContainText("2 games");
  await expect(page.locator(".study-nav")).toHaveCount(0);
  await expect(page.locator(".study-runs-only")).toContainText("2 of 2 imported games in this scope have no objective analysis yet");
  await expect(page.getByRole("button", { name: "Analyze my history" })).toBeEnabled();
});

test("starts objective analysis automatically after full-history import", async ({ page }) => {
  await seedConnectedLibrary(page, 1);
  await seedReview(page);
  const account = {
    id: "chesscom:hikaru",
    provider: "chesscom",
    username: "Hikaru",
    displayName: "Hikaru Nakamura",
    authMode: "public-username",
    verified: false,
    linkedAt: "2026-08-20T00:00:00.000Z",
    lastSyncAt: "2026-08-23T00:00:00.000Z",
    ratings: { rapid: 2810, blitz: 2901 },
  };
  await page.route("**/api/platforms/chesscom/sync", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    json: { provider: "chesscom", account, games: [], done: true, progress: { completed: 1, total: 1 } },
  }));
  await page.goto("/settings");
  await page.getByRole("button", { name: "Import full history" }).click();
  await expect(page.getByRole("status")).toContainText("Background Stockfish analysis", { timeout: 10_000 });
  await page.goto("/training");
  await expect(page.locator(".study-player-select select")).toHaveValue("account:chesscom:hikaru", { timeout: 10_000 });
  // The imported population is small, so the report stays folded and Training
  // reports the run the import started instead.
  await expect(page.locator(".study-player-select")).toContainText("1 game", { timeout: 10_000 });
  await expect(page.locator(".history-run-heading")).toContainText("Analysis runs", { timeout: 10_000 });
});

test("resumes a persisted whole-history job to completion", async ({ page }) => {
  await seedConnectedLibrary(page, 1);
  await seedReview(page);
  await seedPausedHistoryJob(page, ["chesscom:fixture-0"]);
  await page.goto("/training");
  await expect(page.locator(".study-analysis-status")).toContainText("0 / 1 games analyzed · paused");

  // The paused run is on the page itself, at this population too: without the
  // report there would otherwise be no way to continue the work the status reports.
  await expect(page.locator(".history-run-heading")).toContainText("Analysis runs");
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.locator(".history-job-list")).toContainText("completed", { timeout: 45_000 });
  await expect(page.locator(".history-job-list")).toContainText("1/1 complete");
  await page.reload();
  await expect(page.locator(".history-job-list")).toContainText("completed");
});

test("builds advanced study evidence and persists an actionable training queue", async ({ page }) => {
  const fixtures = await seedAdvancedStudy(page, { reportPopulation: true });
  await page.goto("/stats");

  await expect(page.getByRole("heading", { name: "Your game", exact: true })).toBeVisible();
  await expect(page.locator(".study-player-select select")).toHaveValue("manual:ada");
  await expect(page.locator(".study-ink-stats")).toContainText("5");
  await expect(page.getByText("No platform rating in this scope", { exact: true })).toBeVisible();

  if (await page.getByText("Change scope", { exact: true }).count()) {
    await page.getByText("Change scope", { exact: true }).click();
  }
  await page.getByLabel("Color").selectOption("black");
  await expect(page.locator(".study-overview .study-ink-stats span").filter({ hasText: "Games" }).locator("strong")).toHaveText("0");
  // An empty scope is neither covered nor partial, and the Coverage view has to say so.
  await page.getByRole("button", { name: "Coverage" }).click();
  await expect(page.locator("#coverage")).toContainText("No imported games match this scope yet");
  await expect(page.locator("#coverage")).not.toContainText("complete current analysis coverage");
  await page.getByRole("button", { name: "Overview" }).click();
  await page.getByLabel("Color").selectOption("all");

  await page.getByRole("button", { name: "Openings" }).click();
  await expect(page.getByText("Italian Game", { exact: true })).toBeVisible();
  await page.getByLabel("Minimum sample").selectOption("5");
  await expect(page.getByText("No recognized openings.")).toBeVisible();
  await page.getByLabel("Minimum sample").selectOption("1");
  const openingEvidence = page.locator(".repertoire-list .training-sources a").first();
  const openingHref = await openingEvidence.getAttribute("href");
  expect(openingHref).toMatch(/^\/review\/[a-f0-9]+\/moves\?ply=\d+$/);
  await openingEvidence.click();
  await expect(page).toHaveURL(new RegExp(`${openingHref!.replace(/[?]/g, "\\?")}$`));

  await page.goto("/stats");
  await expect(page.locator(".study-player-select select")).toHaveValue("manual:ada");
  await page.getByRole("button", { name: "Highlights", exact: true }).click();
  await page.getByRole("link", { name: "Open in Review →" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/review/${fixtures[0]!.record.id}/moves\\?ply=5$`));

  await page.goto("/stats");
  await expect(page.locator(".study-player-select select")).toHaveValue("manual:ada");
  await page.getByRole("button", { name: "Plan", exact: true }).click();
  await expect(page.locator("#training-plan").getByText("Opening decisions", { exact: true })).toBeVisible();
  await expect(page.locator("#training-plan").getByText("Missed opportunities", { exact: true })).toBeVisible();

  const missedCard = page.locator(".weakness-grid > article").filter({ hasText: "Missed opportunities" });
  await missedCard.getByRole("button", { name: "Add to queue" }).click();
  await expect(page.getByRole("status")).toContainText("added to the training queue");
  await page.goto("/training");
  await expect(page.locator(".training-list")).toContainText("Missed opportunities");

  await page.locator(".training-list").getByRole("button", { name: "Start review" }).click();
  await expect(page.locator(".move-status")).toContainText("2. Nf3");
  await expect(page.getByRole("region", { name: "Position review task" })).toContainText("0 / 2 positions reviewed");
  await page.getByRole("button", { name: "Mark position reviewed" }).click();
  await expect(page.getByRole("region", { name: "Position review task" })).toContainText("1 / 2 positions reviewed");
  // A review with the evidence on screen says so, and claims no mastery.
  await expect(page.getByRole("region", { name: "Position review task" })).toContainText("Learning · next review");
  await page.getByRole("link", { name: "Pause and return to Practice" }).click();
  await expect(page).toHaveURL(/\/training$/);
  await page.reload();
  await page.locator(".training-list").getByRole("button", { name: "Continue review" }).click();
  await expect(page.locator(".move-status")).toContainText("2. Nf3");
  await expect(page.getByRole("button", { name: "Mark position reviewed" })).toBeEnabled();

  // The second position reviewed unaided stays open, because reviewing every position
  // is not mastery: Training's own list says what the two reviews were worth, one read
  // with the evidence on screen and one produced unaided.
  await page.getByRole("button", { name: "I knew this move" }).click();
  await expect(page.getByRole("region", { name: "Position review task" })).toContainText("In review · next review");
  await expect(page.getByRole("region", { name: "Position review task" })).toContainText("This position is not due again until");
  await page.goto("/training");
  await expect(page.locator(".training-list")).toContainText("in progress");
  await expect(page.locator(".training-list")).toContainText("0 mastered");
});

test("ANNOTATIONS use quality icons and the played-move label follows Brilliant", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { record } = await seedReview(page, { visualLabels: true });
  await page.goto(`/review/${record.id}`);
  await openReviewGameSummary(page);
  await expect(page.getByText("ANNOTATIONS", { exact: true })).toBeVisible();
  await expect(page.locator(".annotation-count").filter({ hasText: "Brilliant" }).locator("svg")).toHaveCount(1);
  await expect(page.locator(".annotation-count").filter({ hasText: "Critical" }).locator("svg")).toHaveCount(1);
  await expect(page.locator(".annotation-count").filter({ hasText: "Sacrifice" }).locator("svg")).toHaveCount(1);
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator(".objective-verdict > strong")).toContainText("Brilliant");
  await expect(page.locator(".objective-route .review-move-list button.active .move-quality svg[aria-label='Sacrifice']")).toBeVisible();
  const brilliantAnnotations = page.locator(".annotation-count").filter({ hasText: "Brilliant" }).first();
  // The counts live in the panel's own scroll area, so reaching them must not
  // depend on the document scroll: move the panel and prove it lands inside.
  expect(await brilliantAnnotations.evaluate((element) => {
    // The panel that scrolls is whichever ancestor actually overflows; walking to
    // it keeps this about the behaviour (the counts scroll into view) rather than
    // about which element carries the overflow.
    let scroller: HTMLElement | null = element.parentElement;
    while (scroller && scroller !== document.body) {
      const overflowY = getComputedStyle(scroller).overflowY;
      if ((overflowY === "auto" || overflowY === "scroll") && scroller.scrollHeight > scroller.clientHeight) break;
      scroller = scroller.parentElement;
    }
    if (!scroller) return false;
    scroller.scrollTop += element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 40;
    const box = element.getBoundingClientRect();
    const panelBox = scroller.getBoundingClientRect();
    return box.top >= panelBox.top - 1 && box.bottom <= panelBox.bottom + 1;
  })).toBe(true);
});

test("Evaluation timeline stays inside the scroll-aligned Game Summary panel", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { record } = await seedReview(page);
  await page.goto(`/review/${record.id}`);
  await openReviewTimeline(page);
  await expect(page.locator(".timeline-panel")).toBeVisible();
  const layout = await page.evaluate(() => {
    const board = document.querySelector(".position-workspace")!.getBoundingClientRect();
    const panel = document.querySelector(".context-panel")!.getBoundingClientRect();
    const summary = document.querySelector(".game-summary-section")!.getBoundingClientRect();
    const timeline = document.querySelector(".game-summary-section .timeline-panel")!.getBoundingClientRect();
    return {
      boardTop: board.top,
      panelTop: panel.top,
      timelineTop: timeline.top,
      panelWidth: panel.width,
      panelRight: panel.right,
      timelineRight: timeline.right,
      summaryLeft: summary.left,
      timelineLeft: timeline.left,
      timelineWidth: timeline.width,
    };
  });
  expect(Math.abs(layout.boardTop - layout.panelTop)).toBeLessThan(6);
  expect(layout.timelineTop).toBeGreaterThanOrEqual(layout.panelTop);
  expect(layout.timelineRight).toBeLessThanOrEqual(layout.panelRight + 1);
  expect(layout.timelineLeft).toBeGreaterThanOrEqual(layout.summaryLeft - 1);
  expect(layout.timelineWidth).toBeLessThanOrEqual(layout.panelWidth + 1);
});

test("shows what the last analysis run's engine actually did", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { record } = await seedReview(page);
  // A run that stalled without engine traffic is the case this record exists for, so
  // the timeline is seeded exactly as a stalled run leaves it: workers spawned, then
  // nothing — while the progress counter cannot say that.
  await writeStores(page, { "review-runs": [[record.id, {
    version: 1,
    reviewId: record.id,
    runId: "fixture-run",
    status: "running",
    depth: 10,
    updatedAt: "2026-08-23T00:00:00.000Z",
    diagnostics: {
      startedAt: "2026-08-23T00:00:00.000Z",
      dropped: 2,
      events: [
        { at: 0, kind: "review-start", detail: { depth: 10, multiPositions: 21 } },
        { at: 6, kind: "worker-spawn", worker: 0, detail: { url: "/engine/stockfish.js" } },
        { at: 7, kind: "worker-spawn", worker: 1, detail: { url: "/engine/stockfish.js" } },
      ],
    },
  }]] });
  await page.goto(`/review/${record.id}/engine`);

  const panel = page.locator(".run-diagnostics");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("0 searches · no completed search · 2 engines started");
  await expect(panel).toContainText("2 earlier event(s) dropped");
  await expect(panel).toContainText("worker-spawn · engine 0");
  await expect(panel).toContainText("review-start");

  // Copying is the point of the button: a refused clipboard must say so instead of
  // looking like it worked, and a permitted one must confirm.
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("denied")) } });
  });
  await page.getByRole("button", { name: "Copy diagnostics" }).click();
  await expect(panel.getByRole("alert")).toContainText("Could not copy");
  // The outcome is functional text, not decoration: it must not fall to the browser's
  // default `small` size on a 12px parent.
  const alertSize = await panel.getByRole("alert").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(alertSize).toBeGreaterThanOrEqual(11);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.resolve() } });
  });
  await page.getByRole("button", { name: "Copy diagnostics" }).click();
  await expect(panel.getByRole("status")).toContainText("Diagnostics copied");
});

test("Chess.com PGN review loads both player avatars", async ({ page }) => {
  await page.route("**/api/platforms/player-avatar**", async (route) => {
    const url = new URL(route.request().url());
    const username = url.searchParams.get("username")?.toLowerCase() ?? "player";
    await route.fulfill({
      json: {
        provider: "chesscom",
        username,
        avatarUrl: `https://images.chesscomfiles.com/uploads/v1/user/${username}.png`,
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("Paste a complete PGN").fill(`[Event "Live Chess"]
[Site "Chess.com"]
[White "Hikaru"]
[Black "MagnusCarlsen"]
[Result "*"]

1. e4 e5 *`);
  await page.getByRole("button", { name: "Analyze game →" }).click();
  await expect(page).toHaveURL(/\/review\//);
  await expect(page.locator(".player-strip.player-white img")).toHaveAttribute("src", /hikaru/, { timeout: 20_000 });
  await expect(page.locator(".player-strip.player-black img")).toHaveAttribute("src", /magnuscarlsen/);
});
