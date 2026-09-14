import { describe, expect, it } from "vitest";
import { normalizeTablebasePosition, TABLEBASE_MAX_PIECES, tablebaseCovers, tablebasePieceCount, tablebasePositionKey } from "./tablebase";

const FEN = "8/8/8/8/8/4k3/8/4K2R w - - 0 1";

const payload = {
  category: "win",
  dtz: 12,
  dtm: 21,
  checkmate: false,
  stalemate: false,
  moves: [
    { uci: "h1h8", san: "Rh8", category: "win", dtz: 11, dtm: 20, zeroing: false, conversion: false },
    { uci: "e1d2", san: "Kd2", category: "draw", zeroing: false, conversion: false },
  ],
};

describe("tablebase contract", () => {
  it("counts pieces from the position, not from the caller", () => {
    expect(tablebasePieceCount(FEN)).toBe(3);
    expect(tablebaseCovers(FEN)).toBe(true);
    expect(tablebaseCovers("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBe(false);
    expect(tablebasePieceCount("not a fen")).toBeNull();
    expect(tablebaseCovers("not a fen")).toBe(false);
    expect(TABLEBASE_MAX_PIECES).toBe(7);
  });

  it("keys the position by identity, not by move counters", () => {
    expect(tablebasePositionKey("8/8/8/8/8/4k3/8/4K2R w - - 0 1")).toBe(tablebasePositionKey("8/8/8/8/8/4k3/8/4K2R w - - 9 42"));
    expect(tablebasePositionKey(FEN)).toBe("8/8/8/8/8/4k3/8/4K2R w - -");
  });

  it("normalizes a result without collapsing the outcome categories", () => {
    const position = normalizeTablebasePosition(payload, FEN);
    expect(position).toMatchObject({ version: 1, fen: FEN, source: "lichess", tables: "syzygy-7", pieceCount: 3, category: "win", dtz: 12, dtm: 21 });
    expect(position?.moves).toHaveLength(2);
    expect(position?.moves[0]).toMatchObject({ uci: "h1h8", san: "Rh8", category: "win", dtz: 11, dtm: 20 });
    expect(position?.moves[1]).toMatchObject({ san: "Kd2", category: "draw", zeroing: false, conversion: false });
    expect(position?.moves[1]?.dtz).toBeUndefined();
  });

  it("keeps a cursed win a cursed win", () => {
    const position = normalizeTablebasePosition({ ...payload, category: "cursed-win" }, FEN);
    expect(position?.category).toBe("cursed-win");
  });

  it("rejects an incomplete payload rather than hiding moves the tables do carry", () => {
    expect(normalizeTablebasePosition(null, FEN)).toBeNull();
    expect(normalizeTablebasePosition({ ...payload, category: "huge-win" }, FEN)).toBeNull();
    expect(normalizeTablebasePosition({ ...payload, checkmate: undefined }, FEN)).toBeNull();
    expect(normalizeTablebasePosition({ ...payload, moves: [{ uci: "h1h8", san: "Rh8", category: "win", zeroing: false, conversion: false }, { uci: "e1e2", san: "Ke2", category: "draw" }] }, FEN)).toBeNull();
    expect(normalizeTablebasePosition(payload, "not a fen")).toBeNull();
  });

  it("accepts an empty move list for a terminal position", () => {
    const position = normalizeTablebasePosition({ category: "loss", checkmate: true, stalemate: false, moves: [] }, FEN);
    expect(position).toMatchObject({ category: "loss", checkmate: true, moves: [] });
  });
});
