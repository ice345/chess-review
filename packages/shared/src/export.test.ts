import { describe, expect, it } from "vitest";
import type { GameAnalysisV1 } from "./schema";
import { exportAnalysisJson, exportAnnotatedPgn } from "./export";

const analysis: GameAnalysisV1 = {
  version: 1,
  algorithmVersion: "objective-v1-preview.3",
  game: {
    headers: { Event: "Test \"Game\"", White: "Ada", Black: "Mikhail", Result: "*" },
    initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  },
  engine: { stockfishVersion: "18", depth: 15, multiPv: 3 },
  division: { totalPlies: 1 },
  white: { color: "white", accuracy: 98.2, phaseAccuracy: {}, classificationCounts: { best: 1 } },
  black: { color: "black", phaseAccuracy: {}, classificationCounts: {} },
  moves: [{
    ply: 1,
    color: "white",
    san: "e4",
    uci: "e2e4",
    fenBefore: "before",
    fenAfter: "after",
    phase: "opening",
    evaluationBefore: { kind: "cp", cp: 15 },
    evaluationAfter: { kind: "cp", cp: 32 },
    playedMoveScore: { kind: "cp", cp: 32 },
    playedMoveOutsideMultiPv: false,
    classification: "best",
    classificationReason: {
      precedenceRule: "engine-top-choice",
      isEngineBest: true,
      engineRank: 1,
      centipawnLoss: 0,
      winPercentBefore: 51,
      winPercentAfter: 52,
      winPercentLoss: 0,
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
      fen: "before",
      score: { kind: "cp", cp: 32 },
      bestMove: "e2e4",
      lines: [{ rank: 1, score: { kind: "cp", cp: 32 }, depth: 15, pv: ["e2e4"] }],
      depth: 15,
    },
    accuracy: 98.2,
    motifs: [],
  }],
  criticalMoments: [],
  createdAt: "2026-08-22T00:00:00.000Z",
};

describe("canonical review exports", () => {
  it("round-trips the complete versioned analysis as JSON", () => {
    expect(JSON.parse(exportAnalysisJson(analysis))).toEqual(analysis);
  });

  it("emits escaped headers and machine-readable annotated PGN comments", () => {
    const pgn = exportAnnotatedPgn(analysis);
    expect(pgn).toContain('[Event "Test \\"Game\\""]');
    expect(pgn).toContain('[Annotator "Open Chess Review objective-v1-preview.3"]');
    expect(pgn).toContain('[AnalysisEngine "Stockfish 18 depth 15 MultiPV 3"]');
    expect(pgn).toContain("1. e4 { [%eval 0.32]; best; Accuracy 98.2%; Win% loss 0.0; Rule engine-top-choice } *");
  });
});
