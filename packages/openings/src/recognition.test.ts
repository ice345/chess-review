import { describe, expect, it } from "vitest";
import { parsePgn } from "@chess-review/chess-core";
import { recognizeOpening } from "./recognition";

describe("position-based opening recognition", () => {
  it("recognizes a named main line", () => {
    const opening = recognizeOpening(parsePgn("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6"));
    expect(opening).toMatchObject({ eco: "C70", name: "Ruy Lopez", matchedPly: 6 });
  });

  it("recognizes transpositions rather than requiring a PGN prefix", () => {
    const opening = recognizeOpening(parsePgn("1. d4 Nf6 2. c4 e6 3. Nc3 d5"));
    expect(opening).toMatchObject({ eco: "D35", name: "Queen's Gambit Declined", matchedPly: 6 });
  });
});
