import { describe, expect, it } from "vitest";
import {
  EXPLORER_MAX_MOVES,
  explorerCacheKey,
  explorerPopulationKey,
  explorerPopulationLabel,
  explorerPopulationQuery,
  explorerRatingBuckets,
  normalizeExplorerPosition,
  parseExplorerPopulation,
} from "./explorer";

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

describe("opening explorer population", () => {
  it("counts the rating buckets at or above the floor", () => {
    expect(explorerRatingBuckets(1600)).toEqual([1600, 1800, 2000, 2200, 2500]);
    expect(explorerRatingBuckets(1200)).toEqual([1200, 1400, 1600, 1800, 2000, 2200, 2500]);
    expect(explorerRatingBuckets(null)).toEqual([]);
  });

  it("keys a population by its games, not by the order it was written in", () => {
    const club = { ratingFloor: 1600 as const, speeds: ["blitz", "rapid"] as const };
    const reordered = { ratingFloor: 1600 as const, speeds: ["rapid", "blitz"] as const };

    expect(explorerPopulationKey({ ...club, speeds: [...club.speeds] })).toBe(explorerPopulationKey({ ...reordered, speeds: [...reordered.speeds] }));
    expect(explorerPopulationKey({ ratingFloor: 2000, speeds: ["blitz", "rapid"] })).not.toBe(explorerPopulationKey({ ratingFloor: 1600, speeds: ["blitz", "rapid"] }));
    expect(explorerPopulationKey({ ratingFloor: 1600, speeds: ["blitz"] })).not.toBe(explorerPopulationKey({ ratingFloor: 1600, speeds: [] }));
    // Every rated game and every rating bucket are different claims.
    expect(explorerPopulationKey({ ratingFloor: null, speeds: [] })).not.toBe(explorerPopulationKey({ ratingFloor: 1600, speeds: [] }));
  });

  it("counts the population in the cache key together with the database and position", () => {
    const club = { ratingFloor: 1600 as const, speeds: ["blitz", "rapid", "classical"] as const };

    expect(explorerCacheKey("epd a", "lichess", { ...club, speeds: [...club.speeds] })).not.toBe(explorerCacheKey("epd a", "lichess", { ratingFloor: 2000, speeds: ["blitz", "rapid", "classical"] }));
    expect(explorerCacheKey("epd a", "lichess", { ...club, speeds: [...club.speeds] })).not.toBe(explorerCacheKey("epd a", "masters", { ...club, speeds: [...club.speeds] }));
  });

  it("names the population the numbers describe", () => {
    expect(explorerPopulationLabel({ ratingFloor: 1600, speeds: ["blitz", "rapid", "classical"] }, "en")).toBe("rated 1600+ · blitz, rapid, classical");
    expect(explorerPopulationLabel({ ratingFloor: null, speeds: [] }, "en")).toBe("all ratings · all speeds");
  });

  it("reads only populations the contract defines", () => {
    expect(parseExplorerPopulation("1600", "blitz,rapid")).toEqual({ ratingFloor: 1600, speeds: ["blitz", "rapid"] });
    expect(parseExplorerPopulation("all", "all")).toEqual({ ratingFloor: null, speeds: [] });
    expect(parseExplorerPopulation(null, null)).toEqual({ ratingFloor: null, speeds: [] });
    expect(parseExplorerPopulation("1700", "blitz")).toBeNull();
    expect(parseExplorerPopulation("1600", "blitz,horde")).toBeNull();
    // Round-trips through the query encoding the client uses.
    const population = { ratingFloor: 2200 as const, speeds: ["rapid"] as const };
    const query = explorerPopulationQuery({ ...population, speeds: [...population.speeds] });
    expect(parseExplorerPopulation(query.rating, query.speeds)).toEqual({ ratingFloor: 2200, speeds: ["rapid"] });
  });
});

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
