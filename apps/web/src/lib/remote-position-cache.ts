"use client";

import { openReviewDatabase, REMOTE_POSITIONS_STORE, writeLocalData } from "./browser-storage";

/**
 * Cache for third-party position lookups (Opening Explorer, tablebase).
 *
 * Both features ask a remote service about one position and get an answer that
 * ages: the shape differs, the caching rules do not. One store and one
 * stale-labelling rule keeps them honest together — a cached answer older than its
 * lifetime is only ever returned when the refresh fails, and it is then labelled
 * with its age instead of being presented as current.
 */

export type RemotePositionSource = "explorer:lichess" | "explorer:masters" | "tablebase";

export interface RemotePositionEntry<T> {
  key: string;
  source: RemotePositionSource;
  fen: string;
  fetchedAt: string;
  position: T;
}

export function remotePositionKey(source: RemotePositionSource, fen: string): string {
  return `${source}\u0000${fen}`;
}

export async function loadCachedPosition<T>(source: RemotePositionSource, fen: string): Promise<RemotePositionEntry<T> | null> {
  const key = remotePositionKey(source, fen);
  const db = await openReviewDatabase();
  try {
    return await new Promise<RemotePositionEntry<T> | null>((resolve, reject) => {
      const request = db.transaction(REMOTE_POSITIONS_STORE).objectStore(REMOTE_POSITIONS_STORE).get(key);
      request.onsuccess = () => resolve((request.result as RemotePositionEntry<T> | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Unable to read the cached position."));
    });
  } finally { db.close(); }
}

/** Returns the stored fetch time, or null when the cache could not be written. */
export async function writeCachedPosition<T>(source: RemotePositionSource, fen: string, position: T): Promise<string | null> {
  const fetchedAt = new Date().toISOString();
  const entry: RemotePositionEntry<T> = { key: remotePositionKey(source, fen), source, fen, fetchedAt, position };
  const db = await openReviewDatabase();
  try {
    await writeLocalData(db, REMOTE_POSITIONS_STORE, (transaction) => {
      // The store uses out-of-line keys, so the key is passed explicitly and
      // cannot be inferred from the value.
      transaction.objectStore(REMOTE_POSITIONS_STORE).put(entry, entry.key);
    });
    return fetchedAt;
  } catch {
    // The cache is an optimisation: a storage failure must not fail a lookup.
    return null;
  } finally { db.close(); }
}
