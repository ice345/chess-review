/**
 * Opening Explorer contract.
 *
 * Position-frequency data answers a different question from opening recognition:
 * recognition says *what this opening is*, the explorer says *what is actually
 * played from here*. This module owns the shape and the normalization for the
 * public lichess.org explorer payloads and performs no network request itself, so
 * the same validated structure can be consumed by the Web app, the desktop shell
 * and the mobile companion, and only the Web server talks to lichess.org.
 *
 * Upstream reference: `https://explorer.lichess.ovh` (Lichess opening explorer),
 * documented at `https://lichess.org/api#tag/Opening-Explorer`.
 */

import { fenToEpd, normalizeFen } from "@chess-review/chess-core";

export type ExplorerSource = "lichess" | "masters";
export const EXPLORER_SOURCES: readonly ExplorerSource[] = ["lichess", "masters"];

export const EXPLORER_MAX_MOVES = 12;

export interface ExplorerMoveStat {
  uci: string;
  san: string;
  games: number;
  white: number;
  draws: number;
  black: number;
  /** Share of this move's games, as a percentage of the move's own total. */
  whitePercent: number;
  drawPercent: number;
  blackPercent: number;
}

export interface ExplorerPositionV1 {
  version: 1;
  /** Position identity (EPD), so the move counters cannot split one position in two. */
  fen: string;
  source: ExplorerSource;
  totalGames: number;
  white: number;
  draws: number;
  black: number;
  whitePercent: number;
  drawPercent: number;
  blackPercent: number;
  moves: ExplorerMoveStat[];
  opening?: { eco: string; name: string };
}

export function explorerCacheKey(fen: string, source: ExplorerSource): string {
  return `${source}\u0000${fen}`;
}

/** Position identity (EPD): move counters and halfmove clocks cannot change what is played. */
export function explorerPositionKey(fen: string): string {
  return fenToEpd(normalizeFen(fen));
}

function count(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  // Counts are integer game totals; a fractional or absurd upstream value is a
  // payload error, not something to round into a claim.
  if (!Number.isInteger(value) || value > Number.MAX_SAFE_INTEGER) return null;
  return value;
}

function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 10;
}

function normalizeMove(raw: unknown): ExplorerMoveStat | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const uci = value.uci;
  const san = value.san;
  if (typeof uci !== "string" || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  if (typeof san !== "string" || san.length === 0 || san.length > 12) return null;
  const white = count(value.white);
  const draws = count(value.draws);
  const black = count(value.black);
  if (white === null || draws === null || black === null) return null;
  const games = white + draws + black;
  return {
    uci,
    san,
    games,
    white,
    draws,
    black,
    whitePercent: percent(white, games),
    drawPercent: percent(draws, games),
    blackPercent: percent(black, games),
  };
}

/**
 * Validates and normalizes an upstream explorer payload.
 *
 * Returns null for anything that is not a complete, plausible payload: a partial
 * table would silently present missing games as zero games. The caller decides
 * how to communicate that.
 */
export function normalizeExplorerPosition(raw: unknown, fen: string, source: ExplorerSource): ExplorerPositionV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const white = count(value.white);
  const draws = count(value.draws);
  const black = count(value.black);
  if (white === null || draws === null || black === null) return null;
  if (!Array.isArray(value.moves) || value.moves.length > 64) return null;
  const moves: ExplorerMoveStat[] = [];
  for (const entry of value.moves) {
    const move = normalizeMove(entry);
    if (!move) return null;
    moves.push(move);
  }
  moves.sort((left, right) => right.games - left.games || left.uci.localeCompare(right.uci));
  const totalGames = white + draws + black;
  let named: { eco: string; name: string } | null = null;
  const opening = value.opening;
  if (opening && typeof opening === "object" && !Array.isArray(opening)) {
    const record = opening as Record<string, unknown>;
    const eco = record.eco, name = record.name;
    if (typeof eco === "string" && typeof name === "string") named = { eco, name };
  }
  return {
    version: 1,
    fen,
    source,
    totalGames,
    white,
    draws,
    black,
    whitePercent: percent(white, totalGames),
    drawPercent: percent(draws, totalGames),
    blackPercent: percent(black, totalGames),
    moves: moves.slice(0, EXPLORER_MAX_MOVES),
    ...(named ? { opening: named } : {}),
  };
}
