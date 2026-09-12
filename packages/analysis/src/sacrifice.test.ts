import { Chess } from "chess.js";
import type { EngineLine } from "@chess-review/shared";
import { describe, expect, it } from "vitest";
import { detectSacrifice, staticExchangeGain } from "./sacrifice";

const GREEK_GIFT_FEN = "rnbq1rk1/ppp2ppp/3b1n2/3p4/3P4/3B1N2/PPP2PPP/RNBQ1RK1 w - - 0 1";
const GREEK_GIFT_PV = ["d3h7", "g8h7", "f3g5", "h7g8", "d1h5"];

function fenAfter(fen: string, uci: string): string {
  const chess = new Chess(fen);
  chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? "q" });
  return chess.fen();
}

describe("sacrifice evidence", () => {
  it("does not count an absolutely pinned piece as a legal attacker or defender", () => {
    // White Ke1 and Be2; black Re4 pins the bishop against the king along the
    // e-file. Bxd3 is illegal because it opens the file onto the king, so white
    // has no legal attacker on d3 at all.
    expect(staticExchangeGain("4r1k1/8/8/8/4r3/3p4/4B3/4K3 w - - 0 1", "d3", "w")).toBe(0);
    // The same capture without the pinning rook is a plain pawn win, which
    // proves the zero above comes from the pin and not from the geometry.
    expect(staticExchangeGain("6k1/8/8/8/8/3p4/4B3/4K3 w - - 0 1", "d3", "w")).toBe(100);
  });

  it("uses x-ray-aware exchanges and treats a defended equal trade as non-sacrificial", () => {
    const before = "7k/8/4p3/3n4/2B5/8/8/7K w - - 0 1";
    const after = fenAfter(before, "c4d5");
    expect(staticExchangeGain(after, "d5", "b")).toBe(330);
    expect(detectSacrifice({
      fenBefore: before,
      fenAfter: after,
      uci: "c4d5",
      color: "white",
      scoreBefore: { kind: "cp", cp: 0 },
      playedMoveScore: { kind: "cp", cp: 0 },
      playedLine: { rank: 1, score: { kind: "cp", cp: 0 }, depth: 15, pv: ["c4d5", "e6d5"] },
    })).toBeUndefined();
  });

  it("verifies a Greek-gift material investment through the opponent best response and PV", () => {
    const line: EngineLine = {
      rank: 1,
      score: { kind: "cp", cp: 30 },
      depth: 18,
      pv: GREEK_GIFT_PV,
    };
    const evidence = detectSacrifice({
      fenBefore: GREEK_GIFT_FEN,
      fenAfter: fenAfter(GREEK_GIFT_FEN, "d3h7"),
      uci: "d3h7",
      color: "white",
      scoreBefore: { kind: "cp", cp: 20 },
      playedMoveScore: { kind: "cp", cp: 30 },
      playedLine: line,
    });

    expect(evidence).toMatchObject({
      sacrificedMaterial: 230,
      see: -330,
      compensationCp: 240,
      survivesBestResponse: true,
      recoveredWithinPv: 0,
      genuine: true,
    });
  });

  it("retains unsupported material-offer evidence without calling it genuine", () => {
    const evidence = detectSacrifice({
      fenBefore: GREEK_GIFT_FEN,
      fenAfter: fenAfter(GREEK_GIFT_FEN, "d3h7"),
      uci: "d3h7",
      color: "white",
      scoreBefore: { kind: "cp", cp: 20 },
      playedMoveScore: { kind: "cp", cp: -500 },
      playedLine: { rank: 1, score: { kind: "cp", cp: -500 }, depth: 15, pv: ["d3h7", "g8h7"] },
    });
    expect(evidence?.genuine).toBe(false);
    expect(evidence?.survivesBestResponse).toBe(false);
  });
});
