import { describe, expect, it } from "vitest";
import { parsePgn } from "@chess-review/chess-core";
import type { StockfishMoveAnalysis } from "@chess-review/shared";
import { BrowserStockfishPool, type GameReviewOptions, type GameVerificationOptions, type StockfishSearcher } from "@chess-review/stockfish";
import { analyzeObjectiveGame } from "./objective-game-analysis";

function root(fen: string, depth: number): StockfishMoveAnalysis {
  return {
    fen,
    score: { kind: "cp", cp: 0 },
    bestMove: "e2e4",
    lines: [
      { rank: 1, score: { kind: "cp", cp: 0 }, depth, pv: ["e2e4"] },
      { rank: 2, score: { kind: "cp", cp: -400 }, depth, pv: ["d2d4"] },
      { rank: 3, score: { kind: "cp", cp: -500 }, depth, pv: ["c2c4"] },
    ],
    depth,
  };
}

/**
 * Regression fixture for history-analysis failures reported as
 * "Played move … is outside MultiPV and has no restricted search.".
 *
 * Baseline MultiPV keeps every played move inside its candidate list while the
 * deeper verification pass re-searches a verified ply's resulting position —
 * which is also the ROOT of the next, unverified ply — without listing that
 * next played move among its candidates.
 */
function driftSearcher(): StockfishSearcher {
  const game = parsePgn("1. d4 d5");
  return {
    async search(fen, options) {
      if (options.searchMoves?.length) {
        const move = options.searchMoves[0]!;
        return {
          fen,
          score: { kind: "cp", cp: -30 },
          bestMove: move,
          searchMoves: [...options.searchMoves],
          lines: [{ rank: 1, score: { kind: "cp", cp: -30 }, depth: options.depth, pv: [move] }],
          depth: options.depth,
        };
      }
      const verification = (options.multiPv ?? 3) > 3;
      const rootPly = game.plies.find((ply) => ply.fenBefore === fen);
      const keepsPlayedMove = !verification || fen === game.initialFen;
      const first = keepsPlayedMove ? rootPly?.uci ?? "a2a3" : "a7a6";
      return {
        fen,
        score: { kind: "cp", cp: 0 },
        bestMove: first,
        lines: [
          { rank: 1, score: { kind: "cp", cp: 0 }, depth: options.depth, pv: [first] },
          { rank: 2, score: { kind: "cp", cp: -400 }, depth: options.depth, pv: ["e2e4"] },
          { rank: 3, score: { kind: "cp", cp: -500 }, depth: options.depth, pv: ["g1f3"] },
        ],
        depth: options.depth,
      };
    },
    terminate() {},
  };
}

describe("canonical objective game orchestration", () => {
  it("uses fixed classification MultiPV and rebuilds selected moves from stronger evidence", async () => {
    const game = parsePgn("1. e4");
    const baselineOptions: GameReviewOptions[] = [];
    const verificationOptions: GameVerificationOptions[] = [];
    const after = { fen: game.finalFen, score: { kind: "cp" as const, cp: 0 }, lines: [], depth: 12 };
    const verifiedAfter = { ...after, depth: 18 };
    const pool: Pick<BrowserStockfishPool, "analyzeGame" | "verifyMoves"> = {
      async analyzeGame(_game, options) {
        baselineOptions.push(options);
        return { positionAnalyses: [root(game.initialFen, 12), after], playedMoveAnalyses: new Map() };
      },
      async verifyMoves(_game, options) {
        verificationOptions.push(options);
        return {
          positionAnalyses: new Map([[0, root(game.initialFen, 18)], [1, verifiedAfter]]),
          playedMoveAnalyses: new Map(),
        };
      },
    };

    const analysis = await analyzeObjectiveGame(game, pool, {
      depth: 12,
      division: { totalPlies: 1 },
      opening: null,
      createdAt: "2026-08-26T00:00:00.000Z",
    });

    expect(baselineOptions[0]?.multiPv).toBe(3);
    expect(verificationOptions[0]).toMatchObject({ depth: 15, multiPv: 5, plies: [1] });
    expect(analysis.engine).toMatchObject({ classificationMultiPv: 3, verifiedMoveCount: 1 });
    expect(analysis.moves[0]).toMatchObject({
      annotations: ["critical"],
      classification: "great",
      classificationReason: { verification: { status: "verified", depth: 18, multiPv: 3 } },
    });
  });

  it("completes when a verified root replacement drops the next played move out of MultiPV", async () => {
    const game = parsePgn("1. d4 d5");
    const pool = new BrowserStockfishPool(1, () => driftSearcher());

    const analysis = await analyzeObjectiveGame(game, pool, {
      depth: 12,
      division: { totalPlies: 2 },
      opening: null,
      createdAt: "2026-08-26T00:00:00.000Z",
    });

    expect(analysis.moves).toHaveLength(2);
    // Ply 1 was selected for deeper verification; its evidence is marked verified.
    expect(analysis.moves[0]?.classificationReason.verification?.status).toBe("verified");
    // The resulting position of ply 1 is ply 2's root: the deeper re-search no
    // longer lists d7d5, so ply 2 must keep restricted played-move evidence
    // instead of failing with "outside MultiPV and has no restricted search".
    expect(analysis.moves[1]).toMatchObject({
      uci: "d7d5",
      playedMoveOutsideMultiPv: true,
    });
    expect(analysis.moves[1]?.classificationReason.exclusions).not.toContain("missing-evidence");
  });
});
