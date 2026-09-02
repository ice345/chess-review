import { describe, expect, it } from "vitest";
import { engineCacheKey } from "./cache";

describe("engineCacheKey", () => {
  it("separates unrestricted and searchmoves analyses", () => {
    const root = engineCacheKey("fen", "18", 12, 3);
    const restricted = engineCacheKey("fen", "18", 12, 1, ["e2e4"]);
    expect(root).not.toBe(restricted);
    expect(restricted).not.toBe(engineCacheKey("fen", "18", 12, 1, ["d2d4"]));
  });

  it("separates the same board with and without repetition history", () => {
    const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const once = engineCacheKey(start, "18", 12, 3);
    const repeated = engineCacheKey(start, "18", 12, 3, [], ["g1f3", "g8f6", "f3g1", "f6g8"]);
    expect(once).not.toBe(repeated);
  });
});
