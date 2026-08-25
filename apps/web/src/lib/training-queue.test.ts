import { describe, expect, it } from "vitest";
import type { RecurringWeakness } from "@chess-review/analysis";
import { createTrainingQueueItem, trainingQueueItemId, transitionTrainingQueueItem } from "./training-queue";

const weakness: RecurringWeakness = {
  kind: "opening-decisions",
  gameCount: 2,
  incidentCount: 2,
  priority: 72,
  averageWinPercentLoss: 24,
  evidence: [
    { gameId: "g1", ply: 7, san: "Be3", phase: "opening", classification: "mistake", winPercentLoss: 18 },
    { gameId: "g2", ply: 9, san: "h3", phase: "opening", classification: "blunder", winPercentLoss: 30 },
  ],
};

describe("training queue state", () => {
  it("creates stable evidence-bearing tasks and preserves progress timestamps", () => {
    const queued = createTrainingQueueItem("ada", weakness, "2026-08-01T00:00:00.000Z");
    expect(queued).toMatchObject({
      id: trainingQueueItemId("ada", "opening-decisions"),
      status: "queued",
      priority: 72,
      evidence: weakness.evidence,
    });

    const completed = transitionTrainingQueueItem(queued, "completed", "2026-08-02T00:00:00.000Z");
    expect(completed.completedAt).toBe("2026-08-02T00:00:00.000Z");
    const resumed = transitionTrainingQueueItem(completed, "in-progress", "2026-08-03T00:00:00.000Z");
    expect(resumed.completedAt).toBeUndefined();
    expect(resumed.createdAt).toBe(queued.createdAt);
  });
});
