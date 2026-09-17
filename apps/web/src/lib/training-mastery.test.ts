import { describe, expect, it } from "vitest";
import type { TrainingQueueItemV3, TrainingPositionReview } from "@chess-review/shared";
import {
  MASTERED_STREAK,
  MASTERY_INTERVAL_DAYS,
  dueTrainingPositions,
  masteryIntervalDays,
  masterySummary,
  masteryTransition,
  reviewDueAt,
} from "./training-mastery";

const NOW = new Date("2026-09-16T12:00:00.000Z");
const days = (count: number) => new Date(NOW.getTime() + count * 24 * 60 * 60 * 1000);

function review(overrides: Partial<TrainingPositionReview>): TrainingPositionReview {
  return { gameId: "game-1", ply: 5, reviewedAt: "2026-09-15T12:00:00.000Z", ...overrides };
}

function item(overrides: Partial<TrainingQueueItemV3> = {}): TrainingQueueItemV3 {
  return {
    version: 3,
    id: "task-1",
    playerKey: "manual:ada",
    weaknessKind: "opening-decisions",
    status: "queued",
    priority: 50,
    evidence: [],
    sourceReportVersion: "advanced-study-v2",
    progress: { reviewedPositionCount: 0, totalPositionCount: 2, positions: [] },
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("training mastery", () => {
  it("promotes only on unaided reviews the schedule is waiting for", () => {
    const first = masteryTransition(undefined, "unaided", NOW);
    expect(first).toEqual({ mastery: "review", streak: 1, attempts: 1, dueAt: days(1).toISOString() });

    // Each further review happens on the day it became due.
    const second = masteryTransition(first, "unaided", days(1));
    expect(second).toEqual({ mastery: "review", streak: 2, attempts: 2, dueAt: days(4).toISOString() });

    const third = masteryTransition(second, "unaided", days(4));
    expect(third.mastery).toBe("mastered");
    expect(third.streak).toBe(MASTERED_STREAK);
    expect(third.dueAt).toBe(days(11).toISOString());

    const fourth = masteryTransition(third, "unaided", days(11));
    expect(fourth.mastery).toBe("mastered");
    expect(fourth.dueAt).toBe(days(11 + MASTERY_INTERVAL_DAYS.at(-1)!).toISOString());
  });

  it("records a review before the position comes round without paying it any credit", () => {
    const learned = { mastery: "review" as const, streak: 2, attempts: 2, dueAt: days(3).toISOString() };

    // Three clicks in one sitting must not earn mastery, so an early unaided review only
    // raises the attempt count and leaves the state and the schedule alone.
    const early = masteryTransition(learned, "unaided", NOW);
    expect(early).toEqual({ mastery: "review", streak: 2, attempts: 3, dueAt: learned.dueAt });
    expect(masteryTransition(early, "unaided", NOW)).toMatchObject({ streak: 2, attempts: 4 });

    // The moment it is due, the same review counts.
    expect(masteryTransition(learned, "unaided", days(3))).toMatchObject({ streak: 3, attempts: 3, mastery: "mastered" });

    // A record with no schedule waits for nothing, so it counts (legacy imports).
    expect(masteryTransition({ mastery: "learning", streak: 0, attempts: 1 }, "unaided", NOW)).toMatchObject({ streak: 1, attempts: 2 });
  });

  it("treats help and a shown answer as lapses, not as progress", () => {
    const mastered = { mastery: "mastered" as const, streak: 3, attempts: 3 };

    for (const outcome of ["hinted", "exposed"] as const) {
      expect(masteryTransition(mastered, outcome, NOW)).toEqual({
        mastery: "learning",
        streak: 0,
        attempts: 4,
        dueAt: days(1).toISOString(),
      });
    }
  });

  it("keeps a record written before outcomes from claiming recall", () => {
    const legacy = masteryTransition({ mastery: "learning", streak: 0, attempts: 1 }, "legacy", NOW);

    expect(legacy).toEqual({ mastery: "learning", streak: 0, attempts: 2, dueAt: days(1).toISOString() });
    expect(legacy.streak).toBe(0);
  });

  it("schedules a due queue from the recorded reviews, oldest first", () => {
    const task = item({
      progress: {
        reviewedPositionCount: 3,
        totalPositionCount: 3,
        positions: [
          review({ ply: 1, dueAt: days(-1).toISOString() }),
          review({ ply: 2, dueAt: days(-3).toISOString() }),
          review({ ply: 3, dueAt: days(2).toISOString() }),
        ],
      },
    });

    expect(dueTrainingPositions(task, NOW).map(({ ply }) => ply)).toEqual([2, 1]);
    expect(masterySummary(task, NOW)).toEqual({ reviewed: 3, unreviewed: 0, mastered: 0, due: 2 });
  });

  it("reports the next due date when nothing is due yet, and counts mastered positions", () => {
    const task = item({
      progress: {
        reviewedPositionCount: 2,
        totalPositionCount: 2,
        positions: [
          review({ ply: 1, mastery: "mastered", dueAt: days(4).toISOString() }),
          review({ ply: 2, mastery: "learning", dueAt: days(9).toISOString() }),
        ],
      },
    });

    expect(masterySummary(task, NOW)).toEqual({ reviewed: 2, unreviewed: 0, mastered: 1, due: 0, nextDueAt: days(4).toISOString() });
  });

  it("counts positions that have never been reviewed as work that is ready now", () => {
    const task = item({
      evidence: [
        { gameId: "game-1", ply: 5, san: "Nf3", phase: "middlegame", classification: "mistake", winPercentLoss: 12 },
        { gameId: "game-1", ply: 7, san: "Bb5", phase: "middlegame", classification: "mistake", winPercentLoss: 9 },
      ],
      progress: { reviewedPositionCount: 1, totalPositionCount: 2, positions: [review({ ply: 5, dueAt: days(3).toISOString() })] },
    });

    // The schedule knows nothing about the unreviewed position, so the count has to.
    expect(masterySummary(task, NOW)).toMatchObject({ reviewed: 1, unreviewed: 1, due: 0, nextDueAt: days(3).toISOString() });
  });

  it("treats a record without a schedule as due rather than as never due", () => {
    expect(reviewDueAt(review({}))).toBe(Date.parse("2026-09-15T12:00:00.000Z"));
    expect(dueTrainingPositions(item({ progress: { reviewedPositionCount: 1, totalPositionCount: 1, positions: [review({})] } }), NOW)).toHaveLength(1);
  });

  it("uses a fixed ladder, so the same history always schedules the same day", () => {
    expect(MASTERY_INTERVAL_DAYS).toEqual([1, 3, 7, 21]);
    expect([0, 1, 2, 3, 4, 9].map(masteryIntervalDays)).toEqual([1, 1, 3, 7, 21, 21]);
  });
});
