import type { RecurringWeakness } from "@chess-review/analysis";
import { parsePgn } from "@chess-review/chess-core";
import type { TrainingEvidenceReference, TrainingQueueItem, TrainingQueueItemV3, TrainingQueueStatus } from "@chess-review/shared";
import { notifyLocalDataChanged, openReviewDatabase, REVIEW_STORE, TRAINING_QUEUE_STORE, writeLocalData } from "./browser-storage";
import type { ReviewRecord } from "./review-library";

export function trainingQueueItemId(playerKey: string, weakness: RecurringWeakness["kind"]): string {
  return `${playerKey}\u0000${weakness}`;
}

export function trainingPositionKey(source: Pick<TrainingEvidenceReference, "gameId" | "ply">): string {
  return `${source.gameId}:${source.ply}`;
}

/** Old aggregate/manual counts cannot identify which positions were reviewed. */
export function normalizeTrainingItem(item: TrainingQueueItem): TrainingQueueItemV3 {
  const evidence = [...new Map(item.evidence.map((source) => [trainingPositionKey(source), source])).values()];
  const keys = new Set(evidence.map(trainingPositionKey));
  const positions = item.version === 3
    ? [...new Map(item.progress.positions.filter((source) => keys.has(trainingPositionKey(source))).map((source) => [trainingPositionKey(source), source])).values()]
    : [];
  const manual = item.status === "completed" && (item.version !== 3 || item.completionKind === "manual");
  const complete = evidence.length > 0 && positions.length === evidence.length;
  const next: TrainingQueueItemV3 = {
    ...item, version: 3, sourceReportVersion: "advanced-study-v2", evidence,
    status: manual || complete ? "completed" : item.status === "completed" ? "in-progress" : item.status,
    progress: {
      ...(item.version === 1 ? {} : item.progress), positions,
      reviewedPositionCount: positions.length, totalPositionCount: evidence.length,
    },
  };
  if (manual || complete) {
    next.completionKind = manual ? "manual" : "reviewed";
    if (complete && !next.completedAt) next.completedAt = positions.map((position) => position.reviewedAt).sort().at(-1)!;
  }
  else { delete next.completedAt; delete next.completionKind; }
  if (positions.length) next.progress.lastReviewedAt = positions.map((position) => position.reviewedAt).sort().at(-1)!;
  else delete next.progress.lastReviewedAt;
  return next;
}

export function createTrainingQueueItem(playerKey: string, weakness: RecurringWeakness, now = new Date().toISOString()): TrainingQueueItemV3 {
  return normalizeTrainingItem({
    version: 3, id: trainingQueueItemId(playerKey, weakness.kind), playerKey,
    weaknessKind: weakness.kind, status: "queued", priority: weakness.priority,
    evidence: weakness.evidence.slice(0, 5), sourceReportVersion: "advanced-study-v2",
    progress: { positions: [], reviewedPositionCount: 0, totalPositionCount: Math.min(5, weakness.evidence.length) },
    createdAt: now, updatedAt: now,
  });
}

/** Retained for explicit manual state changes/legacy callers; never fills position progress. */
export function transitionTrainingQueueItem(item: TrainingQueueItem, status: TrainingQueueStatus, now = new Date().toISOString()): TrainingQueueItemV3 {
  const next = { ...normalizeTrainingItem(item), status, updatedAt: now };
  if (status === "completed") return { ...next, completionKind: "manual", completedAt: now };
  delete next.completedAt; delete next.completionKind;
  return next;
}

export function nextTrainingPosition(item: TrainingQueueItemV3): TrainingEvidenceReference | undefined {
  const reviewed = new Set(item.progress.positions.map(trainingPositionKey));
  return item.evidence.find((source) => !reviewed.has(trainingPositionKey(source)));
}

export function trainingReviewHref(item: TrainingQueueItemV3, source = nextTrainingPosition(item) ?? item.evidence[0]): string {
  if (!source) return "/training";
  const query = new URLSearchParams({ training: item.id, position: trainingPositionKey(source), ply: String(source.ply) });
  return `/review/${encodeURIComponent(source.gameId)}/moves?${query}`;
}

export function validateTrainingSource(record: ReviewRecord | undefined, source: TrainingEvidenceReference): void {
  if (!record || record.kind !== "pgn") throw new Error("This task's source game is missing. Restore its backup or remove the task.");
  const move = parsePgn(record.input).plies[source.ply - 1];
  if (!move || move.san !== source.san) throw new Error("This task no longer matches its source position. Remove it and add a new task from your report.");
}

export async function listTrainingQueue(playerKey?: string): Promise<TrainingQueueItemV3[]> {
  const database = await openReviewDatabase();
  try {
    const items = await new Promise<TrainingQueueItem[]>((resolve, reject) => {
      const request = database.transaction(TRAINING_QUEUE_STORE).objectStore(TRAINING_QUEUE_STORE).getAll();
      request.onsuccess = () => resolve(request.result as TrainingQueueItem[]);
      request.onerror = () => reject(request.error ?? new Error("Unable to load the training queue."));
    });
    const order: Record<TrainingQueueStatus, number> = { "in-progress": 0, queued: 1, completed: 2 };
    return items.filter((item) => [1, 2, 3].includes(item.version) && (playerKey === undefined || item.playerKey === playerKey))
      .map(normalizeTrainingItem)
      .sort((left, right) => order[left.status] - order[right.status] || right.priority - left.priority || right.updatedAt.localeCompare(left.updatedAt));
  } finally { database.close(); }
}

/** Read-modify-write in one transaction so two tabs cannot erase each other's acknowledgements. */
async function updateTask(id: string, action: "start" | "review", key?: string): Promise<TrainingQueueItemV3> {
  const db = await openReviewDatabase();
  let saved: TrainingQueueItemV3 | undefined;
  try {
    await writeLocalData(db, [TRAINING_QUEUE_STORE, REVIEW_STORE], (tx, fail) => {
      const store = tx.objectStore(TRAINING_QUEUE_STORE);
      const read = store.get(id);
      read.onsuccess = () => {
        try {
          if (!read.result) throw new Error("This training task no longer exists.");
          const item = normalizeTrainingItem(read.result as TrainingQueueItem);
          const source = action === "start" ? nextTrainingPosition(item) ?? item.evidence[0] : item.evidence.find((source) => trainingPositionKey(source) === key);
          if (!source) throw new Error("This task has no matching source position.");
          const game = tx.objectStore(REVIEW_STORE).get(source.gameId);
          game.onsuccess = () => {
            try {
              validateTrainingSource(game.result as ReviewRecord | undefined, source);
              const now = new Date().toISOString();
              if (action === "review" && !item.progress.positions.some((position) => trainingPositionKey(position) === key)) {
                item.progress.positions.push({ gameId: source.gameId, ply: source.ply, reviewedAt: now });
                item.progress.lastReviewedAt = now;
              }
              item.status = "in-progress"; delete item.completionKind; delete item.completedAt;
              saved = normalizeTrainingItem({ ...item, updatedAt: now });
              if (saved.status === "completed") saved.completedAt = item.progress.lastReviewedAt ?? now;
              store.put(saved, id);
            } catch (error) { fail(error instanceof Error ? error : new Error("Unable to save training progress.")); }
          };
        } catch (error) { fail(error instanceof Error ? error : new Error("Unable to open this training task.")); }
      };
    });
    notifyLocalDataChanged();
    return saved!;
  } finally { db.close(); }
}

export function startTrainingTask(id: string): Promise<TrainingQueueItemV3> { return updateTask(id, "start"); }
export function reviewTrainingPosition(id: string, source: Pick<TrainingEvidenceReference, "gameId" | "ply">): Promise<TrainingQueueItemV3> {
  return updateTask(id, "review", trainingPositionKey(source));
}

export async function saveTrainingQueueItem(item: TrainingQueueItem, options: { ifAbsent?: boolean } = {}): Promise<void> {
  const database = await openReviewDatabase();
  try {
    await writeLocalData(database, TRAINING_QUEUE_STORE, (transaction) => {
      const store = transaction.objectStore(TRAINING_QUEUE_STORE);
      if (!options.ifAbsent) store.put(item, item.id);
      else {
        const prior = store.get(item.id);
        prior.onsuccess = () => { if (!prior.result) store.put(item, item.id); };
      }
    });
    notifyLocalDataChanged();
  } finally { database.close(); }
}

export async function removeTrainingQueueItem(id: string): Promise<void> {
  const database = await openReviewDatabase();
  try {
    await writeLocalData(database, TRAINING_QUEUE_STORE, (transaction) => transaction.objectStore(TRAINING_QUEUE_STORE).delete(id));
    notifyLocalDataChanged();
  } finally { database.close(); }
}
