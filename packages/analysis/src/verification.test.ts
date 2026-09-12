import { describe, expect, it } from "vitest";
import type { GameAnalysisV2, MoveAnalysisV2, ObjectiveVerificationReason } from "@chess-review/shared";
import { OBJECTIVE_ALGORITHM_VERSION } from "./game-analysis";
import { planObjectiveVerification } from "./verification";

function move(ply: number, reasons: ObjectiveVerificationReason[] = []): MoveAnalysisV2 {
  return {
    ply,
    color: ply % 2 ? "white" : "black",
    san: "Nf3",
    uci: "g1f3",
    fenBefore: `before-${ply}`,
    fenAfter: `after-${ply}`,
    phase: "middlegame",
    evaluationBefore: { kind: "cp", cp: 20 },
    evaluationAfter: { kind: "cp", cp: 10 },
    playedMoveScore: { kind: "cp", cp: 10 },
    playedMoveOutsideMultiPv: false,
    quality: "good",
    annotations: [],
    objectiveVersion: "move-quality-v2",
    classification: "good",
    classificationReason: {
      precedenceRule: "fixture",
      qualityRule: "fixture",
      isEngineBest: false,
      engineRank: 2,
      winPercentBefore: 52,
      winPercentAfter: 51,
      winPercentLoss: 1,
      legalMoveCount: 20,
      isForced: false,
      isBook: false,
      isCheckmate: false,
      isObviousRecapture: false,
      isTrivialCheckEscape: false,
      playedMoveOutsideMultiPv: false,
      ...(reasons.length === 0 ? {} : { verification: { status: "baseline", depth: 10, multiPv: 3, reasons } }),
      exclusions: [],
    },
    stockfish: {
      fen: `before-${ply}`,
      score: { kind: "cp", cp: 20 },
      depth: 10,
      lines: [
        { rank: 1, score: { kind: "cp", cp: 20 }, depth: 10, pv: ["e2e4"] },
        { rank: 2, score: { kind: "cp", cp: 19 }, depth: 10, pv: ["g1f3"] },
      ],
    },
    accuracy: 99,
    motifs: [],
  };
}

function analysis(moves: MoveAnalysisV2[]): GameAnalysisV2 {
  return {
    version: 2,
    algorithmVersion: OBJECTIVE_ALGORITHM_VERSION,
    game: { headers: {}, initialFen: "fixture", pgn: "fixture" },
    engine: { stockfishVersion: "18", depth: 10, multiPv: 3, classificationMultiPv: 3, verificationPolicyVersion: "selective-verification-v1", verifiedMoveCount: 0 },
    division: { totalPlies: moves.length },
    white: { color: "white", phaseAccuracy: {}, classificationCounts: {}, qualityCounts: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, annotationCounts: {} },
    black: { color: "black", phaseAccuracy: {}, classificationCounts: {}, qualityCounts: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, annotationCounts: {} },
    moves,
    criticalMoments: [],
    createdAt: "2026-08-26T00:00:00.000Z",
  };
}

describe("selective objective verification", () => {
  it("requests deeper/wider evidence for explicit and unstable baseline moves", () => {
    const plan = planObjectiveVerification(analysis([
      move(1, ["special-annotation"]),
      move(2),
    ]));
    expect(plan).toMatchObject({ depth: 15, multiPv: 5 });
    expect(plan.requests[0]).toMatchObject({ ply: 1, reasons: expect.arrayContaining(["special-annotation"]) });
    expect(plan.requests.some(({ reasons }) => reasons.includes("unstable-candidate-order"))).toBe(true);
  });

  it("bounds verification work for long games", () => {
    const plan = planObjectiveVerification(analysis(Array.from({ length: 80 }, (_, index) => move(index + 1))));
    expect(plan.requests).toHaveLength(8);
  });
});
