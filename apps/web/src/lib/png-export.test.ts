import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PIECE_ASSET_DIR, PIECE_ASSET_KEYS, boardPieceImageKey } from "./board-piece-assets";
import { BOARD_SQUARE_FALLBACK } from "./png-export";

const tokens = readFileSync(join(process.cwd(), "src/app/styles/tokens.css"), "utf8");

function tokenValue(name: string): string {
  const match = tokens.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, "m"));
  if (!match) throw new Error(`tokens.css is missing ${name}`);
  return match[1]!.trim();
}

describe("PNG export board appearance", () => {
  it("keeps the canvas fallback palette equal to the board tokens", () => {
    // The canvas cannot resolve CSS variables in every environment, so the
    // fallback must stay identical to what the live board renders.
    expect(BOARD_SQUARE_FALLBACK.light).toBe(tokenValue("--board-square-light"));
    expect(BOARD_SQUARE_FALLBACK.dark).toBe(tokenValue("--board-square-dark"));
  });

  it("maps every FEN piece character to an existing authored asset", () => {
    for (const fenPiece of ["P", "N", "B", "R", "Q", "K", "p", "n", "b", "r", "q", "k"]) {
      const key = boardPieceImageKey(fenPiece);
      expect(PIECE_ASSET_KEYS).toContain(key);
      expect(existsSync(join(process.cwd(), "public", PIECE_ASSET_DIR, `${key}.png`)), key).toBe(true);
    }
  });
});
