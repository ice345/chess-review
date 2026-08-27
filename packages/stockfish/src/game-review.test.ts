import { parsePgn } from "@chess-review/chess-core";
import type { StockfishMoveAnalysis } from "@chess-review/shared";
import { describe, expect, it } from "vitest";
import type { SearchOptions } from "./browser-engine";
import { BrowserStockfishPool, type StockfishSearcher } from "./game-review";

const game = parsePgn("1. e4 e5 2. Nf3 Nc6");
const checkmateGame = parsePgn("1. f3 e5 2. g4 Qh4# 0-1");

class FakeSearcher implements StockfishSearcher {
  static active = 0;
  static maximumActive = 0;
  static searches: Array<{ fen: string; options: SearchOptions }> = [];

  async search(fen: string, options: SearchOptions): Promise<StockfishMoveAnalysis> {
    FakeSearcher.active += 1;
    FakeSearcher.maximumActive = Math.max(FakeSearcher.maximumActive, FakeSearcher.active);
    FakeSearcher.searches.push({ fen, options });
    await Promise.resolve();
    FakeSearcher.active -= 1;
    const played = options.searchMoves?.[0];
    const rootPly = game.plies.find((ply) => ply.fenBefore === fen);
    const pvMove = played ?? (rootPly?.ply === 2 ? "g8f6" : rootPly?.uci ?? "a2a3");
    return {
      fen,
      score: { kind: "cp", cp: 20 },
      ...(played ? { searchMoves: [played] } : {}),
      bestMove: pvMove,
      lines: [{ rank: 1, score: { kind: "cp", cp: 20 }, depth: options.depth, pv: [pvMove] }],
      depth: options.depth,
    };
  }

  terminate(): void {}
}

class CheckmateSearcher implements StockfishSearcher {
  static searchedFens: string[] = [];

  async search(fen: string, options: SearchOptions): Promise<StockfishMoveAnalysis> {
    CheckmateSearcher.searchedFens.push(fen);
    if (fen === checkmateGame.finalFen) throw new Error("A no-legal-move terminal position must not be searched.");
    const ply = checkmateGame.plies.find((candidate) => candidate.fenBefore === fen);
    const move = options.searchMoves?.[0] ?? ply?.uci ?? "a2a3";
    const score = ply?.ply === checkmateGame.plies.length
      ? { kind: "mate" as const, mateIn: -1 }
      : { kind: "cp" as const, cp: 20 };
    return {
      fen,
      score,
      bestMove: move,
      lines: [{ rank: 1, score, depth: options.depth, pv: [move] }],
      depth: options.depth,
    };
  }

  terminate(): void {}
}

/**
 * Simulates a deeper re-search whose candidate order drifts: the replacement
 * root for a verified ply no longer lists the played move of the following
 * (unverified) ply among its MultiPV candidates.
 */
class UnstableVerificationSearcher implements StockfishSearcher {
  static restrictedPlies: number[] = [];

  async search(fen: string, options: SearchOptions): Promise<StockfishMoveAnalysis> {
    if (options.searchMoves?.length) {
      const move = options.searchMoves[0]!;
      const ply = game.plies.find((candidate) => candidate.fenBefore === fen);
      UnstableVerificationSearcher.restrictedPlies.push(ply?.ply ?? -1);
      return {
        fen,
        score: { kind: "cp", cp: 10 },
        bestMove: move,
        searchMoves: [...options.searchMoves],
        lines: [{ rank: 1, score: { kind: "cp", cp: 10 }, depth: options.depth, pv: [move] }],
        depth: options.depth,
      };
    }
    const ply = game.plies.find((candidate) => candidate.fenBefore === fen);
    const deepRootDropsPlayedMove = (options.multiPv ?? 3) > 3 && ply?.ply === 3;
    const pvMove = deepRootDropsPlayedMove ? "g2g3" : ply?.uci ?? "a2a3";
    return {
      fen,
      score: { kind: "cp", cp: 20 },
      bestMove: pvMove,
      lines: [{ rank: 1, score: { kind: "cp", cp: 20 }, depth: options.depth, pv: [pvMove] }],
      depth: options.depth,
    };
  }

  terminate(): void {}
}

describe("BrowserStockfishPool", () => {
  it("bounds parallel root searches and restricts missing played moves", async () => {
    FakeSearcher.active = 0;
    FakeSearcher.maximumActive = 0;
    FakeSearcher.searches = [];
    const progress: string[] = [];
    const pool = new BrowserStockfishPool(2, () => new FakeSearcher());

    const result = await pool.analyzeGame(game, {
      depth: 10,
      multiPv: 3,
      onProgress: ({ stage, completed, total }) => progress.push(`${stage}:${completed}/${total}`),
    });

    expect(result.positionAnalyses).toHaveLength(game.plies.length + 1);
    expect(FakeSearcher.maximumActive).toBeLessThanOrEqual(2);
    expect(result.playedMoveAnalyses.get(2)?.searchMoves).toEqual([game.plies[1]!.uci]);
    expect(FakeSearcher.searches.filter(({ options }) => options.searchMoves)).toHaveLength(1);
    expect(progress).toContain(`positions:${game.plies.length + 1}/${game.plies.length + 1}`);
    expect(progress).toContain("played-moves:1/1");
  });

  it("stops before scheduling work for an aborted request", async () => {
    const controller = new AbortController();
    controller.abort();
    const pool = new BrowserStockfishPool(1, () => new FakeSearcher());
    await expect(pool.analyzeGame(game, { depth: 10, signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("completes a checkmate game without requiring a PV from its terminal position", async () => {
    CheckmateSearcher.searchedFens = [];
    const progress: string[] = [];
    const pool = new BrowserStockfishPool(1, () => new CheckmateSearcher());

    const result = await pool.analyzeGame(checkmateGame, {
      depth: 10,
      multiPv: 3,
      onProgress: ({ stage, completed, total }) => progress.push(`${stage}:${completed}/${total}`),
    });

    expect(result.positionAnalyses).toHaveLength(checkmateGame.plies.length + 1);
    expect(result.positionAnalyses.at(-1)).toMatchObject({
      fen: checkmateGame.finalFen,
      score: { kind: "mate", mateIn: -1 },
      lines: [],
    });
    expect(CheckmateSearcher.searchedFens).not.toContain(checkmateGame.finalFen);
    expect(progress).toContain(`positions:${checkmateGame.plies.length + 1}/${checkmateGame.plies.length + 1}`);
  });

  it("selectively verifies requested roots/results and preserves restricted played-move evidence", async () => {
    FakeSearcher.searches = [];
    const pool = new BrowserStockfishPool(1, () => new FakeSearcher());
    const result = await pool.verifyMoves(game, { depth: 18, multiPv: 5, plies: [2, 2] });

    expect([...result.positionAnalyses.keys()]).toEqual([1, 2]);
    expect(FakeSearcher.searches.filter(({ options }) => options.depth === 18 && options.multiPv === 5)).toHaveLength(2);
    expect(result.playedMoveAnalyses.get(2)?.searchMoves).toEqual([game.plies[1]!.uci]);
  });

  it("supplies restricted evidence when a re-searched root drops an unverified successor move", async () => {
    UnstableVerificationSearcher.restrictedPlies = [];
    const pool = new BrowserStockfishPool(1, () => new UnstableVerificationSearcher());

    const result = await pool.verifyMoves(game, { depth: 18, multiPv: 5, plies: [2] });

    expect([...result.positionAnalyses.keys()].sort()).toEqual([1, 2]);
    // The requested root still lists its own played move, so ply 2 needs no override.
    expect(result.playedMoveAnalyses.has(2)).toBe(false);
    // The replacement root for ply 2's resulting position is also the ROOT of
    // the unplanned ply 3; its played move must regain restricted evidence.
    expect(result.playedMoveAnalyses.get(3)?.searchMoves).toEqual([game.plies[2]!.uci]);
    expect(UnstableVerificationSearcher.restrictedPlies).toEqual([3]);
  });
});
