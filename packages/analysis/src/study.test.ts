import { describe, expect, it } from "vitest";
import type {
  ClassificationReason,
  GameAnalysisV1,
  GamePhase,
  MoveAnalysis,
  MoveClassification,
  PlayerColor,
} from "@chess-review/shared";
import {
  buildEngineConfigurations,
  buildOpeningRepertoire,
  buildRecurringWeaknesses,
  buildStudyTrends,
  gameTrainingWeaknesses,
  type StudyGameInput,
} from "./study";
import * as analysisPackage from "./index";

function reason(loss: number): ClassificationReason {
  return {
    precedenceRule: "fixture",
    isEngineBest: loss === 0,
    winPercentBefore: 55,
    winPercentAfter: 55 - loss,
    winPercentLoss: loss,
    legalMoveCount: 20,
    isForced: false,
    isBook: false,
    isCheckmate: false,
    isObviousRecapture: false,
    isTrivialCheckEscape: false,
    playedMoveOutsideMultiPv: false,
    exclusions: [],
  };
}

function move(
  ply: number,
  color: PlayerColor,
  phase: GamePhase,
  classification: MoveClassification,
  loss: number,
): MoveAnalysis {
  return {
    ply,
    color,
    san: ply % 2 === 1 ? "Nf3" : "Nc6",
    uci: ply % 2 === 1 ? "g1f3" : "b8c6",
    fenBefore: "fixture-before",
    fenAfter: "fixture-after",
    phase,
    evaluationBefore: { kind: "cp", cp: 20 },
    evaluationAfter: { kind: "cp", cp: 20 },
    playedMoveScore: { kind: "cp", cp: 20 },
    playedMoveOutsideMultiPv: false,
    classification,
    classificationReason: reason(loss),
    stockfish: { fen: "fixture-before", score: { kind: "cp", cp: 20 }, lines: [], depth: 12 },
    accuracy: Math.max(0, 100 - loss * 2),
    motifs: [],
  };
}

function game(
  gameId: string,
  playedAt: string,
  accuracy: number,
  result: StudyGameInput["result"],
  moves: MoveAnalysis[],
  color: PlayerColor = "white",
): StudyGameInput {
  const analysis: GameAnalysisV1 = {
    version: 1,
    algorithmVersion: "objective-v1-preview.3",
    game: { headers: { White: "Ada", Black: "Mikhail", Result: "*" }, initialFen: "fixture", pgn: gameId },
    engine: { stockfishVersion: "18", depth: 12, multiPv: 3 },
    opening: { eco: "C50", name: "Italian Game", variation: "Giuoco Piano", matchedPly: 6, theoryUntilPly: 8 },
    division: { middlePly: 4, endPly: 8, totalPlies: moves.length },
    white: { color: "white", accuracy, phaseAccuracy: { opening: accuracy - 2, middlegame: accuracy }, classificationCounts: {} },
    black: { color: "black", accuracy: accuracy + 1, phaseAccuracy: { opening: accuracy }, classificationCounts: {} },
    moves,
    criticalMoments: [],
    createdAt: playedAt,
  };
  for (const item of moves) {
    const counts = analysis[item.color].classificationCounts;
    counts[item.classification] = (counts[item.classification] ?? 0) + 1;
  }
  return { gameId, title: `Ada game ${gameId}`, playedAt, playerColor: color, result, analysis };
}

describe("study package public surface", () => {
  it("exposes only the V2 report entry — no advanced-study-v1 builder or version", () => {
    const exported = analysisPackage as Record<string, unknown>;
    expect(exported.buildAdvancedStudyReportV2).toEqual(expect.any(Function));
    expect(exported.STUDY_ALGORITHM_V2).toBe("advanced-study-v2");
    expect(exported.gameTrainingWeaknesses).toEqual(expect.any(Function));
    expect(exported.buildAdvancedStudyReport).toBeUndefined();
    expect(exported.STUDY_ALGORITHM_VERSION).toBeUndefined();
    expect(Object.keys(exported).some((key) => key === "AdvancedStudyReport")).toBe(false);
    expect(exported.buildStudyTrends).toBeUndefined();
    expect(exported.buildRecurringWeaknesses).toBeUndefined();
    expect(exported.buildEngineConfigurations).toBeUndefined();
    expect(exported.buildOpeningRepertoire).toBeUndefined();
  });
});

describe("study trend aggregation helpers", () => {
  it("aggregates canonical game Accuracy without recalculating it from moves", () => {
    const trends = buildStudyTrends([
      game("g3", "2026-08-03T00:00:00.000Z", 90, "win", [move(1, "white", "opening", "best", 0)]),
      game("g1", "2026-08-01T00:00:00.000Z", 70, "loss", [move(1, "white", "opening", "best", 0)]),
      game("g2", "2026-08-02T00:00:00.000Z", 80, "draw", [move(1, "white", "opening", "best", 0)]),
      game("g4", "2026-08-04T00:00:00.000Z", 100, "win", [move(1, "white", "opening", "best", 0)]),
    ]);

    expect(trends.games.map(({ gameId }) => gameId)).toEqual(["g1", "g2", "g3", "g4"]);
    expect(trends.summary).toMatchObject({
      gameCount: 4,
      averageAccuracy: 85,
      previousAccuracy: 75,
      recentAccuracy: 95,
      accuracyChange: 20,
    });
    expect(buildEngineConfigurations([
      game("g3", "2026-08-03T00:00:00.000Z", 90, "win", [move(1, "white", "opening", "best", 0)]),
      game("g1", "2026-08-01T00:00:00.000Z", 70, "loss", [move(1, "white", "opening", "best", 0)]),
      game("g2", "2026-08-02T00:00:00.000Z", 80, "draw", [move(1, "white", "opening", "best", 0)]),
      game("g4", "2026-08-04T00:00:00.000Z", 100, "win", [move(1, "white", "opening", "best", 0)]),
    ])).toEqual([{ stockfishVersion: "18", depth: 12, multiPv: 3, gameCount: 4 }]);
  });

  it("keeps repertoire color-specific and derives results and opening error rate", () => {
    const repertoire = buildOpeningRepertoire([
      game("g1", "2026-08-01T00:00:00.000Z", 70, "win", [
        move(1, "white", "opening", "mistake", 15),
        move(2, "black", "opening", "best", 0),
      ]),
      game("g2", "2026-08-02T00:00:00.000Z", 80, "draw", [move(1, "white", "opening", "best", 0)]),
      game("g3", "2026-08-03T00:00:00.000Z", 85, "loss", [move(2, "black", "opening", "blunder", 25)], "black"),
    ]);

    expect(repertoire).toHaveLength(2);
    expect(repertoire.find(({ color }) => color === "white")).toMatchObject({
      gameCount: 2,
      wins: 1,
      draws: 1,
      scoreRate: 75,
      openingMoveCount: 2,
      openingErrorCount: 1,
      openingErrorRate: 50,
    });
    expect(repertoire.find(({ color }) => color === "black")?.gameCount).toBe(1);
  });

  it("emits only weaknesses repeated across two distinct games with traceable evidence", () => {
    const weaknesses = buildRecurringWeaknesses([
      game("g1", "2026-08-01T00:00:00.000Z", 70, "loss", [
        move(1, "white", "opening", "blunder", 31),
        move(3, "white", "middlegame", "missed_win", 35),
      ]),
      game("g2", "2026-08-02T00:00:00.000Z", 80, "loss", [
        move(5, "white", "opening", "mistake", 17),
        move(7, "white", "endgame", "missed_mate", 42),
      ]),
      game("g3", "2026-08-03T00:00:00.000Z", 90, "win", [move(9, "white", "endgame", "inaccuracy", 7)]),
    ]);

    expect(weaknesses.map(({ kind }) => kind)).toEqual(["missed-opportunities", "opening-decisions"]);
    expect(weaknesses[0]).toMatchObject({ gameCount: 2, incidentCount: 2, averageWinPercentLoss: 38.5 });
    expect(weaknesses[0]?.evidence).toEqual([
      { gameId: "g2", ply: 7, san: "Nf3", phase: "endgame", classification: "missed_mate", winPercentLoss: 42 },
      { gameId: "g1", ply: 3, san: "Nf3", phase: "middlegame", classification: "missed_win", winPercentLoss: 35 },
    ]);
    expect(weaknesses.some(({ kind }) => kind === "endgame-decisions")).toBe(false);
  });
});

describe("single-game training evidence", () => {
  it("groups one game's error positions by the same rule the report uses", () => {
    const played = game("g1", "2026-08-01T00:00:00.000Z", 70, "loss", [
      move(1, "white", "opening", "inaccuracy", 9),
      move(3, "white", "middlegame", "blunder", 31),
      move(5, "white", "middlegame", "missed_win", 22),
      move(7, "black", "endgame", "blunder", 40),
    ]);
    const weaknesses = gameTrainingWeaknesses(played.analysis, "g1", "white");

    expect(weaknesses.map(({ kind }) => kind)).toEqual(["middlegame-decisions", "missed-opportunities", "opening-decisions"]);
    expect(weaknesses.every(({ gameCount }) => gameCount === 1)).toBe(true);
    // The opponent's blunder is not this player's evidence.
    expect(weaknesses.flatMap(({ evidence }) => evidence.map(({ ply }) => ply))).toEqual([3, 5, 1]);
    expect(weaknesses[0]?.evidence[0]).toMatchObject({ gameId: "g1", san: "Nf3", phase: "middlegame", classification: "blunder", winPercentLoss: 31 });
  });

  it("stays ordered by impact and never reports a negative priority", () => {
    const played = game("g7", "2026-08-01T00:00:00.000Z", 70, "loss", [
      move(1, "white", "opening", "inaccuracy", 6),
      move(2, "white", "opening", "blunder", 25),
      move(4, "white", "opening", "mistake", 12),
    ]);
    const [opening] = gameTrainingWeaknesses(played.analysis, "g7", "white");

    expect(opening?.evidence.map(({ winPercentLoss }) => winPercentLoss)).toEqual([25, 12, 6]);
    expect(opening?.priority).toBeGreaterThan(0);
    expect(opening?.priority).toBeLessThanOrEqual(100);
  });

  it("offers nothing for a game without recorded errors", () => {
    const clean = game("g9", "2026-08-01T00:00:00.000Z", 96, "win", [move(1, "white", "opening", "best", 0)]);
    expect(gameTrainingWeaknesses(clean.analysis, "g9", "white")).toEqual([]);
  });
});
