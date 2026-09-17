import { describe, expect, it } from "vitest";
import type {
  ClassificationReason,
  CriticalMoment,
  GameAnalysisV1,
  GameAnalysisV2,
  MoveAnalysis,
  MoveAnalysisV2,
  MoveAnnotation,
  MoveQuality,
  PlayerColor,
} from "@chess-review/shared";
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
    version: "human-v2",
    model: "maia3-5m",
    targetElo: 1400,
    selfElo: 1400,
    opponentElo: 1400,
    candidates: [{ uci: "e2e4", san: "e4", probability: 0.65, policyRank: 1 }],
    candidateProbabilityMass: 0.65,
    playedMoveProbability: 0.65,
    playedMoveRank: 1,
    expectedHumanMove: "e2e4",
    playedMoveWdl: { win: 0.4, draw: 0.3, loss: 0.3 },
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

const NO_QUALITY: Record<MoveQuality, number> = { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };

/**
 * A two-ply V2 record with the V2 layers the deterministic summary consumes.
 * The V1 `analysis` fixture above cannot express quality/annotation counts, which
 * is exactly what the summary used to read from the compatibility projection.
 */
function v2Analysis(
  quality: { white?: Partial<Record<MoveQuality, number>>; black?: Partial<Record<MoveQuality, number>> } = {},
  annotations: { white?: Partial<Record<MoveAnnotation, number>>; black?: Partial<Record<MoveAnnotation, number>> } = {},
  criticalMoments: CriticalMoment[] = [],
  options: { verifiedPlies?: number[]; moveAnnotations?: Record<number, MoveAnnotation[]> } = {},
): GameAnalysisV2 {
  const moves: MoveAnalysisV2[] = [moveOne, moveTwo].map((move) => ({
    ...move,
    quality: "best",
    annotations: options.moveAnnotations?.[move.ply] ?? [],
    objectiveVersion: "move-quality-v2",
    classificationReason: {
      ...move.classificationReason,
      qualityRule: "centipawn-or-win-percent-loss-ladder",
      ...(options.verifiedPlies?.includes(move.ply)
        ? { verification: { status: "verified" as const, depth: 15, multiPv: 5, reasons: [] } }
        : {}),
    },
  }));
  const player = (color: PlayerColor, accuracy: number) => ({
    color,
    accuracy,
    phaseAccuracy: { opening: accuracy },
    classificationCounts: {},
    qualityCounts: { ...NO_QUALITY, ...quality[color] },
    annotationCounts: { ...annotations[color] },
  });
  return {
    version: 2,
    algorithmVersion: "fixture",
    game: { headers: { White: "Ada", Black: "Mikhail" }, initialFen: beforeE4 },
    engine: { stockfishVersion: "18", depth: 12, multiPv: 3, classificationMultiPv: 3, verificationPolicyVersion: "fixture", verifiedMoveCount: options.verifiedPlies?.length ?? 0 },
    division: { totalPlies: 2 },
    white: player("white", 99.2),
    black: player("black", 34),
    moves,
    criticalMoments,
    createdAt: "2026-08-23T00:00:00.000Z",
  };
}

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
    expect(facts.boardFacts.positionBefore).toMatchObject({
      sideToMove: "white",
      legalMoveCount: 20,
      openFiles: [],
    });
    expect(facts.boardFacts.positionAfter).toMatchObject({
      sideToMove: "black",
      legalMoveCount: 20,
      center: { whiteOccupied: ["e4"], blackOccupied: [] },
    });
    expect(facts.boardFacts.futureConsequence).toEqual({
      start: "after",
      moves: ["e7e5", "g1f3"],
      opponentBestResponse: "e7e5",
    });
  });

  it("creates a rules-validated deterministic continuation when a provider is absent", () => {
    const facts = buildMoveCoachFacts(analysis, 1);
    const coach = buildDeterministicMoveCoach(facts, "en", "provider offline");

    expect(coach.source.provider).toBe("deterministic");
    expect(coach.source.language).toBe("en");
    expect(coach.validatedLines[0]?.moves).toEqual([
      { uci: "e7e5", san: "e5" },
      { uci: "g1f3", san: "Nf3" },
    ]);
    expect(coach.validatedLines[0]?.start).toBe("after");
    expect(coach.notice).toBeTruthy();
    expect(coach.moveIdea).toBeTruthy();
    expect(coach.consequence).toBeTruthy();
    expect(coach.takeaway).toBeTruthy();
    expect(coach.grounding.validatedLineCount).toBe(1);
  });

  it("offers a practical alternative only when Stockfish and Maia both support it", () => {
    const withPracticalAlternative = structuredClone(analysis);
    const firstMove = withPracticalAlternative.moves[0];
    if (!firstMove?.human) throw new Error("Expected Maia fixture facts.");
    firstMove.human.candidates = [
      { uci: "e2e4", san: "e4", probability: 0.15, policyRank: 2 },
      { uci: "d2d4", san: "d4", probability: 0.35, policyRank: 1 },
    ];

    const facts = buildMoveCoachFacts(withPracticalAlternative, 1);

    expect(facts.boardFacts.practicalAlternative).toMatchObject({
      uci: "d2d4",
      san: "d4",
      stockfishRank: 2,
      maiaProbability: 0.35,
      objectiveBestUci: "e2e4",
      objectiveBestMaiaProbability: 0.15,
    });
    expect(facts.boardFacts.practicalAlternative?.winPercentCost).toBeLessThanOrEqual(4);

    const withoutMaiaSupport = structuredClone(withPracticalAlternative);
    const candidate = withoutMaiaSupport.moves[0]?.human?.candidates.find(({ uci }) => uci === "d2d4");
    if (!candidate) throw new Error("Expected practical alternative fixture.");
    candidate.probability = 0.1;
    expect(buildMoveCoachFacts(withoutMaiaSupport, 1).boardFacts.practicalAlternative).toBeUndefined();
  });

  it("derives game-summary training advice only from canonical counts and moments", () => {
    const facts = buildGameCoachFacts(analysis);
    const summary = buildDeterministicGameCoach(facts, "en", "provider offline");

    expect(facts.moves[1]).toMatchObject({ classification: "blunder", winPercentLoss: 23 });
    expect(summary.trainingRecommendations[0]?.title).toBe("Error review");
    expect(summary.source.language).toBe("en");
    expect(summary.criticalMoments).toEqual([{ ply: 2, insight: "This move cost 23.0 win-percentage points." }]);
  });

  it("counts V2 quality and annotations in separate layers", () => {
    const facts = buildGameCoachFacts(v2Analysis({
      // Book and Forced are annotations, not quality bands: counting them as
      // quality would inflate every claim about the engine's first choice.
      white: { best: 2, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
      black: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 1 },
    }, { white: { book: 2 }, black: {} }));
    const summary = buildDeterministicGameCoach(facts, "en", "provider offline");

    expect(facts.players.white.qualityCounts?.best).toBe(2);
    expect(facts.players.white.classificationCounts.book).toBeUndefined();
    expect(summary.summary).toContain("2 moves matched the engine's first choice");
    expect(summary.strengths).toContain("2 moves matched the engine's first choice.");
    expect(summary.weaknesses).toEqual(["The game recorded 1 blunder."]);
  });

  it("never claims Best-or-better from Excellent alone", () => {
    const facts = buildGameCoachFacts(v2Analysis({
      white: { best: 0, excellent: 3, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
    }));
    const summary = buildDeterministicGameCoach(facts, "en", "provider offline");

    expect(summary.summary).toContain("no move matched the engine's first choice");
    expect(summary.strengths).toEqual(["There is not enough evidence for a best-move claim."]);
    expect(summary.summary).not.toContain("Best or better");
  });

  it("explains an annotated key moment from its own evidence instead of a zero swing", () => {
    const brilliant = buildGameCoachFacts(v2Analysis(
      { white: { best: 1, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 } },
      { white: { brilliant: 1, critical: 1 } },
      [{ ply: 1, classification: "brilliant", winPercentSwing: 0 }, { ply: 2, classification: "great", winPercentSwing: 0.2 }],
      { moveAnnotations: { 1: ["brilliant", "critical"], 2: ["critical"] } },
    ));
    const summary = buildDeterministicGameCoach(brilliant, "en", "provider offline");

    expect(summary.criticalMoments[0]?.insight).toBe("A verified brilliant move: it invests material and the engine's best reply keeps the compensation.");
    expect(summary.criticalMoments[1]?.insight).toBe("This was the only reasonable choice: every alternative was at least ten win-percentage points worse.");
    expect(summary.criticalMoments.map((moment) => moment.insight).join(" ")).not.toContain("0.0-point");

    const chinese = buildDeterministicGameCoach(brilliant, "zh-CN", "provider offline");
    expect(chinese.criticalMoments[0]?.insight).toContain("精彩着法");
    expect(chinese.weaknesses).toEqual(["没有错误超过记录的阈值。"]);
  });

  it("names a missing mate or win as recorded, without claiming an unnamed tactic", () => {
    const facts = buildGameCoachFacts(v2Analysis(
      { black: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 1 } },
      { black: { missed_win: 1, missed_mate: 1 } },
      [{ ply: 2, classification: "missed_mate", winPercentSwing: 18 }],
      { moveAnnotations: { 2: ["missed_win", "missed_mate"] } },
    ));
    const summary = buildDeterministicGameCoach(facts, "en", "provider offline");

    expect(summary.trainingRecommendations[0]).toEqual({
      title: "Error review",
      reason: "The game recorded 1 blunder, 1 missed win and 1 missed mate.",
      focus: "List forcing moves, captures and direct threats before choosing a move.",
    });
    expect(summary.weaknesses).toEqual(["The game recorded 1 blunder, 1 missed win and 1 missed mate."]);
    expect(summary.weaknesses[0]).not.toMatch(/tactic/i);
    expect(summary.criticalMoments[0]?.insight).toBe("A forced mate was available here and the move let it go.");
  });

  it("derives confidence from how much of the record was re-searched", () => {
    const unverified = buildDeterministicGameCoach(buildGameCoachFacts(v2Analysis({})), "en", "provider offline");
    expect(unverified.confidence).toBe("low");

    const verified = buildGameCoachFacts(v2Analysis({}, {}, [], { verifiedPlies: [1, 2] }));
    expect(verified.moves.every((move) => move.verified === true)).toBe(true);
    expect(buildDeterministicGameCoach(verified, "en", "provider offline").confidence).toBe("high");

    const partial = buildGameCoachFacts(v2Analysis({}, {}, [], { verifiedPlies: [1] }));
    expect(buildDeterministicGameCoach(partial, "en", "provider offline").confidence).toBe("medium");
  });
});
