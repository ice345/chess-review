import { describe, expect, it } from "vitest";
import { fenToEpd, parsePgn, replayUciLine } from "./game";

describe("parsePgn", () => {
  it("normalizes SAN, UCI, colors, and before/after positions", () => {
    const game = parsePgn("1. e4 e5 2. Nf3 Nc6");
    expect(game.plies).toHaveLength(4);
    expect(game.plies[0]).toMatchObject({ ply: 1, color: "white", san: "e4", uci: "e2e4" });
    expect(game.plies[3]).toMatchObject({ ply: 4, color: "black", san: "Nc6", uci: "b8c6" });
    expect(game.plies[0]?.fenBefore).toBe(game.initialFen);
    expect(game.plies[3]?.fenAfter).toBe(game.finalFen);
  });

  it("preserves a PGN FEN start position", () => {
    const game = parsePgn(`[SetUp "1"]\n[FEN "8/8/8/8/8/8/K6k/8 w - - 0 1"]\n\n1. Kb3`);
    expect(game.initialFen).toContain("K6k");
    expect(game.plies[0]?.uci).toBe("a2b3");
  });
});

describe("fenToEpd", () => {
  it("drops clocks while preserving position metadata", () => {
    expect(fenToEpd("8/8/8/8/8/8/K6k/8 w - - 12 42")).toBe("8/8/8/8/8/8/K6k/8 w - -");
  });
});

describe("replayUciLine", () => {
  it("validates an engine line and exposes SAN plus every resulting position", () => {
    const line = replayUciLine("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [
      "e2e4",
      "c7c5",
      "g1f3",
    ]);
    expect(line.map((move) => move.san)).toEqual(["e4", "c5", "Nf3"]);
    expect(line[0]?.fenAfter).toBe(line[1]?.fenBefore);
  });

  it("rejects an illegal continuation instead of inventing SAN", () => {
    expect(() => replayUciLine("8/8/8/8/8/8/K6k/8 w - - 0 1", ["a2a8"])).toThrow(/Illegal UCI move/);
  });
});
