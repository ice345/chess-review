import { describe, expect, it } from "vitest";
import { boardMoveHintStyles, pieceMatchesTurn } from "./board-move-hints";

describe("board move hints", () => {
  it("renders distinct quiet and capture affordances plus a selected origin", () => {
    const styles = boardMoveHintStyles("e4", [
      { from: "e4", to: "e5", san: "e5", isCapture: false },
      { from: "e4", to: "d5", san: "exd5", isCapture: true },
    ]);

    expect(styles.e4?.boxShadow).toContain("inset");
    expect(styles.e5?.backgroundImage).toContain("0 12%");
    expect(styles.d5?.backgroundImage).toContain("64% 78%");
    expect(styles.e5).not.toEqual(styles.d5);
  });

  it("only lets the side to move become a click origin", () => {
    const whiteTurn = "8/8/8/8/8/8/8/8 w - - 0 1";
    expect(pieceMatchesTurn("wP", whiteTurn)).toBe(true);
    expect(pieceMatchesTurn("bP", whiteTurn)).toBe(false);
  });
});
