import { Chess, type PieceSymbol, type Square } from "chess.js";
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

export interface LegalBoardMove {
  from: string;
  to: string;
  promotion?: PieceSymbol;
}

export interface LegalBoardDestination {
  from: string;
  to: string;
  san: string;
  isCapture: boolean;
  promotion?: PieceSymbol;
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

/** Apply one user/engine board move through chess.js and return canonical SAN/FEN.
 *
 * Promotion defaults to a queen only when a pawn actually reaches the back
 * rank. Callers can explicitly request an underpromotion.
 */
export function playLegalBoardMove(fen: string, input: LegalBoardMove): ReplayedUciMove {
  const chess = new Chess(fen);
  const from = input.from as Square;
  const to = input.to as Square;
  const piece = chess.get(from);
  const promotes = piece?.type === "p" && (to[1] === "1" || to[1] === "8");
  let move;
  try {
    move = chess.move({
      from,
      to,
      ...(promotes ? { promotion: input.promotion ?? "q" } : {}),
    });
  } catch {
    throw new Error(`Illegal board move: ${input.from}${input.to}${input.promotion ?? ""}`);
  }
  if (!move) throw new Error(`Illegal board move: ${input.from}${input.to}${input.promotion ?? ""}`);
  return {
    ply: 1,
    uci: `${move.from}${move.to}${move.promotion ?? ""}`,
    san: move.san,
    fenBefore: fen,
    fenAfter: chess.fen(),
  };
}

/** List every legal destination for one board piece.
 *
 * This is presentation-safe rules data for click-to-move hints. It does not
 * evaluate or rank moves, and therefore cannot affect Stockfish move quality.
 */
export function legalBoardDestinations(fen: string, from: string): LegalBoardDestination[] {
  const chess = new Chess(fen);
  const square = from as Square;
  if (!chess.get(square)) return [];
  return chess.moves({ square, verbose: true }).map((move) => ({
    from: move.from,
    to: move.to,
    san: move.san,
    isCapture: move.isCapture(),
    ...(move.promotion === undefined ? {} : { promotion: move.promotion }),
  }));
}
