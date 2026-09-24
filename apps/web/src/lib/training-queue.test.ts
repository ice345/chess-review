import { describe, expect, it } from "vitest";
import type { RecurringWeakness } from "@chess-review/analysis";
import type { TrainingEvidenceReference } from "@chess-review/shared";
import { createTrainingQueueItem, planTrainingAddition, todaysTrainingTask, trainingGameContribution, trainingQueueItemId, transitionTrainingQueueItem } from "./training-queue";

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

  it("counts a game's positions, not the queue items that hold them", () => {
    // One task holding three of this game's positions plus one from another game.
    const mixed = createTrainingQueueItem("ada", {
      ...weakness,
      evidence: [
        { gameId: "g1", ply: 7, san: "Be3", phase: "opening", classification: "mistake", winPercentLoss: 18 },
        { gameId: "g1", ply: 12, san: "Nf3", phase: "opening", classification: "inaccuracy", winPercentLoss: 9 },
        { gameId: "g1", ply: 19, san: "h3", phase: "middlegame", classification: "blunder", winPercentLoss: 31 },
        { gameId: "g2", ply: 9, san: "h3", phase: "opening", classification: "blunder", winPercentLoss: 30 },
      ],
    });
    expect(trainingGameContribution([mixed], "g1")).toEqual({ tasks: 1, positions: 3 });
    expect(trainingGameContribution([mixed], "g2")).toEqual({ tasks: 1, positions: 1 });

    // Two tasks naming the same game position count that position once.
    const repeated = { ...mixed, evidence: [{ gameId: "g1", ply: 7, san: "Be3", phase: "opening" as const, classification: "mistake" as const, winPercentLoss: 18 }] };
    expect(trainingGameContribution([mixed, repeated], "g1")).toEqual({ tasks: 2, positions: 3 });
    expect(trainingGameContribution([mixed], "g3")).toEqual({ tasks: 0, positions: 0 });
  });
});

function evidence(gameId: string, ply: number, san = "Nf3"): TrainingEvidenceReference {
  return { gameId, ply, san, phase: "middlegame", classification: "mistake", winPercentLoss: 12 };
}

function profile(kind: RecurringWeakness["kind"], items: TrainingEvidenceReference[]): RecurringWeakness {
  return { kind, gameCount: 1, incidentCount: items.length, priority: 60, averageWinPercentLoss: 12, evidence: items };
}

describe("training addition planning", () => {
  it("offers a new task for a learner who has none", () => {
    const plan = planTrainingAddition([], "manual:ada", [profile("middlegame-decisions", [evidence("g1", 3), evidence("g1", 7)])], "2026-09-01T00:00:00.000Z");

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      kind: "middlegame-decisions",
      taskId: trainingQueueItemId("manual:ada", "middlegame-decisions"),
      alreadyPresent: 0,
      deferred: 0,
    });
    expect(plan[0]?.add.map((item) => `${item.gameId}:${item.ply}`)).toEqual(["g1:3", "g1:7"]);
    expect(plan[0]?.item.evidence).toEqual([]);
    expect(plan[0]?.item.version).toBe(3);
  });

  it("adds only what the task does not already hold, and counts the rest", () => {
    const existing = createTrainingQueueItem("manual:ada", profile("middlegame-decisions", [evidence("g1", 3)]), "2026-09-01T00:00:00.000Z");
    const plan = planTrainingAddition([existing], "manual:ada", [profile("middlegame-decisions", [evidence("g1", 3), evidence("g1", 7)])]);

    expect(plan[0]?.add.map((item) => item.ply)).toEqual([7]);
    expect(plan[0]?.alreadyPresent).toBe(1);
    expect(plan[0]?.item.id).toBe(existing.id);
  });

  it("does not add a position another of the learner's tasks already holds", () => {
    const other = createTrainingQueueItem("manual:ada", profile("opening-decisions", [evidence("g2", 5)]), "2026-09-01T00:00:00.000Z");
    const plan = planTrainingAddition([other], "manual:ada", [profile("middlegame-decisions", [evidence("g2", 5)])]);

    expect(plan[0]?.add).toEqual([]);
    expect(plan[0]?.alreadyPresent).toBe(1);
  });

  it("respects the task's evidence cap and reports what did not fit", () => {
    const full = createTrainingQueueItem("manual:ada", profile("middlegame-decisions", [
      evidence("g0", 1), evidence("g0", 2), evidence("g0", 3), evidence("g0", 4), evidence("g0", 5),
    ]), "2026-09-01T00:00:00.000Z");
    const plan = planTrainingAddition([full], "manual:ada", [profile("middlegame-decisions", [evidence("g1", 7), evidence("g1", 9)])]);

    expect(plan[0]?.add).toEqual([]);
    expect(plan[0]?.deferred).toBe(2);
  });

  it("never mixes another learner's task into the plan", () => {
    const otherLearner = createTrainingQueueItem("manual:grace", profile("middlegame-decisions", [evidence("g1", 3)]), "2026-09-01T00:00:00.000Z");
    const plan = planTrainingAddition([otherLearner], "manual:ada", [profile("middlegame-decisions", [evidence("g1", 3)])]);

    expect(plan[0]?.add.map((item) => item.ply)).toEqual([3]);
    expect(plan[0]?.alreadyPresent).toBe(0);
    expect(plan[0]?.item.id).not.toBe(otherLearner.id);
  });
});

describe("today's training task", () => {
  const queued = createTrainingQueueItem("ada", weakness, "2026-08-01T00:00:00.000Z");
  const started = transitionTrainingQueueItem(queued, "in-progress", "2026-08-02T00:00:00.000Z");
  const finished = transitionTrainingQueueItem(queued, "completed", "2026-08-03T00:00:00.000Z");
  const higherPriority = createTrainingQueueItem("ada", {
    ...weakness,
    kind: "endgame-decisions",
    priority: 91,
  }, "2026-08-04T00:00:00.000Z");

  it("offers the task in progress, otherwise the highest-priority open one", () => {
    expect(todaysTrainingTask([higherPriority, queued])?.id).toBe(higherPriority.id);
    expect(todaysTrainingTask([higherPriority, started])?.id).toBe(started.id);
  });

  it("never offers a task that is already completed", () => {
    expect(todaysTrainingTask([finished])).toBeUndefined();
    expect(todaysTrainingTask([finished, queued])?.id).toBe(queued.id);
  });

  it("offers a task whose positions have come round again before one merely started", () => {
    const now = new Date("2026-09-10T12:00:00.000Z");
    // A task whose single position was reviewed a week ago and is due now.
    const due = {
      ...queued,
      evidence: [evidence("g1", 3)],
      progress: { reviewedPositionCount: 1, totalPositionCount: 1, positions: [{ gameId: "g1", ply: 3, reviewedAt: "2026-09-03T12:00:00.000Z", outcome: "unaided" as const, mastery: "review" as const, streak: 1, attempts: 1, dueAt: "2026-09-09T12:00:00.000Z" }] },
    };
    // The same task, reviewed yesterday: not due yet.
    const later = { ...due, progress: { ...due.progress, positions: [{ ...due.progress.positions[0]!, dueAt: "2026-09-20T12:00:00.000Z" }] } };

    expect(todaysTrainingTask([started, due], now)?.id).toBe(due.id);
    expect(todaysTrainingTask([started, later], now)?.id).toBe(started.id);
    expect(todaysTrainingTask([started, later], now)?.status).toBe("in-progress");
  });
});

// The evidence id stays on the fault; the board opens before that move.
describe("decision navigation", () => {
  it.each([1, 2, 7])("opens the decision before ply %i without shifting evidence identity", async (ply) => {
    const { decisionReviewHref, trainingReviewHref } = await import("./training-queue");
    const { parsePgn } = await import("@chess-review/chess-core");
    const { useReviewStore } = await import("../store/review-store");
    const game = parsePgn("1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 *");
    const source = evidence("game", ply, game.plies[ply - 1]!.san);
    const task = createTrainingQueueItem("ada", profile("opening-decisions", [source]));
    for (const href of [decisionReviewHref(source), trainingReviewHref(task, source)]) {
      const url = new URL(href, "http://localhost");
      useReviewStore.setState({ game });
      useReviewStore.getState().goToPly(Number(url.searchParams.get("ply")));
      expect(useReviewStore.getState().positionFen).toBe(game.plies[ply - 1]!.fenBefore);
    }
    const url = new URL(trainingReviewHref(task, source), "http://localhost");
    expect(url.searchParams.get("position")).toBe(`game:${ply}`);
    expect(url.searchParams.get("training")).toBe(task.id);
  });
});
