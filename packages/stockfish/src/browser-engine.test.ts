import { parsePgn } from "@chess-review/chess-core";
import { describe, expect, it } from "vitest";
import { BrowserStockfish } from "./browser-engine";

describe("BrowserStockfish terminal positions", () => {
  it("returns a signed no-PV mate score without starting a worker", async () => {
    const game = parsePgn("1. f3 e5 2. g4 Qh4# 0-1");
    await expect(new BrowserStockfish().search(game.finalFen, { depth: 10, multiPv: 3 })).resolves.toEqual({
      fen: game.finalFen,
      score: { kind: "mate", mateIn: -1 },
      lines: [],
      depth: 10,
    });
  });

  it("returns an equal no-PV score for stalemate", async () => {
    const fen = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1";
    await expect(new BrowserStockfish().search(fen, { depth: 10 })).resolves.toMatchObject({
      fen,
      score: { kind: "cp", cp: 0 },
      lines: [],
    });
  });
});
