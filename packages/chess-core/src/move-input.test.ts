import { describe, expect, it } from "vitest";
import { resolveMoveInput } from "./game";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// White pawn on e7 with the black king far away on a8: promotion is available.
const PROMOTION = "k7/4P3/8/8/8/8/8/4K3 w - - 0 1";
// White can castle kingside.
const CASTLING = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";

describe("typed move input", () => {
  it("accepts SAN as the board would accept it", () => {
    expect(resolveMoveInput(START, "Nf3")).toEqual({ from: "g1", to: "f3", uci: "g1f3", san: "Nf3" });
    expect(resolveMoveInput(START, "e4")).toEqual({ from: "e2", to: "e4", uci: "e2e4", san: "e4" });
    expect(resolveMoveInput(START, " O-O-O ")).toBeNull();
    expect(resolveMoveInput(CASTLING, "O-O")).toEqual({ from: "e1", to: "g1", uci: "e1g1", san: "O-O" });
  });

  it("accepts UCI, upper or lower case", () => {
    expect(resolveMoveInput(START, "g1f3")).toEqual({ from: "g1", to: "f3", uci: "g1f3", san: "Nf3" });
    expect(resolveMoveInput(START, "G1F3")).toMatchObject({ uci: "g1f3" });
  });

  it("names the piece a promotion produced", () => {
    // The queen on e8 attacks the king on a8 along the eighth rank.
    expect(resolveMoveInput(PROMOTION, "e8=Q+")).toEqual({ from: "e7", to: "e8", promotion: "q", uci: "e7e8q", san: "e8=Q+" });
    expect(resolveMoveInput(PROMOTION, "e7e8n")).toMatchObject({ promotion: "n", uci: "e7e8n" });
    // A promotion must name its piece, exactly as the board's chooser requires.
    expect(resolveMoveInput(PROMOTION, "e7e8")).toBeNull();
    expect(resolveMoveInput(PROMOTION, "e8")).toBeNull();
  });

  it("rejects anything that is not a legal move here", () => {
    expect(resolveMoveInput(START, "")).toBeNull();
    expect(resolveMoveInput(START, "   ")).toBeNull();
    expect(resolveMoveInput(START, "Nf6")).toBeNull();
    expect(resolveMoveInput(START, "e2e5")).toBeNull();
    expect(resolveMoveInput(START, "not a move")).toBeNull();
    expect(resolveMoveInput(PROMOTION, "e7e8k")).toBeNull();
  });

  it("tolerates the annotation suffixes a person types", () => {
    expect(resolveMoveInput(START, "Nf3!")).toMatchObject({ san: "Nf3" });
    expect(resolveMoveInput(START, "e4?!")).toMatchObject({ san: "e4" });
  });
});
