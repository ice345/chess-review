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

/** Rating floors the players database can be restricted to. */
export const EXPLORER_RATING_FLOORS = [1200, 1600, 2000, 2200] as const;
export type ExplorerRatingFloor = (typeof EXPLORER_RATING_FLOORS)[number];

/** Every rating bucket the upstream players database counts. */
export const EXPLORER_RATING_BUCKETS = [1200, 1400, 1600, 1800, 2000, 2200, 2500] as const;

export const EXPLORER_SPEEDS = ["ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence"] as const;
export type ExplorerSpeed = (typeof EXPLORER_SPEEDS)[number];

/**
 * Which games a player-database answer counts.
 *
 * The explorer is third-party census data, so its population is part of the claim:
 * "blitz and rapid among 1600+" and "every speed at every rating" are different
 * numbers about different games, and neither may be labelled as the other.
 */
export interface ExplorerPopulationV1 {
  /** Lowest rating bucket included; null includes every rating. */
  ratingFloor: ExplorerRatingFloor | null;
  /** Speeds included; an empty list includes every speed. */
  speeds: ExplorerSpeed[];
}

/** Club-strength blitz, rapid and classical: the population this panel starts on. */
export const EXPLORER_DEFAULT_POPULATION: ExplorerPopulationV1 = {
  ratingFloor: 1600,
  speeds: ["blitz", "rapid", "classical"],
};

/** The buckets at or above the floor, which is how the upstream request counts ratings. */
export function explorerRatingBuckets(ratingFloor: ExplorerRatingFloor | null): number[] {
  if (ratingFloor === null) return [];
  return EXPLORER_RATING_BUCKETS.filter((bucket) => bucket >= ratingFloor);
}

/**
 * Order-insensitive identity for one population. Two requests that describe the
 * same games must not occupy two cache entries, and two different populations must
 * never share one.
 */
export function explorerPopulationKey(population: ExplorerPopulationV1): string {
  const rating = population.ratingFloor === null ? "all-ratings" : `${population.ratingFloor}+`;
  const speeds = [...population.speeds].sort();
  return `${rating}|${speeds.length === 0 ? "all-speeds" : speeds.join(",")}`;
}

/** How the numbers name their own population, e.g. "rated 1600+ · blitz, rapid, classical". */
export function explorerPopulationLabel(population: ExplorerPopulationV1): string {
  const rating = population.ratingFloor === null ? "all ratings" : `rated ${population.ratingFloor}+`;
  const speeds = population.speeds.length === 0 ? "all speeds" : population.speeds.join(", ");
  return `${rating} · ${speeds}`;
}

/** Query values for one population, so the client and the route agree on the encoding. */
export function explorerPopulationQuery(population: ExplorerPopulationV1): { rating: string; speeds: string } {
  return {
    rating: population.ratingFloor === null ? "all" : String(population.ratingFloor),
    speeds: population.speeds.length === 0 ? "all" : population.speeds.join(","),
  };
}

/**
 * Reads a population from query values. Returns null when a value is not part of the
 * contract, so the caller rejects the request instead of silently answering about a
 * population nobody asked for.
 */
export function parseExplorerPopulation(rating: string | null, speeds: string | null): ExplorerPopulationV1 | null {
  let ratingFloor: ExplorerRatingFloor | null = null;
  if (rating !== null && rating !== "all" && rating !== "") {
    const value = Number(rating);
    if (!(EXPLORER_RATING_FLOORS as readonly number[]).includes(value)) return null;
    ratingFloor = value as ExplorerRatingFloor;
  }
  let parsedSpeeds: ExplorerSpeed[] = [];
  if (speeds !== null && speeds !== "all" && speeds !== "") {
    const requested = speeds.split(",").map((value) => value.trim()).filter((value) => value !== "");
    if (requested.length === 0) return null;
    const unique = new Set<string>();
    for (const value of requested) {
      if (!(EXPLORER_SPEEDS as readonly string[]).includes(value)) return null;
      unique.add(value);
    }
    parsedSpeeds = [...unique] as ExplorerSpeed[];
  }
  return { ratingFloor, speeds: parsedSpeeds };
}

/** Cache identity: database, population and position. Never one of the three alone. */
export function explorerCacheKey(fen: string, source: ExplorerSource, population: ExplorerPopulationV1 = EXPLORER_DEFAULT_POPULATION): string {
  return `${source}\u0000${explorerPopulationKey(population)}\u0000${fen}`;
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
