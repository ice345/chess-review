import { describe, expect, it } from "vitest";
import { COACH_PROMPT_VERSION, OBJECTIVE_ALGORITHM_VERSION } from "@chess-review/analysis";
import { parsePgn } from "@chess-review/chess-core";
import type { AnalysisCacheProjectionV1, GameAnalysisV2 } from "@chess-review/shared";
import { STOCKFISH_VERSION } from "@chess-review/stockfish";
import {
  compatibleAnalysisQuery,
  gameMoveIdentity,
  isCompatibleAnalysisProjection,
  selectCompatibleAnalysisProjection,
  withoutStaleCoach,
} from "./analysis-cache";

function cachedAnalysis(movePromptVersion: string, summaryPromptVersion: string): GameAnalysisV2 {
  return {
    moves: [{ coach: { source: { promptVersion: movePromptVersion } } }],
    coachSummary: { source: { promptVersion: summaryPromptVersion } },
  } as unknown as GameAnalysisV2;
}

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const ITALIAN_UCI = ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"] as const;

function projection(overrides: Partial<AnalysisCacheProjectionV1> = {}): AnalysisCacheProjectionV1 {
  return {
    version: 1,
    cacheKey: "historical-key",
    gameFingerprint: "pgn-hash",
    algorithmVersion: OBJECTIVE_ALGORITHM_VERSION,
    objectiveVersion: 2,
    createdAt: "2026-08-01T00:00:00.000Z",
    engine: {
      stockfishVersion: STOCKFISH_VERSION,
      depth: 10,
      multiPv: 3,
      classificationMultiPv: 3,
      verificationPolicyVersion: "fixture",
      verifiedMoveCount: 0,
    },
    headers: {},
    division: { totalPlies: ITALIAN_UCI.length },
    white: { phaseAccuracy: {}, qualityCounts: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, annotationCounts: {} },
    black: { phaseAccuracy: {}, qualityCounts: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, annotationCounts: {} },
    moveCount: ITALIAN_UCI.length,
    criticalMomentCount: 0,
    approximateBytes: 1,
    initialFen: STARTING_FEN,
    uciMoves: [...ITALIAN_UCI],
    ...overrides,
  };
}

describe("coach cache invalidation", () => {
  it("retains current coach enrichments", () => {
    const cached = cachedAnalysis(COACH_PROMPT_VERSION, COACH_PROMPT_VERSION);

    const result = withoutStaleCoach(cached);

    expect(result.moves[0]?.coach).toBeDefined();
    expect(result.coachSummary).toBeDefined();
  });

  it("drops stale coach text without dropping the objective record", () => {
    const cached = cachedAnalysis("coach-v0", "coach-v0");

    const result = withoutStaleCoach(cached);

    expect(result.moves).toHaveLength(1);
    expect(result.moves[0]?.coach).toBeUndefined();
    expect(result.coachSummary).toBeUndefined();
  });
});

describe("compatible analysis resolution", () => {
  const query = {
    initialFen: STARTING_FEN,
    uciMoves: ITALIAN_UCI,
    depth: 10,
    multiPv: 3,
  };

  it("treats initial FEN plus played UCI as game identity", () => {
    const withSite = parsePgn('[Event "A"]\n[Site "?"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 *');
    const withoutSite = parsePgn('[Event "A"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 * ');
    const trimmed = parsePgn("1. e4 e5 2. Nf3 Nc6 3. Bc4 *\n");

    expect(withSite.pgn).not.toBe(withoutSite.pgn);
    expect(withoutSite.pgn).not.toBe(trimmed.pgn);
    expect(gameMoveIdentity(withSite.initialFen, withSite.plies.map((ply) => ply.uci)))
      .toBe(gameMoveIdentity(withoutSite.initialFen, withoutSite.plies.map((ply) => ply.uci)));
    expect(gameMoveIdentity(withSite.initialFen, withSite.plies.map((ply) => ply.uci)))
      .toBe(gameMoveIdentity(trimmed.initialFen, trimmed.plies.map((ply) => ply.uci)));
  });

  it("restores a historical projection when only PGN serialization drifted", () => {
    const stored = projection();
    const drifted = parsePgn('[Event "Review open"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 *\n');

    expect(selectCompatibleAnalysisProjection([stored], compatibleAnalysisQuery(drifted, { depth: 10, multiPv: 3 }))?.cacheKey)
      .toBe("historical-key");
  });

  it("does not restore a different move sequence or incompatible engine settings", () => {
    const stored = projection();
    const differentLine = parsePgn("1. d4 d5 2. c4 *");

    expect(isCompatibleAnalysisProjection(stored, {
      ...query,
      uciMoves: differentLine.plies.map((ply) => ply.uci),
    })).toBe(false);
    expect(isCompatibleAnalysisProjection(stored, { ...query, depth: 12 })).toBe(false);
    expect(isCompatibleAnalysisProjection(stored, { ...query, multiPv: 5 })).toBe(false);
    expect(isCompatibleAnalysisProjection(projection({ engine: { ...stored.engine, stockfishVersion: "17" } }), query)).toBe(false);
    expect(isCompatibleAnalysisProjection(projection({ algorithmVersion: "old" }), query)).toBe(false);
  });

  it("ignores projections that never received UCI identity", () => {
    const legacy = projection();
    delete legacy.initialFen;
    delete legacy.uciMoves;

    expect(selectCompatibleAnalysisProjection([legacy], query)).toBeNull();
  });

  it("prefers the newest compatible projection for the same game", () => {
    const older = projection({ cacheKey: "old", createdAt: "2026-08-01T00:00:00.000Z" });
    const newer = projection({ cacheKey: "new", createdAt: "2026-08-11T00:00:00.000Z" });

    expect(selectCompatibleAnalysisProjection([older, newer], query)?.cacheKey).toBe("new");
  });
});
