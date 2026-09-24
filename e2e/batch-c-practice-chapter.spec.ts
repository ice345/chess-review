import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  DATA_STORES,
  LOCAL_META_STORE,
} from "../apps/web/src/lib/browser-storage";
import { createTrainingQueueItem } from "../apps/web/src/lib/training-queue";
import {
  mockLocalAi,
  seedAdvancedStudy,
  seedConnectedLibrary,
  writeStores,
} from "./fixtures";

const OUT = "/Users/ice/Code/chess-review/tmp/batch-c-shots";
mkdirSync(OUT, { recursive: true });

async function clearBrowserData(page: Page) {
  await page.goto("/");
  await page.evaluate(async ({ name }) => {
    await new Promise<void>((resolve, reject) => {
      const del = indexedDB.deleteDatabase(name);
      del.onsuccess = () => resolve();
      del.onerror = () => reject(del.error);
      del.onblocked = () => resolve();
    });
  }, { name: DATABASE_NAME });
}

async function probe(page: Page) {
  return page.evaluate(() => {
    const kicker = document.querySelector(".practice-chapter-head .page-kicker, .study-heading .page-kicker")?.textContent?.trim() ?? null;
    const steps = [...document.querySelectorAll(".practice-score-desk > li")].map((li) => ({
      id: li.getAttribute("data-step"),
      done: li.getAttribute("data-done") === "true",
      label: li.querySelector(".practice-score-desk-label")?.textContent?.trim() ?? null,
    }));
    const revisit = Boolean(document.querySelector(".practice-revisit-mark"));
    const rehearsal = Boolean(document.querySelector(".practice-rehearsal"));
    const method = Boolean(document.querySelector(".practice-method"));
    // Unanalyzed games must not invent "continue at ply N". Analyzed review links may use ply=.
    const fakePly = [...document.querySelectorAll("a")].some((a) => /continue\s+at\s+ply/i.test(a.textContent ?? ""));
    const today = document.querySelector(".training-today h2")?.textContent?.trim() ?? null;
    const player = (document.querySelector(".study-player-select select") as HTMLSelectElement | null)?.selectedOptions[0]?.textContent?.trim() ?? null;
    return { kicker, steps, revisit, rehearsal, method, fakePly, today, player };
  });
}

test.describe("Batch C — Practice chapter binding", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockLocalAi(page, "offline");
  });

  test("empty player shows BEGIN and empty score-desk", async ({ page }) => {
    await clearBrowserData(page);
    // Recreate empty stores so the app can open cleanly.
    await page.evaluate(async ({ name, version, stores }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name, version);
        request.onupgradeneeded = () => {
          for (const store of stores) {
            if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
          }
        };
        request.onsuccess = () => { request.result.close(); resolve(); };
        request.onerror = () => reject(request.error);
      });
    }, { name: DATABASE_NAME, version: DATABASE_VERSION, stores: [...DATA_STORES, LOCAL_META_STORE] });

    await page.goto("/training");
    await expect(page.getByRole("heading", { name: "Practice" })).toBeVisible();
    await expect(page.locator(".page-kicker")).toContainText("MOVEMENT I");
    await expect(page.locator(".page-kicker")).toContainText("BEGIN");
    const info = await probe(page);
    expect(info.steps.every((step) => step.done === false)).toBe(true);
    expect(info.rehearsal).toBe(true);
    expect(info.method).toBe(true);
    expect(info.fakePly).toBe(false);
    expect(info.today).toMatch(/Nothing imported|Nothing to train|No due|Checking/i);
    console.log("EMPTY", JSON.stringify(info));
    await page.screenshot({ path: `${OUT}/batch-c-empty-begin-1440.png`, fullPage: false });
  });

  test("imported unanalyzed shows OBSERVE; practiceable shows RETURN; player switch updates", async ({ page }) => {
    await clearBrowserData(page);
    // Player A: connected imports, no analysis → MOVEMENT II · OBSERVE
    await seedConnectedLibrary(page, 6, {
      pgn: `[Event "Batch C import only"]\n[White "BatchCEmpty"]\n[Black "Opponent"]\n[Result "*"]\n\n1. e4 e5 *`,
    });

    await page.goto("/training");
    await expect(page.getByRole("heading", { name: "Practice" })).toBeVisible();
    await expect(page.locator(".page-kicker")).toContainText("MOVEMENT II");
    await expect(page.locator(".page-kicker")).toContainText("OBSERVE");
    let info = await probe(page);
    expect(info.steps.find((s) => s.id === "import")?.done).toBe(true);
    expect(info.steps.find((s) => s.id === "observe")?.done).toBe(false);
    expect(info.fakePly).toBe(false);
    expect(info.rehearsal).toBe(true);
    console.log("OBSERVE", JSON.stringify(info));
    await page.screenshot({ path: `${OUT}/batch-c-observe-imported-1440.png`, fullPage: false });

    // Player B: analyzed Ada + saved/attempted task → MOVEMENT III · RETURN
    const games = await seedAdvancedStudy(page, { reportPopulation: true });
    const evidence = [games[0]!.analysis.moves[0]!, games[0]!.analysis.moves[2]!, games[1]!.analysis.moves[0]!].map((move, index) => ({
      gameId: games[index === 2 ? 1 : 0]!.record.id,
      ply: move.ply,
      san: move.san,
      phase: move.phase,
      classification: move.classification,
      winPercentLoss: move.classificationReason.winPercentLoss,
    }));
    const task = createTrainingQueueItem("manual:ada", {
      kind: "opening-decisions",
      gameCount: 2,
      incidentCount: 3,
      priority: 72,
      averageWinPercentLoss: 25,
      evidence,
    });
    task.progress = {
      ...task.progress,
      reviewedPositionCount: 1,
      positions: [{
        gameId: evidence[0]!.gameId,
        ply: evidence[0]!.ply,
        reviewedAt: "2026-09-22T00:00:00.000Z",
        outcome: "exposed",
        attempts: 1,
        dueAt: "2026-09-23T00:00:00.000Z",
        mastery: "learning",
      }],
    };
    await writeStores(page, { "training-queue": [[task.id, task]] });

    await page.goto("/training");
    await expect(page.locator(".study-player-select select")).toBeVisible();
    // Prefer Ada (practiceable) if not already selected.
    const select = page.locator(".study-player-select select");
    const options = await select.locator("option").allTextContents();
    const ada = options.findIndex((label) => /Ada/i.test(label));
    if (ada >= 0) {
      await select.selectOption({ index: ada });
    }
    await expect(page.locator(".page-kicker")).toContainText("MOVEMENT III");
    await expect(page.locator(".page-kicker")).toContainText("RETURN");
    await expect(page.locator(".practice-revisit-mark")).toBeVisible();
    info = await probe(page);
    expect(info.steps.find((s) => s.id === "import")?.done).toBe(true);
    expect(info.steps.find((s) => s.id === "observe")?.done).toBe(true);
    expect(info.steps.find((s) => s.id === "attempt")?.done).toBe(true);
    expect(info.steps.find((s) => s.id === "save")?.done).toBe(true);
    expect(info.steps.find((s) => s.id === "revisit")?.done).toBe(true);
    expect(info.rehearsal).toBe(true);
    expect(info.method).toBe(true);
    expect(info.fakePly).toBe(false);
    console.log("RETURN", JSON.stringify(info));
    await page.screenshot({ path: `${OUT}/batch-c-return-practiceable-1440.png`, fullPage: false });

    // Switch back to connected Hikaru → head/progress change toward OBSERVE
    const hikaru = options.findIndex((label) => /Hikaru/i.test(label));
    expect(hikaru).toBeGreaterThanOrEqual(0);
    await select.selectOption({ index: hikaru });
    await expect(page.locator(".page-kicker")).toContainText("MOVEMENT II");
    const switched = await probe(page);
    expect(switched.kicker).not.toBe(info.kicker);
    expect(switched.steps.find((s) => s.id === "observe")?.done).toBe(false);
    expect(switched.revisit).toBe(false);
    console.log("SWITCH", JSON.stringify(switched));
    await page.screenshot({ path: `${OUT}/batch-c-player-switch-1440.png`, fullPage: false });
  });
});
