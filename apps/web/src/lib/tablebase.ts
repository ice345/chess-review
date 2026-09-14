"use client";

import type { TablebasePositionV1 } from "@chess-review/tablebase";
import { loadCachedPosition, writeCachedPosition } from "./remote-position-cache";
import { tablebasePositionKey, tablebasePieceCount, TABLEBASE_MAX_PIECES } from "@chess-review/tablebase";

/**
 * Tablebase client.
 *
 * The piece-count rule is checked before any request: a position outside the
 * tables has no theoretical answer, and asking would only produce a failure the
 * visitor has to interpret.
 */

export const TABLEBASE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type TablebaseLookup =
  | { status: "uncovered"; pieceCount: number }
  | { status: "invalid" };

export interface TablebaseResult {
  position: TablebasePositionV1;
  fetchedAt: string;
  stale: boolean;
}

export function tablebaseCoverage(fen: string): TablebaseLookup | null {
  const pieceCount = tablebasePieceCount(fen);
  if (pieceCount === null) return { status: "invalid" };
  return pieceCount > TABLEBASE_MAX_PIECES ? { status: "uncovered", pieceCount } : null;
}

interface TablebaseResponse { position?: unknown; error?: unknown }

export async function loadTablebasePosition(fen: string, signal?: AbortSignal): Promise<TablebaseResult> {
  const key = tablebasePositionKey(fen);
  const cached = await loadCachedPosition<TablebasePositionV1>("tablebase", key).catch(() => null);
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < TABLEBASE_CACHE_TTL_MS) {
    return { position: cached.position, fetchedAt: cached.fetchedAt, stale: false };
  }

  let response: Response;
  try {
    response = await fetch(`/api/tablebase?fen=${encodeURIComponent(key)}`, signal ? { signal } : {});
  } catch (cause) {
    if (signal?.aborted) throw cause;
    if (cached) return { position: cached.position, fetchedAt: cached.fetchedAt, stale: true };
    throw new Error("The tablebase could not be reached. Check your connection and try again.", { cause });
  }
  const body = await response.json().catch(() => ({})) as TablebaseResponse;
  if (!response.ok) {
    // An uncovered position is a legitimate answer, and it is never cached.
    if (cached) return { position: cached.position, fetchedAt: cached.fetchedAt, stale: true };
    throw new Error(typeof body.error === "string" ? body.error : "The tablebase request failed.");
  }
  const position = body.position as TablebasePositionV1 | undefined;
  if (!position || position.version !== 1) {
    if (cached) return { position: cached.position, fetchedAt: cached.fetchedAt, stale: true };
    throw new Error("The tablebase returned an unusable response.");
  }
  const fetchedAt = await writeCachedPosition("tablebase", position.fen, position);
  return { position, fetchedAt: fetchedAt ?? new Date().toISOString(), stale: false };
}
