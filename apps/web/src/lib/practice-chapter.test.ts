import { describe, expect, it } from "vitest";
import type { TrainingQueueItemV3 } from "@chess-review/shared";
import { practiceChapterProgress } from "./practice-chapter";

function queueItem(overrides: Partial<TrainingQueueItemV3> = {}): TrainingQueueItemV3 {
  return {
    version: 3,
    id: "task-1",
    playerKey: "manual:ada",
    weaknessKind: "middlegame-decisions",
    status: "queued",
    priority: 1,
    evidence: [{
      gameId: "g1",
      ply: 12,
      san: "Nxe5",
      phase: "middlegame",
      classification: "mistake",
      winPercentLoss: 18,
    }],
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
    sourceReportVersion: "advanced-study-v2",
    progress: {
      reviewedPositionCount: 0,
      totalPositionCount: 1,
      positions: [],
    },
    ...overrides,
  };
}

const base = {
  importedGameCount: 0,
  analyzedGameCount: 0,
  mistakeCount: 0,
  weaknessCount: 0,
  queue: [] as TrainingQueueItemV3[],
  hasTodayTask: false,
  queueState: "ready" as const,
  sourcesFailed: false,
  now: new Date("2026-09-24T09:00:00.000Z"),
};

describe("practiceChapterProgress", () => {
  it("maps no import to MOVEMENT I BEGIN with empty steps", () => {
    const chapter = practiceChapterProgress(base);
    expect(chapter.kicker).toBe("MOVEMENT I ——— BEGIN");
    expect(chapter.nudgeHref).toBe("/import");
    expect(chapter.steps.every((step) => !step.done)).toBe(true);
    expect(chapter.emptyKind).toBe("no-import");
    expect(chapter.hasRevisitMark).toBe(false);
  });

  it("maps imported but unanalyzed to MOVEMENT II OBSERVE", () => {
    const chapter = practiceChapterProgress({
      ...base,
      importedGameCount: 4,
      analyzedGameCount: 0,
    });
    expect(chapter.kicker).toBe("MOVEMENT II ——— OBSERVE");
    expect(chapter.steps.find((step) => step.id === "import")?.done).toBe(true);
    expect(chapter.steps.find((step) => step.id === "observe")?.done).toBe(false);
    expect(chapter.emptyKind).toBe("no-analysis");
    expect(chapter.nudgeHref).toBe("/history");
  });

  it("stays on OBSERVE when analyzed but nothing practiceable", () => {
    const chapter = practiceChapterProgress({
      ...base,
      importedGameCount: 2,
      analyzedGameCount: 2,
    });
    expect(chapter.kicker).toBe("MOVEMENT II ——— OBSERVE");
    expect(chapter.steps.find((step) => step.id === "observe")?.done).toBe(true);
    expect(chapter.emptyKind).toBe("no-due-tasks");
  });

  it("maps mistakes or tasks to MOVEMENT III RETURN", () => {
    const chapter = practiceChapterProgress({
      ...base,
      importedGameCount: 3,
      analyzedGameCount: 2,
      mistakeCount: 1,
      hasTodayTask: true,
      queue: [queueItem()],
    });
    expect(chapter.kicker).toBe("MOVEMENT III ——— RETURN");
    expect(chapter.emptyKind).toBe("ready");
    expect(chapter.steps.find((step) => step.id === "save")?.done).toBe(true);
    expect(chapter.hasRevisitMark).toBe(true);
  });

  it("fills attempt and revisit only from real review records", () => {
    const chapter = practiceChapterProgress({
      ...base,
      importedGameCount: 2,
      analyzedGameCount: 2,
      mistakeCount: 2,
      queue: [queueItem({
        progress: {
          reviewedPositionCount: 1,
          totalPositionCount: 1,
          positions: [{
            gameId: "g1",
            ply: 12,
            reviewedAt: "2026-09-22T00:00:00.000Z",
            outcome: "exposed",
            attempts: 1,
            dueAt: "2026-09-23T00:00:00.000Z",
            mastery: "learning",
          }],
        },
      })],
      hasTodayTask: true,
    });
    expect(chapter.steps.find((step) => step.id === "attempt")?.done).toBe(true);
    expect(chapter.steps.find((step) => step.id === "revisit")?.done).toBe(true);
  });

  it("distinguishes single-game mistakes without recurring weakness", () => {
    const chapter = practiceChapterProgress({
      ...base,
      importedGameCount: 1,
      analyzedGameCount: 1,
      mistakeCount: 3,
      weaknessCount: 0,
    });
    expect(chapter.kicker).toBe("MOVEMENT III ——— RETURN");
    expect(chapter.emptyKind).toBe("mistakes-without-weakness");
  });

  it("reports read failure without inventing progress", () => {
    const chapter = practiceChapterProgress({
      ...base,
      sourcesFailed: true,
      importedGameCount: 5,
      analyzedGameCount: 5,
    });
    expect(chapter.emptyKind).toBe("read-failure");
    // Failure must not fake-full the desk when we still know imports exist.
    expect(chapter.steps.find((step) => step.id === "import")?.done).toBe(true);
  });
});
