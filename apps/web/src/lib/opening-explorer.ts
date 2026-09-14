"use client";

import { explorerPositionKey, type ExplorerPositionV1, type ExplorerSource } from "@chess-review/openings";
import { loadCachedPosition, writeCachedPosition, type RemotePositionSource } from "./remote-position-cache";

/**
 * Opening Explorer client.
 *
 * A stale entry is only returned *labelled as stale*, together with when it was
 * fetched, so the panel can say how old the numbers are instead of presenting an
 * old census as current. The lookup is keyed by position identity (EPD), so
 * reaching the same position by a different move order or counter cannot miss the
 * cache or split it in two.
 */

export const EXPLORER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface ExplorerResult {
  position: ExplorerPositionV1;
  fetchedAt: string;
  /** True when the fetch failed and an older cached answer is being shown. */
  stale: boolean;
}

function cacheSource(source: ExplorerSource): RemotePositionSource {
  return `explorer:${source}`;
}

interface ExplorerResponse { position?: unknown; error?: unknown }

export async function loadExplorerPosition(fen: string, source: ExplorerSource, signal?: AbortSignal): Promise<ExplorerResult> {
  const positionKey = explorerPositionKey(fen);
  const cached = await loadCachedPosition<ExplorerPositionV1>(cacheSource(source), positionKey).catch(() => null);
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < EXPLORER_CACHE_TTL_MS) {
    return { position: cached.position, fetchedAt: cached.fetchedAt, stale: false };
  }

  let response: Response;
  try {
    response = await fetch(`/api/explorer?fen=${encodeURIComponent(positionKey)}&source=${source}`, signal ? { signal } : {});
  } catch (cause) {
    if (signal?.aborted) throw cause;
    if (cached) return { position: cached.position, fetchedAt: cached.fetchedAt, stale: true };
    throw new Error("The opening explorer could not be reached. Check your connection and try again.", { cause });
  }
  const body = await response.json().catch(() => ({})) as ExplorerResponse;
  if (!response.ok) {
    if (cached) return { position: cached.position, fetchedAt: cached.fetchedAt, stale: true };
    throw new Error(typeof body.error === "string" ? body.error : "The opening explorer request failed.");
  }
  // The server already validated the payload; the client only checks that it is
  // the shape this build understands.
  const position = body.position as ExplorerPositionV1 | undefined;
  if (!position || position.version !== 1) {
    if (cached) return { position: cached.position, fetchedAt: cached.fetchedAt, stale: true };
    throw new Error("The opening explorer returned an unusable response.");
  }
  const fetchedAt = await writeCachedPosition(cacheSource(source), positionKey, position);
  return { position, fetchedAt: fetchedAt ?? new Date().toISOString(), stale: false };
}
