import type { EngineDiagnosticsSnapshot, GameReviewProgress } from "@chess-review/stockfish";
import { notifyLocalDataChanged, openReviewDatabase, REVIEW_RUN_STORE, REVIEW_STORE, writeLocalData } from "./browser-storage";

export interface ReviewRun {
  version: 1;
  reviewId: string;
  runId: string;
  status: "running" | "complete" | "cancelled" | "failed";
  depth: number;
  updatedAt: string;
  progress?: GameReviewProgress;
  hadCompletedResult?: boolean;
  /**
   * What the run's engine actually did, written once the run settles. A run that
   * stalls without engine traffic leaves this behind even if the tab is closed, which
   * is the evidence a progress counter cannot provide.
   */
  diagnostics?: EngineDiagnosticsSnapshot;
}
export const RUN_LEASE_MS = 45_000;

export async function listReviewRuns(): Promise<ReviewRun[]> {
  const db = await openReviewDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(REVIEW_RUN_STORE).objectStore(REVIEW_RUN_STORE).getAll();
      req.onsuccess = () => resolve(req.result as ReviewRun[]);
      req.onerror = () => reject(req.error ?? new Error("Unable to load analysis progress."));
    });
  } finally { db.close(); }
}

export async function saveReviewRun(run: ReviewRun, start = false): Promise<void> {
  const db = await openReviewDatabase();
  try {
    await writeLocalData(db, [REVIEW_RUN_STORE, REVIEW_STORE], (tx, fail) => {
      const record = tx.objectStore(REVIEW_STORE).get(run.reviewId);
      record.onsuccess = () => {
        if (!record.result) { fail(new Error("This review no longer exists.")); return; }
        const store = tx.objectStore(REVIEW_RUN_STORE);
        const previous = store.get(run.reviewId);
        previous.onsuccess = () => {
          const prior = previous.result as ReviewRun | undefined;
          if (!start && (prior?.runId !== run.runId || prior.status !== "running")) return;
          store.put({ ...run, hadCompletedResult: prior?.status === "complete" || prior?.hadCompletedResult === true, updatedAt: new Date().toISOString() }, run.reviewId);
        };
      };
    });
    notifyLocalDataChanged();
  } finally { db.close(); }
}

/**
 * Attaches the run's own evidence once it settled. Written after the run's status
 * write, so a stalled or failed run still carries the timeline that explains it.
 */
export async function recordReviewRunDiagnostics(reviewId: string, diagnostics: EngineDiagnosticsSnapshot): Promise<void> {
  const db = await openReviewDatabase();
  try {
    await writeLocalData(db, [REVIEW_RUN_STORE, REVIEW_STORE], (tx, fail) => {
      const record = tx.objectStore(REVIEW_STORE).get(reviewId);
      record.onsuccess = () => {
        if (!record.result) { fail(new Error("This review no longer exists.")); return; }
        const store = tx.objectStore(REVIEW_RUN_STORE);
        const previous = store.get(reviewId);
        previous.onsuccess = () => {
          const prior = previous.result as ReviewRun | undefined;
          if (!prior) return;
          store.put({ ...prior, diagnostics, updatedAt: new Date().toISOString() }, reviewId);
        };
      };
    });
    notifyLocalDataChanged();
  } finally { db.close(); }
}

/** A user actually opened a verified cached result. Preserve another live run. */
export async function recordRestoredAnalysis(reviewId: string, depth: number): Promise<void> {
  const db = await openReviewDatabase();
  try {
    await writeLocalData(db, [REVIEW_RUN_STORE, REVIEW_STORE], (tx, fail) => {
      const record = tx.objectStore(REVIEW_STORE).get(reviewId);
      record.onsuccess = () => {
        if (!record.result) { fail(new Error("This review no longer exists.")); return; }
        const store = tx.objectStore(REVIEW_RUN_STORE);
        const req = store.get(reviewId);
        req.onsuccess = () => {
          const current = req.result as ReviewRun | undefined;
          if (current?.status === "running" && Date.now() - Date.parse(current.updatedAt) < RUN_LEASE_MS) {
            store.put({ ...current, hadCompletedResult: true }, reviewId);
          } else {
            store.put({ version: 1, reviewId, runId: crypto.randomUUID(), status: "complete", depth, updatedAt: new Date().toISOString() } satisfies ReviewRun, reviewId);
          }
        };
      };
    });
    notifyLocalDataChanged();
  } finally { db.close(); }
}

/** Lease/progress describe work, never substitute for a completed cache. */
export async function withReviewRun<T>(
  reviewId: string,
  depth: number,
  work: (signal: AbortSignal, report: (progress: GameReviewProgress) => void) => Promise<T>,
  parentSignal?: AbortSignal,
  /**
   * The run's own evidence so far. Sampled on every write, so a run that is still
   * stuck — or a tab that is closed mid-run — leaves the timeline behind instead of
   * only the progress counter.
   */
  pendingDiagnostics?: () => EngineDiagnosticsSnapshot | undefined,
): Promise<T> {
  const controller = new AbortController();
  const signal = parentSignal ? AbortSignal.any([parentSignal, controller.signal]) : controller.signal;
  let run: ReviewRun = { version: 1, reviewId, depth, runId: crypto.randomUUID(), status: "running", updatedAt: new Date().toISOString() };
  await saveReviewRun(run, true);
  let storageFailure: unknown;
  const invalidate = () => controller.abort();
  if (typeof window !== "undefined") window.addEventListener("open-chess-review-invalidated", invalidate);
  const evidence = (): Partial<ReviewRun> => {
    const snapshot = pendingDiagnostics?.();
    return snapshot === undefined ? {} : { diagnostics: snapshot };
  };
  const heartbeat = setInterval(() => {
    void saveReviewRun({ ...run, ...evidence() }).catch((error) => { storageFailure = error; controller.abort(); });
  }, 5_000);
  try {
    signal.throwIfAborted();
    const result = await work(signal, (progress) => { run = { ...run, progress }; });
    if (storageFailure) throw storageFailure;
    signal.throwIfAborted();
    await saveReviewRun({ ...run, status: "complete", ...evidence() });
    return result;
  } catch (error) {
    await saveReviewRun({ ...run, status: signal.aborted && !storageFailure ? "cancelled" : "failed", ...evidence() }).catch(() => undefined);
    throw storageFailure ?? error;
  } finally {
    clearInterval(heartbeat);
    if (typeof window !== "undefined") window.removeEventListener("open-chess-review-invalidated", invalidate);
  }
}
