import { parsePgn } from "@chess-review/chess-core";
import type { StockfishMoveAnalysis } from "@chess-review/shared";
import { describe, expect, it } from "vitest";
import type { SearchOptions } from "./browser-engine";
import { BrowserStockfishPool, type StockfishSearcher } from "./game-review";

const game = parsePgn("1. e4 e5 2. Nf3 Nc6");

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
});
