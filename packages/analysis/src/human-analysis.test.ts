import { describe, expect, it } from "vitest";
import type { MaiaMoveReview, MoveAnalysis } from "@chess-review/shared";
import { buildHumanAnalysis, matchesHumanAnalysisIdentity } from "./human-analysis";

const move: MoveAnalysis = {
  ply: 1,
  color: "white",
  san: "e4",
  uci: "e2e4",
  fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  fenAfter: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  phase: "opening",
  evaluationBefore: { kind: "cp", cp: 30 },
  evaluationAfter: { kind: "cp", cp: 20 },
  playedMoveScore: { kind: "cp", cp: 28 },
  playedMoveOutsideMultiPv: false,
  classification: "best",
  classificationReason: {
    precedenceRule: "engine-top-choice",
    isEngineBest: true,
    engineRank: 1,
    centipawnLoss: 2,
    winPercentBefore: 52,
    winPercentAfter: 51.8,
    winPercentLoss: 0.2,
    secondBestGapCp: 170,
    legalMoveCount: 20,
    isForced: false,
    isBook: false,
    isCheckmate: false,
    isObviousRecapture: false,
    isTrivialCheckEscape: false,
    playedMoveOutsideMultiPv: false,
    exclusions: [],
  },
  stockfish: {
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    score: { kind: "cp", cp: 30 },
    lines: [{ rank: 1, score: { kind: "cp", cp: 30 }, depth: 12, pv: ["e2e4"] }],
    depth: 12,
  },
  accuracy: 99,
  motifs: [],
};

const review: MaiaMoveReview = {
  kind: "move-review",
  fenBefore: move.fenBefore,
  playedMove: move.uci,
  model: "maia3-23m",
  targetElo: 1400,
  selfElo: 1400,
  opponentElo: 1400,
  candidates: [
    { uci: "d2d4", san: "d4", probability: 0.4, policyRank: 1 },
    { uci: "e2e4", san: "e4", probability: 0.02, policyRank: 7 },
  ],
  candidateProbabilityMass: 0.42,
  playedMoveProbability: 0.02,
  playedMoveRank: 7,
  expectedHumanMove: "d2d4",
  playedMoveWdl: { win: 0.42, draw: 0.31, loss: 0.27 },
  modelPrediction: true,
};

describe("persisted Maia move review", () => {
  it("binds the result to the same canonical move and keeps its model/Elo identity", () => {
    const human = buildHumanAnalysis(move, review);
    expect(human).toMatchObject({
      version: "human-v2",
      model: "maia3-23m",
      targetElo: 1400,
      playedMoveProbability: 0.02,
      playedMoveRank: 7,
      playedMoveWdl: review.playedMoveWdl,
      findDifficulty: { label: "very-hard", score: 77 },
    });
    expect(matchesHumanAnalysisIdentity(human, "maia3-23m", 1400)).toBe(true);
    expect(matchesHumanAnalysisIdentity(human, "maia3-5m", 1400)).toBe(false);
  });

  it("rejects the N+1 move/position mix-up", () => {
    expect(() => buildHumanAnalysis(move, { ...review, playedMove: "e7e5" }))
      .toThrow("does not match canonical ply 1");
  });
});
