import type { RecurringWeakness } from "@chess-review/analysis";
import type { TrainingQueueItemV1, TrainingQueueStatus } from "@chess-review/shared";
import { openReviewDatabase, TRAINING_QUEUE_STORE } from "./browser-storage";

export function trainingQueueItemId(playerKey: string, weakness: RecurringWeakness["kind"]): string {
  return `${playerKey}\u0000${weakness}`;
}

export function createTrainingQueueItem(
  playerKey: string,
  weakness: RecurringWeakness,
  now = new Date().toISOString(),
): TrainingQueueItemV1 {
  return {
    version: 1,
    id: trainingQueueItemId(playerKey, weakness.kind),
    playerKey,
    weaknessKind: weakness.kind,
    status: "queued",
    priority: weakness.priority,
    evidence: weakness.evidence.slice(0, 5),
    createdAt: now,
    updatedAt: now,
  };
}

export function transitionTrainingQueueItem(
  item: TrainingQueueItemV1,
  status: TrainingQueueStatus,
  now = new Date().toISOString(),
): TrainingQueueItemV1 {
  const next = { ...item, status, updatedAt: now };
  if (status === "completed") return { ...next, completedAt: now };
  delete next.completedAt;
  return next;
}

export async function listTrainingQueue(playerKey?: string): Promise<TrainingQueueItemV1[]> {
  const database = await openReviewDatabase();
  try {
    const items = await new Promise<TrainingQueueItemV1[]>((resolve, reject) => {
      const request = database.transaction(TRAINING_QUEUE_STORE, "readonly").objectStore(TRAINING_QUEUE_STORE).getAll();
      request.onsuccess = () => resolve(request.result as TrainingQueueItemV1[]);
      request.onerror = () => reject(request.error ?? new Error("Unable to load the training queue."));
    });
    return items
      .filter((item) => item.version === 1 && (playerKey === undefined || item.playerKey === playerKey))
      .sort((left, right) => {
        const statusOrder: Record<TrainingQueueStatus, number> = { "in-progress": 0, queued: 1, completed: 2 };
        return statusOrder[left.status] - statusOrder[right.status]
          || right.priority - left.priority
          || right.updatedAt.localeCompare(left.updatedAt);
      });
  } finally {
    database.close();
  }
}

export async function saveTrainingQueueItem(item: TrainingQueueItemV1): Promise<void> {
  const database = await openReviewDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(TRAINING_QUEUE_STORE, "readwrite");
      transaction.objectStore(TRAINING_QUEUE_STORE).put(item, item.id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to save the training item."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Training item write was aborted."));
    });
  } finally {
    database.close();
  }
}

export async function removeTrainingQueueItem(id: string): Promise<void> {
  const database = await openReviewDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(TRAINING_QUEUE_STORE, "readwrite");
      transaction.objectStore(TRAINING_QUEUE_STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to remove the training item."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Training item removal was aborted."));
    });
  } finally {
    database.close();
  }
}
