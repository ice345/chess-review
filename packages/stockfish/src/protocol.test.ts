import { describe, expect, it } from "vitest";
import { engineCacheKey, LruCache } from "./cache";
import { parseBestMove, parseUciInfo } from "./protocol";

describe("UCI parsing", () => {
  it("parses MultiPV cp lines", () => {
    expect(parseUciInfo("info depth 18 multipv 2 score cp -37 nodes 12000 pv e7e5 g1f3")).toEqual({
      depth: 18,
      multiPv: 2,
      nodes: 12000,
      score: { kind: "cp", cp: -37 },
      pv: ["e7e5", "g1f3"],
    });
  });

  it("keeps mate scores distinct", () => {
    expect(parseUciInfo("info depth 20 score mate 3 pv h5h7" )?.score).toEqual({ kind: "mate", mateIn: 3 });
    expect(parseBestMove("bestmove h5h7 ponder e8e7")).toBe("h5h7");
  });
});

describe("engine cache", () => {
  it("includes every algorithmically relevant search parameter", () => {
    expect(engineCacheKey("fen", "18", 18, 3)).not.toBe(engineCacheKey("fen", "18", 20, 3));
    expect(engineCacheKey("fen", "18", 18, 3)).not.toBe(engineCacheKey("fen", "18", 18, 5));
  });

  it("evicts the least recently used entry", () => {
    const cache = new LruCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);
    expect(cache.get("b")).toBeUndefined();
  });
});
