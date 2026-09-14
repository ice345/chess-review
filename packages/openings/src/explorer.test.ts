import { describe, expect, it } from "vitest";
import { explorerCacheKey, EXPLORER_MAX_MOVES, normalizeExplorerPosition } from "./explorer";

const move = (uci: string, san: string, white: number, draws: number, black: number) => ({ uci, san, white, draws, black });

const payload = {
  white: 40,
  draws: 30,
  black: 30,
  moves: [
    move("e2e4", "e4", 12, 6, 2),
    move("d2d4", "d4", 8, 8, 8),
  ],
  opening: { eco: "C20", name: "King's Pawn Game" },
};

describe("opening explorer normalization", () => {
  it("normalizes counts, percentages and the opening name", () => {
    const position = normalizeExplorerPosition(payload, "epd", "lichess");
    expect(position).toMatchObject({
      version: 1,
      fen: "epd",
      source: "lichess",
      totalGames: 100,
      whitePercent: 40,
      drawPercent: 30,
      blackPercent: 30,
      opening: { eco: "C20", name: "King's Pawn Game" },
    });
    expect(position?.moves).toHaveLength(2);
    // Ordered by games: d4 has 24 games, e4 has 20.
    expect(position?.moves[0]).toMatchObject({ uci: "d2d4", san: "d4", games: 24, whitePercent: 33.3, drawPercent: 33.3, blackPercent: 33.3 });
    expect(position?.moves[1]).toMatchObject({ uci: "e2e4", san: "e4", games: 20, whitePercent: 60, drawPercent: 30, blackPercent: 10 });
  });

  it("orders moves by games and caps how many are kept", () => {
    const many = Array.from({ length: 30 }, (_, index) => move(`a2a${(index % 8) + 1}`, `a${index}`, index, 0, 0));
    const position = normalizeExplorerPosition({ white: 1, draws: 0, black: 0, moves: many }, "epd", "masters");
    expect(position?.moves).toHaveLength(EXPLORER_MAX_MOVES);
    expect(position?.moves[0]?.white).toBe(29);
  });

  it("reports no percentages for a position nothing has been played from", () => {
    const position = normalizeExplorerPosition({ white: 0, draws: 0, black: 0, moves: [] }, "epd", "lichess");
    expect(position).toMatchObject({ totalGames: 0, whitePercent: 0, drawPercent: 0, blackPercent: 0, moves: [] });
  });

  it("rejects a payload that would present missing games as zero games", () => {
    expect(normalizeExplorerPosition(null, "epd", "lichess")).toBeNull();
    expect(normalizeExplorerPosition({ white: 1, draws: 0 }, "epd", "lichess")).toBeNull();
    expect(normalizeExplorerPosition({ white: 1, draws: 0, black: 0 }, "epd", "lichess")).toBeNull();
    expect(normalizeExplorerPosition({ white: 1, draws: 0, black: 0, moves: "none" }, "epd", "lichess")).toBeNull();
    expect(normalizeExplorerPosition({ white: 1, draws: 0, black: 0, moves: [{ uci: "e2e4", san: "e4", white: 1, draws: 0 }] }, "epd", "lichess")).toBeNull();
    expect(normalizeExplorerPosition({ white: 1, draws: 0, black: 0, moves: [move("e2e4!", "e4", 1, 0, 0)] }, "epd", "lichess")).toBeNull();
    expect(normalizeExplorerPosition({ white: -1, draws: 0, black: 0, moves: [] }, "epd", "lichess")).toBeNull();
    expect(normalizeExplorerPosition({ white: 1.5, draws: 0, black: 0, moves: [] }, "epd", "lichess")).toBeNull();
  });

  it("drops a malformed opening name instead of failing the position", () => {
    const position = normalizeExplorerPosition({ ...payload, opening: { eco: "C20" } }, "epd", "lichess");
    expect(position?.opening).toBeUndefined();
  });

  it("keys the cache by source and position identity", () => {
    expect(explorerCacheKey("epd a", "lichess")).not.toBe(explorerCacheKey("epd a", "masters"));
    expect(explorerCacheKey("epd a", "lichess")).not.toBe(explorerCacheKey("epd b", "lichess"));
  });
});
