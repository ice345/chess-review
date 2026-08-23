import { describe, expect, it } from "vitest";
import type { ClassificationReason, GameAnalysisV1, MoveAnalysis } from "@chess-review/shared";
import {
  buildDeterministicGameCoach,
  buildDeterministicMoveCoach,
  buildGameCoachFacts,
  buildMoveCoachFacts,
} from "./coach-facts";

const beforeE4 = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const afterE5 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";

function reason(overrides: Partial<ClassificationReason> = {}): ClassificationReason {
  return {
    precedenceRule: "engine-top-choice",
    isEngineBest: true,
    engineRank: 1,
    centipawnLoss: 0,
    winPercentBefore: 52,
    winPercentAfter: 52,
    winPercentLoss: 0,
    secondBestGapCp: 20,
    legalMoveCount: 20,
    isForced: false,
    isBook: false,
    isCheckmate: false,
    isObviousRecapture: false,
    isTrivialCheckEscape: false,
    playedMoveOutsideMultiPv: false,
    exclusions: [],
    ...overrides,
  };
}

const moveOne: MoveAnalysis = {
  ply: 1,
  color: "white",
  san: "e4",
  uci: "e2e4",
  fenBefore: beforeE4,
  fenAfter: afterE4,
  phase: "opening",
  evaluationBefore: { kind: "cp", cp: 35 },
  evaluationAfter: { kind: "cp", cp: 28 },
  playedMoveScore: { kind: "cp", cp: 32 },
  playedMoveOutsideMultiPv: false,
  classification: "best",
  classificationReason: reason(),
  stockfish: {
    fen: beforeE4,
    score: { kind: "cp", cp: 35 },
    bestMove: "e2e4",
    lines: [
      { rank: 1, score: { kind: "cp", cp: 35 }, depth: 12, pv: ["e2e4", "e7e5", "g1f3"] },
      { rank: 2, score: { kind: "cp", cp: 15 }, depth: 12, pv: ["d2d4", "d7d5"] },
    ],
    depth: 12,
  },
  accuracy: 99.2,
  human: {
    model: "maia3-5m",
    targetElo: 1400,
    selfElo: 1400,
    opponentElo: 1400,
    candidates: [{ uci: "e2e4", san: "e4", probability: 0.65 }],
    candidateProbabilityMass: 0.65,
    playedMoveProbability: 0.65,
    expectedHumanMove: "e2e4",
    humanWdl: { win: 0.4, draw: 0.3, loss: 0.3 },
    modelPrediction: true,
    findDifficulty: {
      label: "natural",
      score: 12,
      evidence: {
        experimental: true,
        maiaProbability: 0.65,
        probabilityBand: "common",
        legalMoveCount: 20,
        isEngineBest: true,
        isForced: false,
        isForcing: false,
        isSacrifice: false,
        tacticalMotifCount: 0,
        adjustments: [],
      },
    },
  },
  motifs: [],
};

const moveTwo: MoveAnalysis = {
  ...moveOne,
  ply: 2,
  color: "black",
  san: "e5",
  uci: "e7e5",
  fenBefore: afterE4,
  fenAfter: afterE5,
  evaluationBefore: { kind: "cp", cp: 28 },
  evaluationAfter: { kind: "cp", cp: 210 },
  playedMoveScore: { kind: "cp", cp: 210 },
  classification: "blunder",
  classificationReason: reason({
    precedenceRule: "centipawn-or-win-percent-loss-ladder",
    isEngineBest: false,
    engineRank: 3,
    centipawnLoss: 182,
    winPercentBefore: 48,
    winPercentAfter: 25,
    winPercentLoss: 23,
  }),
  stockfish: {
    fen: afterE4,
    score: { kind: "cp", cp: 28 },
    bestMove: "e7e5",
    lines: [{ rank: 1, score: { kind: "cp", cp: 28 }, depth: 12, pv: ["e7e5", "g1f3"] }],
    depth: 12,
  },
  accuracy: 34,
};

const analysis: GameAnalysisV1 = {
  version: 1,
  algorithmVersion: "fixture",
  game: { headers: { White: "Ada", Black: "Mikhail" }, initialFen: beforeE4 },
  engine: { stockfishVersion: "18", depth: 12, multiPv: 2 },
  division: { totalPlies: 2 },
  white: { color: "white", accuracy: 99.2, phaseAccuracy: { opening: 99.2 }, classificationCounts: { best: 1 } },
  black: { color: "black", accuracy: 34, phaseAccuracy: { opening: 34 }, classificationCounts: { blunder: 1 } },
  moves: [moveOne, moveTwo],
  criticalMoments: [{ ply: 2, classification: "blunder", winPercentSwing: 23 }],
  createdAt: "2026-08-23T00:00:00.000Z",
};

describe("canonical coach facts", () => {
  it("builds structured move facts without asking an LLM to reconstruct chess truth", () => {
    const facts = buildMoveCoachFacts(analysis, 1);

    expect(facts.objective).toMatchObject({
      evaluationBefore: { kind: "cp", cp: 35 },
      playedMoveScore: { kind: "cp", cp: 32 },
      bestMove: "e2e4",
    });
    expect(facts.objective.afterCandidates[0]?.pv[0]).toBe("e7e5");
    expect(facts.human?.playedMoveProbability).toBe(0.65);
    expect(facts.boardFacts).toMatchObject({ isCapture: false, givesCheck: false });
    expect(facts.boardFacts.materialBefore.balanceCp).toBe(0);
  });

  it("creates a rules-validated deterministic continuation when a provider is absent", () => {
    const facts = buildMoveCoachFacts(analysis, 1);
    const coach = buildDeterministicMoveCoach(facts, "en", "provider offline");

    expect(coach.source.provider).toBe("deterministic");
    expect(coach.validatedLines[0]?.moves).toEqual([
      { uci: "e2e4", san: "e4" },
      { uci: "e7e5", san: "e5" },
      { uci: "g1f3", san: "Nf3" },
    ]);
    expect(coach.grounding.validatedLineCount).toBe(1);
  });

  it("derives game-summary training advice only from canonical counts and moments", () => {
    const facts = buildGameCoachFacts(analysis);
    const summary = buildDeterministicGameCoach(facts, "en", "provider offline");

    expect(facts.moves[1]).toMatchObject({ classification: "blunder", winPercentLoss: 23 });
    expect(summary.trainingRecommendations[0]?.title).toBe("Tactical scan");
    expect(summary.criticalMoments).toEqual([{ ply: 2, insight: "The canonical analysis records a 23.0-point win-percentage swing." }]);
  });
});
