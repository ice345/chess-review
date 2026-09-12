import { describe, expect, it } from "vitest";
import { ChessImportError, drawStatus, fenToEpd, legalBoardDestinations, noLegalMoveTerminalStatus, parsePgn, playLegalBoardMove, replayUciLine } from "./game";

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

  it("rejects Chess960 and other named variants", () => {
    expect(() => parsePgn(`[Variant "Chess960"]\n\n1. e4 *`)).toThrow(ChessImportError);
    expect(() => parsePgn(`[Variant "Chess960"]\n\n1. e4 *`)).toThrow(/standard chess/);
    expect(() => parsePgn("this is not a chess game 1. e4 e5 2. Ke2 illegal")).toThrow(/could not be parsed/);
  });

  it("keeps imported comments, NAGs and variations on the move they annotate", () => {
    const game = parsePgn(`[Event "Annotated"]

{ Notes before the game }
1. e4 $1 { Best by test } (1. d4 d5) e5 2. Nf3 Nc6 *`);

    expect(game.comment).toBe("Notes before the game");
    expect(game.plies).toHaveLength(4);
    expect(game.plies[0]).toMatchObject({ san: "e4", comment: "Best by test", nags: [1], variations: ["(1. d4 d5)"] });
    expect(game.plies[1]?.comment).toBeUndefined();
    expect(game.plies[3]?.san).toBe("Nc6");
  });

  it("leaves annotation fields absent for a plain PGN", () => {
    const game = parsePgn("1. e4 e5 2. Nf3 Nc6");
    expect(game.comment).toBeUndefined();
    expect(game.plies[0]?.comment).toBeUndefined();
    expect(game.plies[0]?.nags).toBeUndefined();
    expect(game.plies[0]?.variations).toBeUndefined();
  });
});

describe("drawStatus", () => {
  it("detects claimable threefold from start-position repetitions", () => {
    const game = parsePgn("1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8");
    expect(drawStatus(game.initialFen, game.plies.map((ply) => ply.uci))).toEqual({
      kind: "threefold",
      automatic: false,
    });
    expect(drawStatus(game.finalFen)).toBeNull();
  });

  it("treats fifty-move as claimable and seventy-five as automatic", () => {
    expect(drawStatus("4k3/8/8/8/8/8/8/R3K3 w - - 100 50")).toEqual({ kind: "fifty-move", automatic: false });
    expect(drawStatus("4k3/8/8/8/8/8/8/R3K3 w - - 150 80")).toEqual({ kind: "seventy-five-move", automatic: true });
  });
});

describe("fenToEpd", () => {
  it("drops clocks while preserving position metadata", () => {
    expect(fenToEpd("8/8/8/8/8/8/K6k/8 w - - 12 42")).toBe("8/8/8/8/8/8/K6k/8 w - -");
  });
});

describe("noLegalMoveTerminalStatus", () => {
  it("distinguishes checkmate and stalemate from positions that still have legal moves", () => {
    const mate = parsePgn("1. f3 e5 2. g4 Qh4# 0-1");
    expect(noLegalMoveTerminalStatus(mate.finalFen)).toEqual({ kind: "checkmate", sideToMove: "white" });
    expect(noLegalMoveTerminalStatus("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")).toEqual({ kind: "stalemate", sideToMove: "black" });
    expect(noLegalMoveTerminalStatus(mate.initialFen)).toBeNull();
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

describe("playLegalBoardMove", () => {
  it("validates a user move and returns canonical SAN/FEN", () => {
    const move = playLegalBoardMove("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", {
      from: "e2",
      to: "e4",
    });
    expect(move).toMatchObject({ uci: "e2e4", san: "e4" });
    expect(move.fenAfter).toContain(" b KQkq - ");
  });

  it("rejects an illegal drag", () => {
    expect(() => playLegalBoardMove("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", {
      from: "e2",
      to: "e5",
    })).toThrow(/Illegal board move/);
  });

  it("defaults a legal promotion to a queen", () => {
    const move = playLegalBoardMove("8/P7/8/8/8/8/7k/K7 w - - 0 1", { from: "a7", to: "a8" });
    expect(move.uci).toBe("a7a8q");
    expect(move.san).toContain("=Q");
  });
});

describe("legalBoardDestinations", () => {
  it("returns rules-validated quiet and capture hints for one selected piece", () => {
    const destinations = legalBoardDestinations("rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 2", "e5");

    expect(destinations.map((move) => move.to)).toContain("d4");
    expect(destinations.find((move) => move.to === "d4")?.isCapture).toBe(true);
    expect(destinations.find((move) => move.to === "e4")?.isCapture).toBe(false);
  });

  it("returns no hints for an empty square or the wrong side to move", () => {
    const initial = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(legalBoardDestinations(initial, "e4")).toEqual([]);
    expect(legalBoardDestinations(initial, "e7")).toEqual([]);
  });
});

