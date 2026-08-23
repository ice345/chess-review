import { Chess } from "chess.js";
import type { PlayerColor } from "@chess-review/shared";

export interface NormalizedPly {
  ply: number;
  moveNumber: number;
  color: PlayerColor;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  legalMoveCountBefore: number;
  isCapture: boolean;
  isCheck: boolean;
  isPromotion: boolean;
}

export interface NormalizedGame {
  headers: Record<string, string>;
  initialFen: string;
  finalFen: string;
  pgn: string;
  plies: NormalizedPly[];
}

export interface ReplayedUciMove {
  ply: number;
  uci: string;
  san: string;
  fenBefore: string;
  fenAfter: string;
}

export function parsePgn(pgn: string): NormalizedGame {
  const parsed = new Chess();
  parsed.loadPgn(pgn, { strict: false });

  const headers = parsed.getHeaders();
  const initialFen = headers.FEN ?? new Chess().fen();
  const replay = new Chess(initialFen);
  const plies: NormalizedPly[] = [];

  for (const san of parsed.history()) {
    const fenBefore = replay.fen();
    const legalMoveCountBefore = replay.moves().length;
    const move = replay.move(san);
    if (!move) throw new Error(`Unable to replay PGN move: ${san}`);

    plies.push({
      ply: plies.length + 1,
      moveNumber: Math.floor(plies.length / 2) + 1,
      color: move.color === "w" ? "white" : "black",
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion ?? ""}`,
      fenBefore,
      fenAfter: replay.fen(),
      legalMoveCountBefore,
      isCapture: move.isCapture(),
      isCheck: replay.inCheck(),
      isPromotion: move.isPromotion(),
    });
  }

  return {
    headers,
    initialFen,
    finalFen: replay.fen(),
    pgn,
    plies,
  };
}

export function normalizeFen(fen: string): string {
  return new Chess(fen).fen();
}

export function fenToEpd(fen: string): string {
  const normalized = normalizeFen(fen);
  return normalized.split(" ").slice(0, 4).join(" ");
}

/** Replay a deterministic engine line through the rules layer.
 *
 * Stockfish speaks UCI; presentation surfaces need legal SAN and a position
 * for every temporary variation step. Invalid engine data fails closed rather
 * than being displayed as a factual continuation.
 */
export function replayUciLine(fen: string, uciMoves: readonly string[]): ReplayedUciMove[] {
  const chess = new Chess(fen);
  return uciMoves.map((uci, index) => {
    const fenBefore = chess.fen();
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci.slice(4, 5) : undefined;
    let move;
    try {
      move = chess.move({ from, to, ...(promotion === undefined ? {} : { promotion }) });
    } catch {
      throw new Error(`Illegal UCI move at line ply ${index + 1}: ${uci}`);
    }
    if (!move) throw new Error(`Illegal UCI move at line ply ${index + 1}: ${uci}`);
    return {
      ply: index + 1,
      uci,
      san: move.san,
      fenBefore,
      fenAfter: chess.fen(),
    };
  });
}
