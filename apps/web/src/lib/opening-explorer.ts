"use client";

import {
  EXPLORER_DEFAULT_POPULATION,
  explorerCacheKey,
  explorerPopulationQuery,
  explorerPositionKey,
  type ExplorerPopulationV1,
  type ExplorerPositionV1,
  type ExplorerSource,
} from "@chess-review/openings";
import { loadCachedPosition, writeCachedPosition, type RemotePositionSource } from "./remote-position-cache";

/**
 * Opening Explorer client.
 *
 * A stale entry is only returned *labelled as stale*, together with when it was
 * fetched, so the panel can say how old the numbers are instead of presenting an
 * old census as current. The lookup is keyed by position identity (EPD) plus the
 * database and the population, so reaching the same position by a different move
 * order or counter cannot miss the cache or split it in two — and two different
 * populations can never be answered from one entry.
 *
 * A failure is typed, not just a message, so the panel can tell unreachable,
 * rate-limited and generic failures apart and offer its own retry. A failed or
 * stale lookup is only this panel's state: it never blocks Review.
 */

export const EXPLORER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type ExplorerFailureKind = "offline" | "rate-limited" | "failed" | "unconfigured";

/** A lookup that produced no answer, classified so the panel can say why. */
export class ExplorerRequestError extends Error {
  readonly kind: ExplorerFailureKind;

  constructor(kind: ExplorerFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ExplorerRequestError";
    this.kind = kind;
  }
}

export interface ExplorerResult {
  position: ExplorerPositionV1;
  fetchedAt: string;
  /** True when the fetch failed and an older cached answer is being shown. */
  stale: boolean;
}

function cacheSource(source: ExplorerSource): RemotePositionSource {
  return `explorer:${source}`;
}

interface ExplorerResponse { position?: unknown; error?: unknown; unconfigured?: unknown }

export async function loadExplorerPosition(
  fen: string,
  source: ExplorerSource,
  population: ExplorerPopulationV1 = EXPLORER_DEFAULT_POPULATION,
  signal?: AbortSignal,
  options: { forceRefresh?: boolean } = {},
): Promise<ExplorerResult> {
  const positionKey = explorerCacheKey(fen, source, population);
  const cached = await loadCachedPosition<ExplorerPositionV1>(cacheSource(source), positionKey).catch(() => null);
  // A superseded lookup is not an answer: the caller aborted it, and the panel
  // only ever renders the request that is still current.
  if (signal?.aborted) throw signal.reason;
  // An explicit retry re-issues the request even when a fresh answer is cached:
  // the visitor asked again, and a census changes over time.
  if (!options.forceRefresh && cached && Date.now() - Date.parse(cached.fetchedAt) < EXPLORER_CACHE_TTL_MS) {
    return { position: cached.position, fetchedAt: cached.fetchedAt, stale: false };
  }

  let response: Response;
  try {
    const query = explorerPopulationQuery(population);
    response = await fetch(`/api/explorer?fen=${encodeURIComponent(explorerPositionKey(fen))}&source=${source}&rating=${encodeURIComponent(query.rating)}&speeds=${encodeURIComponent(query.speeds)}`, signal ? { signal } : {});
  } catch (cause) {
    if (signal?.aborted) throw cause;
    if (cached) return { position: cached.position, fetchedAt: cached.fetchedAt, stale: true };
    throw new ExplorerRequestError(
      "offline",
      "The opening explorer could not be reached. Check your connection and try again.",
      { cause },
    );
  }
  if (signal?.aborted) throw signal.reason;
  const body = await response.json().catch(() => ({})) as ExplorerResponse;
  if (!response.ok) {
    if (cached) return { position: cached.position, fetchedAt: cached.fetchedAt, stale: true };
    const message = typeof body.error === "string" ? body.error : "The opening explorer request failed.";
    // An unconfigured deployment is its own state: it will not fix itself by waiting,
    // and it must not be reported as a rate limit or as "this position has no games".
    const kind: ExplorerFailureKind = body.unconfigured === true
      ? "unconfigured"
      : response.status === 429 ? "rate-limited" : "failed";
    throw new ExplorerRequestError(kind, message);
  }
  // The server already validated the payload; the client only checks that it is
  // the shape this build understands.
  const position = body.position as ExplorerPositionV1 | undefined;
  if (!position || position.version !== 1) {
    if (cached) return { position: cached.position, fetchedAt: cached.fetchedAt, stale: true };
    throw new ExplorerRequestError("failed", "The opening explorer returned an unusable response.");
  }
  const fetchedAt = await writeCachedPosition(cacheSource(source), positionKey, position);
  return { position, fetchedAt: fetchedAt ?? new Date().toISOString(), stale: false };
}
