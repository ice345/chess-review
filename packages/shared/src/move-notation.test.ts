import { describe, expect, it } from "vitest";
import { formatMoveNotation, formatMoveNumber } from "./move-notation";

describe("formatMoveNotation", () => {
  it("uses the FEN fullmove number, not ply / 2", () => {
    expect(formatMoveNotation({
      fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      color: "white",
      san: "e4",
    })).toBe("1. e4");
    expect(formatMoveNotation({
      fenBefore: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      color: "black",
      san: "e5",
    })).toBe("1… e5");
    expect(formatMoveNumber("4r1k1/8/8/8/4r3/3p4/4B3/4K3 b - - 0 50", "black")).toBe("50…");
    expect(formatMoveNotation({
      fenBefore: "4r1k1/8/8/8/4r3/3p4/4B3/4K3 b - - 0 50",
      color: "black",
      san: "Ne5",
    })).toBe("50… Ne5");
  });
});

