import { describe, expect, it } from "vitest";
import type { GameAnalysisV2, MoveAnalysisV2, PlayerColor } from "@chess-review/shared";
import {
  buildAdvancedStudyReportV2,
  performanceRatingFromSample,
  ratingTargets,
  STUDY_ALGORITHM_V2,
  type StudyGameInputV2,
} from "./study-v2";
import { OBJECTIVE_ALGORITHM_VERSION } from "./game-analysis";

function move(
  ply: number,
  color: PlayerColor,
  overrides: Partial<MoveAnalysisV2> = {},
): MoveAnalysisV2 {
  return {
    ply,
    color,
    san: color === "white" ? "Nf3" : "Nc6",
    uci: color === "white" ? "g1f3" : "b8c6",
    fenBefore: `before-${ply}`,
    fenAfter: `after-${ply}`,
    phase: ply < 5 ? "opening" : ply < 9 ? "middlegame" : "endgame",
    evaluationBefore: { kind: "cp", cp: 20 },
    evaluationAfter: { kind: "cp", cp: 20 },
    playedMoveScore: { kind: "cp", cp: 20 },
    playedMoveOutsideMultiPv: false,
    quality: "best",
    annotations: [],
    objectiveVersion: "move-quality-v2",
    classification: "best",
    classificationReason: {
      precedenceRule: "engine-top-choice",
      qualityRule: "win-percent-loss-ladder-v2",
      isEngineBest: true,
      winPercentBefore: 55,
      winPercentAfter: 55,
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
    stockfish: { fen: `before-${ply}`, score: { kind: "cp", cp: 20 }, lines: [], depth: 15 },
    accuracy: 100,
    motifs: [],
    ...overrides,
  };
}

function game(
  id: string,
  provider: "chesscom" | "lichess",
  timeClass: string,
  playedAt: string,
  result: StudyGameInputV2["result"],
  rating: number,
  overrides: { algorithmVersion?: string; moves?: MoveAnalysisV2[] } = {},
): StudyGameInputV2 {
  const moves = overrides.moves ?? Array.from({ length: 12 }, (_, index) => move(index + 1, index % 2 === 0 ? "white" : "black"));
  const analysis: GameAnalysisV2 = {
    version: 2,
    algorithmVersion: overrides.algorithmVersion ?? OBJECTIVE_ALGORITHM_VERSION,
    game: { headers: { White: "Ada", Black: "Mikhail", Result: result === "win" ? "1-0" : result === "loss" ? "0-1" : "1/2-1/2" }, initialFen: "fixture", pgn: id },
    engine: { stockfishVersion: "18", depth: 15, multiPv: 3, classificationMultiPv: 3, verificationPolicyVersion: "selective-verification-v1", verifiedMoveCount: 1 },
    opening: { eco: "C50", name: "Italian Game", matchedPly: 6, theoryUntilPly: 8 },
    division: { middlePly: 5, endPly: 9, totalPlies: moves.length },
    white: { color: "white", accuracy: 88, phaseAccuracy: { opening: 90, middlegame: 86, endgame: 88 }, classificationCounts: {}, qualityCounts: { best: 5, excellent: 0, good: 0, inaccuracy: 0, mistake: 1, blunder: 0 }, annotationCounts: {} },
    black: { color: "black", accuracy: 84, phaseAccuracy: { opening: 85, middlegame: 83, endgame: 84 }, classificationCounts: {}, qualityCounts: { best: 6, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, annotationCounts: {} },
    moves,
    criticalMoments: [],
    createdAt: playedAt,
  };
  return {
    gameId: id,
    title: id,
    playedAt,
    playerColor: "white",
    result,
    analysis,
    source: { accountId: `${provider}-ada`, provider, timeClass, rated: true, playerRating: rating, opponentRating: rating + 20 },
  };
}

const FILTERS = {
  providers: [] as Array<"chesscom" | "lichess">,
  timeClasses: [] as string[],
  rated: "all" as const,
  playerColors: [] as PlayerColor[],
  openingKeys: [] as string[],
  minimumSampleSize: 1,
};

describe("advanced-study-v2", () => {
  it("applies one filtered population to every report section", () => {
    const games = [
      game("cc-1", "chesscom", "rapid", "2026-08-01T00:00:00.000Z", "win", 1500),
      game("cc-2", "chesscom", "rapid", "2026-08-02T00:00:00.000Z", "loss", 1510),
      game("li-1", "lichess", "blitz", "2026-08-03T00:00:00.000Z", "win", 1800),
    ];
    const report = buildAdvancedStudyReportV2(games, { ...FILTERS, providers: ["chesscom"] }, undefined, "2026-08-26T00:00:00.000Z");

    expect(report.algorithmVersion).toBe(STUDY_ALGORITHM_V2);
    expect(report.overview.summary.gameCount).toBe(2);
    expect(report.ratings.map((band) => band.key)).toEqual(["chesscom:rapid"]);
    expect(report.openings[0]).toMatchObject({ gameCount: 2, share: 100 });
    expect(report.phases.opening.moveCount).toBe(4);
    expect(report.gameHighlights.every((item) => item.gameId.startsWith("cc-"))).toBe(true);
    expect(report.overview.platformDistribution).toEqual([{ key: "chesscom", gameCount: 2, share: 100 }]);
  });

  it("filters player color and opening before every aggregate and enforces aggregate sample thresholds", () => {
    const white = game("white", "chesscom", "rapid", "2026-08-01T00:00:00.000Z", "win", 1500);
    const black = { ...game("black", "chesscom", "rapid", "2026-08-02T00:00:00.000Z", "loss", 1510), playerColor: "black" as const };
    const openingKey = "white|C50|Italian Game|";
    const combined = buildAdvancedStudyReportV2([white, black], FILTERS);
    const recent = buildAdvancedStudyReportV2([white, black], { ...FILTERS, dateFrom: "2026-08-02T00:00:00.000Z" });
    const report = buildAdvancedStudyReportV2([white, black], {
      ...FILTERS,
      playerColors: ["white"],
      openingKeys: [openingKey],
      minimumSampleSize: 2,
    });

    expect(combined.openings.map(({ color }) => color).sort()).toEqual(["black", "white"]);
    expect(recent.overview.summary.gameCount).toBe(1);
    expect(recent.overview.games[0]?.gameId).toBe("black");
    expect(report.overview.summary.gameCount).toBe(1);
    expect(report.openings).toEqual([]);
    expect(report.ratings).toEqual([]);
    expect(report.filters).toMatchObject({ playerColors: ["white"], openingKeys: [openingKey], minimumSampleSize: 2 });
  });

  it("never averages rating bands across platforms or time controls and degrades small samples", () => {
    const report = buildAdvancedStudyReportV2([
      game("cc", "chesscom", "rapid", "2026-08-01T00:00:00.000Z", "win", 1500),
      game("li", "lichess", "rapid", "2026-08-02T00:00:00.000Z", "win", 1800),
      game("cc-b", "chesscom", "blitz", "2026-08-03T00:00:00.000Z", "loss", 1400),
    ], FILTERS);

    expect(report.ratings).toHaveLength(3);
    expect(report.ratings.every((band) => band.confidence === "low" && band.nextTarget === undefined)).toBe(true);
  });

  it("suggests only the next stable rating milestone after a meaningful sample", () => {
    const report = buildAdvancedStudyReportV2(Array.from({ length: 5 }, (_, index) => game(
      `cc-${index}`,
      "chesscom",
      "rapid",
      `2026-08-0${index + 1}T00:00:00.000Z`,
      index < 3 ? "win" : "loss",
      1500 + index * 10,
    )), FILTERS);

    expect(report.ratings[0]).toMatchObject({ confidence: "medium", currentRating: 1540, nextTarget: 1600 });
  });

  it("uses the matched result/opponent sample for performance evidence", () => {
    const games = Array.from({ length: 6 }, (_, index) => game(
      `matched-${index}`,
      "chesscom",
      "rapid",
      `2026-08-0${index + 1}T00:00:00.000Z`,
      index < 3 ? "win" : "loss",
      1390 + index,
    ));
    // The last two games have no opponent rating. They still count toward the
    // report score, but must not change the performance estimate's population.
    games[4]!.source = { ...games[4]!.source!, playerRating: 1430 };
    games[5]!.source = { ...games[5]!.source!, playerRating: 1431 };
    delete games[4]!.source!.opponentRating;
    delete games[5]!.source!.opponentRating;

    const report = buildAdvancedStudyReportV2(games, FILTERS);
    expect(report.ratings[0]).toMatchObject({ performanceSampleSize: 4, scoreRate: 50 });
    expect(report.ratings[0]?.performanceRating).toBeUndefined();
  });

  it("uses a useful stabilize/next-target pair near a milestone", () => {
    expect(ratingTargets(1398)).toEqual({ stabilizeTarget: 1400, nextTarget: 1500 });
    expect(ratingTargets(1328)).toEqual({ nextTarget: 1400 });
    expect(performanceRatingFromSample([1400, 1400, 1400, 1400, 1400], 50)).toBe(1400);
  });

  it("keeps draw-heavy and strength-of-opposition estimates honest", () => {
    const draws = Array.from({ length: 6 }, (_, index) => game(`draw-${index}`, "chesscom", "rapid", `2026-08-0${index + 1}T00:00:00.000Z`, "draw", 1500));
    const drawReport = buildAdvancedStudyReportV2(draws, FILTERS);
    expect(drawReport.ratings[0]).toMatchObject({ scoreRate: 50, performanceRating: 1520, performanceSampleSize: 6 });

    const strongOpposition = Array.from({ length: 6 }, (_, index) => game(`strong-${index}`, "chesscom", "rapid", `2026-08-0${index + 1}T00:00:00.000Z`, index < 5 ? "win" : "draw", 1500));
    strongOpposition.forEach((item) => { item.source = { ...item.source!, opponentRating: 1900 }; });
    const strongReport = buildAdvancedStudyReportV2(strongOpposition, FILTERS);
    expect(strongReport.ratings[0]?.performanceRating).toBeGreaterThan(1900);

    const weakOpposition = Array.from({ length: 6 }, (_, index) => game(`weak-${index}`, "chesscom", "rapid", `2026-08-0${index + 1}T00:00:00.000Z`, index < 1 ? "win" : "loss", 1500));
    weakOpposition.forEach((item) => { item.source = { ...item.source!, opponentRating: 1100 }; });
    const weakReport = buildAdvancedStudyReportV2(weakOpposition, FILTERS);
    expect(weakReport.ratings[0]?.performanceRating).toBeLessThan(1100);
  });

  it("does not fabricate rating evidence when Elo metadata is missing", () => {
    const missing = game("missing", "lichess", "rapid", "2026-08-01T00:00:00.000Z", "draw", 1800);
    missing.source = { accountId: "lichess-ada", provider: "lichess", timeClass: "rapid", rated: true };

    const report = buildAdvancedStudyReportV2([missing], FILTERS);

    expect(report.ratings[0]).toMatchObject({ confidence: "low", sampleSize: 1 });
    expect(report.ratings[0]?.currentRating).toBeUndefined();
    expect(report.ratings[0]?.performanceRating).toBeUndefined();
    expect(report.ratings[0]?.nextTarget).toBeUndefined();
  });

  it("keeps verified special moves traceable and reports partial coverage honestly", () => {
    const critical = move(5, "white", {
      annotations: ["critical"],
      classification: "great",
      classificationReason: {
        ...move(5, "white").classificationReason,
        isEngineBest: true,
        winPercentBefore: 75,
        winPercentAfter: 75,
        winPercentLoss: 0,
        verification: { status: "verified", depth: 18, multiPv: 5, reasons: ["special-annotation"] },
      },
    });
    const report = buildAdvancedStudyReportV2([
      game("g1", "chesscom", "rapid", "2026-08-01T00:00:00.000Z", "win", 1500, { moves: [critical] }),
    ], FILTERS, {
      eligibleGames: 10,
      analyzedGames: 1,
      staleGames: 2,
      failedGames: 1,
      excludedGames: 0,
      providers: [{ provider: "chesscom", eligibleGames: 10, analyzedGames: 1, staleGames: 2, failedGames: 1 }],
    });

    expect(report.specialMoves[0]).toMatchObject({ gameId: "g1", ply: 5, annotations: ["critical"] });
    expect(report.coverage).toMatchObject({ coverageRate: 10, partial: true });
    expect(report.coverage.providers?.[0]).toMatchObject({ provider: "chesscom", eligibleGames: 10, analyzedGames: 1 });
  });

  it("does not publish unverified high-impact annotations as highlights", () => {
    const unverified = move(5, "white", { annotations: ["brilliant"], classification: "brilliant" });
    const report = buildAdvancedStudyReportV2([
      game("g1", "chesscom", "rapid", "2026-08-01T00:00:00.000Z", "win", 1500, { moves: [unverified] }),
    ], FILTERS);

    expect(report.specialMoves).toEqual([]);
  });

  it("detects only evidence-bounded best games, comebacks, saves and clean conversions", () => {
    const withChances = (ply: number, before: number, after: number) => move(ply, "white", {
      classificationReason: {
        ...move(ply, "white").classificationReason,
        winPercentBefore: before,
        winPercentAfter: after,
        winPercentLoss: Math.max(0, before - after),
      },
    });
    const longMoves = Array.from({ length: 20 }, (_, index) => move(index + 1, index % 2 === 0 ? "white" : "black"));
    const report = buildAdvancedStudyReportV2([
      game("best", "chesscom", "rapid", "2026-08-01T00:00:00.000Z", "win", 1500, { moves: longMoves }),
      game("comeback", "chesscom", "rapid", "2026-08-02T00:00:00.000Z", "win", 1510, { moves: [withChances(1, 15, 15)] }),
      game("save", "chesscom", "rapid", "2026-08-03T00:00:00.000Z", "draw", 1520, { moves: [withChances(1, 18, 18)] }),
      game("conversion", "chesscom", "rapid", "2026-08-04T00:00:00.000Z", "win", 1530, { moves: [withChances(1, 80, 79)] }),
    ], FILTERS);

    expect(new Set(report.gameHighlights.map(({ kind }) => kind))).toEqual(new Set(["best-game", "comeback", "save", "clean-conversion"]));
  });

  it("requires recurring multi-game weakness evidence and honors the sample threshold", () => {
    const error = move(1, "white", {
      quality: "mistake",
      classification: "mistake",
      accuracy: 40,
      classificationReason: {
        ...move(1, "white").classificationReason,
        precedenceRule: "fixture-error",
        isEngineBest: false,
        engineRank: 2,
        winPercentBefore: 60,
        winPercentAfter: 45,
        winPercentLoss: 15,
      },
    });
    const games = [
      game("g1", "chesscom", "rapid", "2026-08-01T00:00:00.000Z", "loss", 1500, { moves: [error] }),
      game("g2", "chesscom", "rapid", "2026-08-02T00:00:00.000Z", "loss", 1490, { moves: [error] }),
    ];

    expect(buildAdvancedStudyReportV2(games, FILTERS).weaknesses[0]).toMatchObject({ gameCount: 2, incidentCount: 2 });
    expect(buildAdvancedStudyReportV2(games, { ...FILTERS, minimumSampleSize: 3 }).weaknesses).toEqual([]);
  });

  it("rejects mixed objective versions", () => {
    expect(() => buildAdvancedStudyReportV2([
      game("g1", "chesscom", "rapid", "2026-08-01T00:00:00.000Z", "win", 1500),
      // Deliberately NOT the current constant: this test is about refusing to
      // mix identities, so the second game must carry a different one.
      game("g2", "chesscom", "rapid", "2026-08-02T00:00:00.000Z", "win", 1510, { algorithmVersion: "objective-v2.0" }),
    ], FILTERS)).toThrow(/cannot mix objective algorithm versions/i);
  });
});
