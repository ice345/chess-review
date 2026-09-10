import { openReviewDatabase, REVIEW_STORE, writeLocalData } from "./browser-storage";
import { hasReviewIdentity, readReviewIdentity } from "./review-identity";
import type { ReviewRecord } from "./review-library";

export interface LibraryIndexProgress { completed: number; total: number }

/** Upgrade old records without changing ordering or resurrecting removed data. */
export async function backfillReviewIdentities(records: ReviewRecord[], signal?: AbortSignal, onProgress?: (progress: LibraryIndexProgress) => void): Promise<void> {
  const total = records.filter((record) => record.kind === "pgn" && !hasReviewIdentity(record)).length;
  if (!total) return;
  let completed = 0;
  let lastProgress = performance.now();
  onProgress?.({ completed, total });
  let sliceStarted = performance.now();
  let pending: ReviewRecord[] = [];
  const flush = async () => {
    if (!pending.length) return;
    const db = await openReviewDatabase();
    try {
      await writeLocalData(db, REVIEW_STORE, (tx) => {
        const store = tx.objectStore(REVIEW_STORE);
        for (const record of pending) {
          const read = store.get(record.id);
          read.onsuccess = () => {
            const current = read.result as ReviewRecord | undefined;
            if (current?.kind === "pgn" && current.input === record.input) store.put({ ...current, identity: record.identity }, current.id);
          };
        }
      });
    } catch (error) {
      // This index is disposable. A full disk must not hide an otherwise
      // readable library; destructive epoch failures still propagate.
      if (!(error instanceof Error && error.name === "QuotaExceededError")) throw error;
    } finally { db.close(); }
    pending = [];
  };
  for (const record of records) {
    signal?.throwIfAborted();
    if (record.kind !== "pgn" || hasReviewIdentity(record)) continue;
    try { record.identity = readReviewIdentity(record); pending.push(record); }
    catch { /* Corrupt legacy PGN remains visibly invalid. */ }
    completed++;
    if (performance.now() - lastProgress >= 250) {
      onProgress?.({ completed, total }); lastProgress = performance.now();
    }
    if (performance.now() - sliceStarted >= 8) {
      await flush();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      sliceStarted = performance.now();
    }
  }
  await flush();
  onProgress?.({ completed, total });
}
