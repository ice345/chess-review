import { Chess, type Square } from "chess.js";
import type { GameDivision, GamePhase } from "@chess-review/shared";
import type { NormalizedGame } from "@chess-review/chess-core";

function majorsAndMinors(chess: Chess): number {
  return chess.board().flat().filter((piece) => piece && piece.type !== "p" && piece.type !== "k").length;
}

function backrankSparse(chess: Chess): boolean {
  let white = 0;
  let black = 0;
  for (const file of "abcdefgh") {
    const whitePiece = chess.get(`${file}1` as Square);
    const blackPiece = chess.get(`${file}8` as Square);
    if (whitePiece?.color === "w") white += 1;
    if (blackPiece?.color === "b") black += 1;
  }
  return white < 4 || black < 4;
}

function mixednessScore(y: number, white: number, black: number): number {
  if (white === 0) {
    if (black === 1) return 1 + y;
    if (black === 2) return y < 6 ? 2 + (6 - y) : 0;
    if (black === 3 || black === 4) return y < 7 ? 3 + (7 - y) : 0;
    return 0;
  }
  if (white === 1) {
    if (black === 0) return 1 + (8 - y);
    if (black === 1) return 5 + Math.abs(4 - y);
    if (black === 2) return 4 + (7 - y);
    if (black === 3) return 5 + (7 - y);
    return 0;
  }
  if (white === 2) {
    if (black === 0) return y > 2 ? 2 + (y - 2) : 0;
    if (black === 1) return 4 + (y - 1);
    if (black === 2) return 7;
    return 0;
  }
  if (white === 3) {
    if (black === 0) return y > 1 ? 3 + (y - 1) : 0;
    if (black === 1) return 5 + (y - 1);
    return 0;
  }
  if (white === 4 && black === 0) return y > 1 ? 3 + (y - 1) : 0;
  return 0;
}

function mixedness(chess: Chess): number {
  let total = 0;
  for (let rankOffset = 0; rankOffset <= 6; rankOffset += 1) {
    for (let fileOffset = 0; fileOffset <= 6; fileOffset += 1) {
      let white = 0;
      let black = 0;
      for (let dy = 0; dy <= 1; dy += 1) {
        for (let dx = 0; dx <= 1; dx += 1) {
          const square = `${String.fromCharCode(97 + fileOffset + dx)}${rankOffset + dy + 1}` as Square;
          const piece = chess.get(square);
          if (piece?.color === "w") white += 1;
          if (piece?.color === "b") black += 1;
        }
      }
      total += mixednessScore(rankOffset + 1, white, black);
    }
  }
  return total;
}

/** Port of scalachess Divider over the positions immediately before each move. */
export function divideFens(fensBeforeMoves: string[]): GameDivision {
  let middlePly: number | undefined;
  let endPly: number | undefined;

  for (let index = 0; index < fensBeforeMoves.length; index += 1) {
    const fen = fensBeforeMoves[index];
    if (fen === undefined) continue;
    const board = new Chess(fen);
    if (middlePly === undefined) {
      if (majorsAndMinors(board) <= 10 || backrankSparse(board) || mixedness(board) > 150) {
        middlePly = index;
      }
    }
    if (middlePly !== undefined && endPly === undefined && majorsAndMinors(board) <= 6) {
      endPly = index;
    }
  }

  if (middlePly !== undefined && endPly !== undefined && middlePly >= endPly) {
    middlePly = undefined;
  }
  return {
    ...(middlePly === undefined ? {} : { middlePly }),
    ...(endPly === undefined ? {} : { endPly }),
    totalPlies: fensBeforeMoves.length,
  };
}

export function divideGame(game: NormalizedGame): GameDivision {
  return divideFens(game.plies.map((ply) => ply.fenBefore));
}

export function phaseForPly(ply: number, division: GameDivision): GamePhase {
  const boardIndex = Math.max(0, ply - 1);
  if (division.middlePly === undefined || boardIndex < division.middlePly) return "opening";
  if (division.endPly !== undefined && boardIndex >= division.endPly) return "endgame";
  return "middlegame";
}
