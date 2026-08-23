import { describe, expect, it } from "vitest";
import { engineCacheKey } from "./cache";

describe("engineCacheKey", () => {
  it("separates unrestricted and searchmoves analyses", () => {
    const root = engineCacheKey("fen", "18", 12, 3);
    const restricted = engineCacheKey("fen", "18", 12, 1, ["e2e4"]);
    expect(root).not.toBe(restricted);
    expect(restricted).not.toBe(engineCacheKey("fen", "18", 12, 1, ["d2d4"]));
  });
});
