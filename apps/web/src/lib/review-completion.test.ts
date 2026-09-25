import { describe, expect, it } from "vitest";
import type { GameAnalysisV2, MoveAnalysisV2, MoveAnnotation, MoveQuality } from "@chess-review/shared";
import { buildReviewCompletion } from "./review-completion";

const move = (partial: Partial<MoveAnalysisV2> & Pick<MoveAnalysisV2, "ply" | "san" | "color">): MoveAnalysisV2 => ({
  fenBefore: "fixture",
  uci: "e2e4",
  evaluationBefore: { kind: "cp", cp: 20 },
  evaluationAfter: { kind: "cp", cp: 10 },
  accuracy: 90,
  classification: "good",
  quality: "good",
  annotations: [],
  phase: "middlegame",
  motifs: [],
  classificationReason: { winPercentLoss: 0 },
  stockfish: { fen: "fixture", score: { kind: "cp", cp: 0 }, lines: [], depth: 10 },
  ...partial,
} as MoveAnalysisV2);

/** A move with the canonical loss the classification recorded for it. */
function lost(partial: Partial<MoveAnalysisV2> & Pick<MoveAnalysisV2, "ply" | "san" | "color">, loss: number): MoveAnalysisV2 {
  return { ...move(partial), classificationReason: { ...move(partial).classificationReason, winPercentLoss: loss } };
}

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
  it("names the largest canonical loss among the moves that were errors", () => {
    const facts = buildReviewCompletion(analysis({
      moves: [
        move({ ply: 1, san: "e4", color: "white" }),
        lost({ ply: 3, san: "Nf3", color: "white", quality: "blunder", classification: "blunder" }, 24.5),
      ],
      criticalMoments: [
        { ply: 1, classification: "inaccuracy", winPercentSwing: 6 },
        { ply: 3, classification: "blunder", winPercentSwing: 24.5 },
      ],
    }), "white", "en");

    expect(facts.keyMomentCount).toBe(2);
    expect(facts.mostImportantMistake).toMatchObject({ ply: 3, san: "Nf3", loss: 24.5, classification: "blunder" });
  });

  it("does not invent a mistake when every key moment was the only reasonable move", () => {
    const facts = buildReviewCompletion(analysis({
      moves: [move({ ply: 1, san: "e4", color: "white" })],
      criticalMoments: [{ ply: 1, classification: "best", winPercentSwing: 0 }],
    }), "white", "en");

    expect(facts.mostImportantMistake).toBeNull();
    expect(facts.keyMomentCount).toBe(1);
  });

  it("never calls a small loss on a good move the most important mistake", () => {
    // A critical choice keeps a Best quality while the engine still records a
    // small loss; a mere positive loss is not evidence of a mistake.
    const facts = buildReviewCompletion(analysis({
      moves: [
        move({ ply: 1, san: "e4", color: "white" }),
        lost({ ply: 2, san: "e5", color: "black", quality: "best", classification: "great", annotations: ["critical"] }, 0.2),
      ],
      criticalMoments: [{ ply: 2, classification: "great", winPercentSwing: 0.2 }],
    }), null, "en");

    expect(facts.mostImportantMistake).toBeNull();
    expect(facts.highlight).toMatchObject({ ply: 2, annotations: ["critical"] });
  });

  it("counts a missed win or mate as an error even when the quality band is fine", () => {
    const facts = buildReviewCompletion(analysis({
      moves: [lost({ ply: 2, san: "Qd5", color: "black", quality: "good", classification: "missed_win", annotations: ["missed_win"] }, 12)],
      criticalMoments: [{ ply: 2, classification: "missed_win", winPercentSwing: 12 }],
    }), "black", "en");

    expect(facts.mostImportantMistake).toMatchObject({ ply: 2, classification: "missed_win" });
  });

  it("prefers evidenced good moves over ordinary Best moves with equal Accuracy", () => {
    const facts = buildReviewCompletion(analysis({
      moves: [
        move({ ply: 1, san: "e4", color: "white", classification: "best", quality: "best", accuracy: 100 }),
        move({ ply: 3, san: "Bb5", color: "white", classification: "brilliant", quality: "best", annotations: ["brilliant", "sacrifice"], accuracy: 100 }),
        move({ ply: 5, san: "Nf3", color: "white", classification: "best", quality: "best", accuracy: 100 }),
      ],
    }), "white", "en");

    expect(facts.highlight).toMatchObject({ ply: 3, classification: "brilliant" });
  });

  it("keeps the earlier ply when two candidates are otherwise equal", () => {
    const facts = buildReviewCompletion(analysis({
      moves: [
        move({ ply: 1, san: "e4", color: "white", classification: "best", quality: "best", accuracy: 97 }),
        move({ ply: 3, san: "Nf3", color: "white", classification: "best", quality: "best", accuracy: 97 }),
      ],
    }), "white", "en");

    expect(facts.highlight?.ply).toBe(1);
  });

  it("scopes both facts to the learner, and reports both sides when no learner is known", () => {
    const moves = [
      lost({ ply: 1, san: "e4", color: "white", quality: "blunder", classification: "blunder" }, 30),
      lost({ ply: 2, san: "e5", color: "black", quality: "mistake", classification: "mistake" }, 12),
      move({ ply: 3, san: "Bb5", color: "white", classification: "best", quality: "best", accuracy: 99 }),
      move({ ply: 4, san: "Nc6", color: "black", classification: "best", quality: "best", accuracy: 88 }),
    ];
    const black = buildReviewCompletion(analysis({ moves }), "black", "en");
    expect(black.mostImportantMistake).toMatchObject({ ply: 2, color: "black" });
    expect(black.highlight).toMatchObject({ ply: 4, color: "black" });
    expect(black.scope).toBe("black");

    const both = buildReviewCompletion(analysis({ moves }), null, "en");
    expect(both.scope).toBe("both");
    expect(both.mostImportantMistake).toMatchObject({ ply: 1, color: "white" });
    expect(both.highlight).toMatchObject({ ply: 3, color: "white" });
  });

  it("states the visitor's weakest scored phase as a fact", () => {
    const facts = buildReviewCompletion(analysis(), "black", "en");
    expect(facts.lesson).toBe("Middlegame was the lowest-scoring phase: Black Accuracy 60.0.");
  });

  it("names the side's lowest-scoring phase when no learner is known", () => {
    const facts = buildReviewCompletion(analysis(), null, "en");

    expect(facts.scope).toBe("both");
    expect(facts.lesson).toBe("Black's middlegame was the lowest-scoring phase in this game: Accuracy 60.0.");
  });

  it("makes no phase claim when the game never left the opening or a side has no scored phase", () => {
    expect(buildReviewCompletion(analysis({ division: { totalPlies: 2 } }), "white", "en").lesson).toBeNull();
    expect(buildReviewCompletion(analysis({
      black: { color: "black", accuracy: 72, phaseAccuracy: { opening: 88 }, classificationCounts: {}, qualityCounts: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, annotationCounts: {} },
    }), null, "en").lesson).toBe("White's middlegame was the lowest-scoring phase in this game: Accuracy 80.0.");
  });
});

describe("completion moment evidence", () => {
  it("carries the canonical quality, annotations and loss for display", () => {
    const annotations: MoveAnnotation[] = ["brilliant", "critical"];
    const quality: MoveQuality = "best";
    const facts = buildReviewCompletion(analysis({
      moves: [move({ ply: 1, san: "Bb5", color: "white", classification: "brilliant", quality, annotations, accuracy: 98.4 })],
    }), "white", "en");

    expect(facts.highlight).toEqual({
      ply: 1,
      san: "Bb5",
      fenBefore: "fixture",
      color: "white",
      classification: "brilliant",
      quality: "best",
      annotations,
      loss: 0,
      accuracy: 98.4,
    });
  });
});
