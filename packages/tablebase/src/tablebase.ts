import { fenToEpd, fenPieceCount, normalizeFen } from "@chess-review/chess-core";

/**
 * Seven-piece tablebase contract.
 *
 * The tablebase answers a question the engine cannot prove: is this position a
 * theoretical win, draw or loss, and how far is the conversion. It is *evidence*,
 * not an opinion — so this module never derives a result from an engine score.
 * A position outside the covered piece count has no answer here, and the UI must
 * say "not covered" rather than translate `+8.2` into "winning".
 *
 * Upstream reference: the standard Syzygy tables served by
 * `https://tablebase.lichess.ovh/standard`, documented at
 * `https://lichess.org/api#tag/Tablebase`.
 */

/** Highest piece count in the standard (7-piece) Syzygy tables. */
export const TABLEBASE_MAX_PIECES = 7;

/**
 * Outcome categories, kept exactly as the tablebase reports them.
 *
 * Collapsing `cursed-win` into `win` would be a chess claim the tables do not
 * make: it is a win that the fifty-move rule can still ruin.
 */
export type TablebaseCategory = "win" | "maybe-win" | "cursed-win" | "draw" | "blessed-loss" | "maybe-loss" | "loss" | "unknown";

export const TABLEBASE_CATEGORIES: readonly TablebaseCategory[] = ["win", "maybe-win", "cursed-win", "draw", "blessed-loss", "maybe-loss", "loss", "unknown"];

export interface TablebaseMove {
  uci: string;
  san: string;
  category: TablebaseCategory;
  /** Distance to zeroing (a capture, pawn move or mate that resets the counter). */
  dtz?: number;
  /** Distance to mate, when the tables carry it. */
  dtm?: number;
  zeroing: boolean;
  /** True when this move reaches a position that is not itself in the tables. */
  conversion: boolean;
}

export interface TablebasePositionV1 {
  version: 1;
  /** Position identity (EPD). */
  fen: string;
  source: "lichess";
  tables: "syzygy-7";
  pieceCount: number;
  category: TablebaseCategory;
  dtz?: number;
  dtm?: number;
  checkmate: boolean;
  stalemate: boolean;
  moves: TablebaseMove[];
}

/** True when the standard tables cover this position at all. */
export function tablebaseCovers(fen: string): boolean {
  try {
    return fenPieceCount(fen) <= TABLEBASE_MAX_PIECES;
  } catch {
    return false;
  }
}

export function tablebasePieceCount(fen: string): number | null {
  try {
    return fenPieceCount(fen);
  } catch {
    return null;
  }
}

/** Position identity for a query and its cache key: the counters cannot change the result. */
export function tablebasePositionKey(fen: string): string {
  return fenToEpd(normalizeFen(fen));
}

function category(value: unknown): TablebaseCategory | null {
  return typeof value === "string" && (TABLEBASE_CATEGORIES as readonly string[]).includes(value) ? value as TablebaseCategory : null;
}

function distance(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Number.isInteger(value) ? value : undefined;
}

function normalizeMove(raw: unknown): TablebaseMove | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const uci = value.uci, san = value.san;
  if (typeof uci !== "string" || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  if (typeof san !== "string" || san.length === 0 || san.length > 12) return null;
  const moveCategory = category(value.category);
  if (!moveCategory) return null;
  if (typeof value.zeroing !== "boolean" || typeof value.conversion !== "boolean") return null;
  const dtz = distance(value.dtz), dtm = distance(value.dtm);
  return {
    uci,
    san,
    category: moveCategory,
    zeroing: value.zeroing,
    conversion: value.conversion,
    ...(dtz === undefined ? {} : { dtz }),
    ...(dtm === undefined ? {} : { dtm }),
  };
}

/**
 * Validates and normalizes an upstream tablebase payload.
 *
 * Returns null for anything incomplete: a partial move list would hide legal
 * moves that the tables do carry, which is worse than reporting no answer.
 */
export function normalizeTablebasePosition(raw: unknown, fen: string): TablebasePositionV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const positionCategory = category(value.category);
  if (!positionCategory) return null;
  if (typeof value.checkmate !== "boolean" || typeof value.stalemate !== "boolean") return null;
  if (!Array.isArray(value.moves) || value.moves.length > 128) return null;
  const moves: TablebaseMove[] = [];
  for (const entry of value.moves) {
    const move = normalizeMove(entry);
    if (!move) return null;
    moves.push(move);
  }
  const dtz = distance(value.dtz), dtm = distance(value.dtm);
  const pieceCount = tablebasePieceCount(fen);
  if (pieceCount === null) return null;
  return {
    version: 1,
    fen,
    source: "lichess",
    tables: "syzygy-7",
    pieceCount,
    category: positionCategory,
    checkmate: value.checkmate,
    stalemate: value.stalemate,
    moves,
    ...(dtz === undefined ? {} : { dtz }),
    ...(dtm === undefined ? {} : { dtm }),
  };
}
