import { describe, expect, it } from "vitest";
import type { GameAnalysisV2, MoveAnalysisV2 } from "@chess-review/shared";
import { buildReviewCompletion } from "./review-completion";

const move = (partial: Partial<MoveAnalysisV2> & Pick<MoveAnalysisV2, "ply" | "san" | "color">): MoveAnalysisV2 => ({
  fenBefore: "fixture",
  uci: "e2e4",
  evaluationBefore: { kind: "cp", cp: 20 },
  evaluationAfter: { kind: "cp", cp: 10 },
  accuracy: 90,
  classification: "good",
  phase: "middlegame",
  annotations: [],
  motifs: [],
  classificationReason: {},
  stockfish: { fen: "fixture", score: { kind: "cp", cp: 0 }, lines: [], depth: 10 },
  ...partial,
} as MoveAnalysisV2);

function analysis(overrides: Partial<GameAnalysisV2> = {}): GameAnalysisV2 {
  return {
    version: 2,
    algorithmVersion: "fixture",
    game: { headers: { White: "Ada", Black: "Mikhail" }, initialFen: "fixture", pgn: "fixture" },
    engine: { stockfishVersion: "18", depth: 10, multiPv: 3, classificationMultiPv: 3, verificationPolicyVersion: "fixture", verifiedMoveCount: 0 },
    division: { totalPlies: 4, middlePly: 3 },
    white: { color: "white", accuracy: 91, phaseAccuracy: { opening: 95, middlegame: 80 }, classificationCounts: {}, qualityCounts: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, annotationCounts: {} },
    black: { color: "black", accuracy: 72, phaseAccuracy: { opening: 88, middlegame: 60 }, classificationCounts: {}, qualityCounts: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, annotationCounts: {} },
    moves: [],
    criticalMoments: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("review completion facts", () => {
  it("names the largest evaluation swing as the most important mistake", () => {
    const facts = buildReviewCompletion(analysis({
      moves: [move({ ply: 1, san: "e4", color: "white" }), move({ ply: 2, san: "e5", color: "black" }), move({ ply: 3, san: "Nf3", color: "white", classification: "blunder", accuracy: 38 })],
      criticalMoments: [
        { ply: 1, classification: "inaccuracy", winPercentSwing: 6 },
        { ply: 3, classification: "blunder", winPercentSwing: 24.5 },
      ],
    }), "white");

    expect(facts.keyMomentCount).toBe(2);
    expect(facts.mostImportantMistake).toMatchObject({ ply: 3, san: "Nf3", swing: 24.5, classification: "blunder" });
  });

  it("does not invent a mistake when every key moment was the only reasonable move", () => {
    const facts = buildReviewCompletion(analysis({
      moves: [move({ ply: 1, san: "e4", color: "white" })],
      criticalMoments: [{ ply: 1, classification: "best", winPercentSwing: 0 }],
    }), "white");

    expect(facts.mostImportantMistake).toBeNull();
    expect(facts.keyMomentCount).toBe(1);
  });

  it("takes the best moment from the best-classified move with the highest Accuracy", () => {
    const facts = buildReviewCompletion(analysis({
      moves: [
        move({ ply: 1, san: "e4", color: "white", classification: "best", accuracy: 97 }),
        move({ ply: 2, san: "e5", color: "black", classification: "good", accuracy: 99 }),
        move({ ply: 3, san: "Bb5", color: "white", classification: "brilliant", accuracy: 98 }),
      ],
    }), "white");

    expect(facts.bestMoment).toMatchObject({ ply: 3, san: "Bb5", classification: "brilliant" });
  });

  it("states the visitor's weakest scored phase as a fact", () => {
    const facts = buildReviewCompletion(analysis(), "black");
    expect(facts.lesson).toBe("Middlegame was the lowest-scoring phase: Black Accuracy 60.0.");
  });

  it("makes no phase claim when no side is known or the game never left the opening", () => {
    expect(buildReviewCompletion(analysis(), null).lesson).toBeNull();
    expect(buildReviewCompletion(analysis({ division: { totalPlies: 2 } }), "white").lesson).toBeNull();
  });
});
