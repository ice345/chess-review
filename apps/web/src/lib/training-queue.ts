import { dueTrainingPositions, masteryTransition } from "./training-mastery";
import type { RecurringWeakness } from "@chess-review/analysis";
import { parsePgn } from "@chess-review/chess-core";
import type { StudyWeaknessKind, TrainingAttemptOutcome, TrainingEvidenceReference, TrainingQueueItem, TrainingQueueItemV3, TrainingQueueStatus } from "@chess-review/shared";
import { notifyLocalDataChanged, openReviewDatabase, REVIEW_STORE, TRAINING_QUEUE_STORE, writeLocalData } from "./browser-storage";
import type { ReviewRecord } from "./review-library";

export function trainingQueueItemId(playerKey: string, weakness: RecurringWeakness["kind"]): string {
  return `${playerKey}\u0000${weakness}`;
}

export function trainingPositionKey(source: Pick<TrainingEvidenceReference, "gameId" | "ply">): string {
  return `${source.gameId}:${source.ply}`;
}

export interface TrainingGameContribution {
  /** Queue items whose evidence includes this game. */
  tasks: number;
  /** Distinct positions this game contributed, counted once across every item. */
  positions: number;
}

/** A task holds at most this many positions; the offer shows exactly what fits. */
export const MAX_TASK_EVIDENCE = 5;

export interface TrainingAddition {
  kind: StudyWeaknessKind;
  taskId: string;
  /** The task as the write will leave it: the stored item, or the new one to create. */
  item: TrainingQueueItemV3;
  /** Evidence the write will store: this game's positions that the task does not hold yet. */
  add: TrainingEvidenceReference[];
  /** This game's positions the task (or the learner's other tasks) already hold. */
  alreadyPresent: number;
  /** Positions this game has that do not fit the task's cap. */
  deferred: number;
}

function createItem(playerKey: string, weakness: RecurringWeakness, now: string): TrainingQueueItemV3 {
  return normalizeTrainingItem({
    version: 3, id: trainingQueueItemId(playerKey, weakness.kind), playerKey,
    weaknessKind: weakness.kind, status: "queued", priority: weakness.priority,
    evidence: [],
    sourceReportVersion: "advanced-study-v2",
    progress: { positions: [], reviewedPositionCount: 0, totalPositionCount: 0 },
    createdAt: now, updatedAt: now,
  });
}

/**
 * What adding one game's positions would change, computed before anything is
 * written so the offer and the result can state the same numbers.
 *
 * Only this game's positions are counted, a position already held by any of the
 * learner's tasks is not added twice, and the task's evidence cap is applied here
 * rather than being discovered after the write.
 */
export function planTrainingAddition(
  items: readonly TrainingQueueItemV3[],
  playerKey: string,
  weaknesses: readonly RecurringWeakness[],
  now = new Date().toISOString(),
): TrainingAddition[] {
  const known = new Set<string>();
  for (const item of items) {
    if (item.playerKey !== playerKey) continue;
    for (const reference of item.evidence) known.add(trainingPositionKey(reference));
  }
  return weaknesses.flatMap((weakness) => {
    const taskId = trainingQueueItemId(playerKey, weakness.kind);
    const existing = items.find((item) => item.id === taskId) ?? null;
    const held = new Set(existing?.evidence.map(trainingPositionKey) ?? []);
    const candidates = weakness.evidence;
    const alreadyPresent = candidates.filter((reference) => known.has(trainingPositionKey(reference)) || held.has(trainingPositionKey(reference))).length;
    const room = Math.max(0, MAX_TASK_EVIDENCE - held.size);
    // A position already held by any of the learner's tasks is present, not new:
    // re-adding it would move progress backwards or double-count it.
    const missing = candidates.filter((reference) => {
      const key = trainingPositionKey(reference);
      return !known.has(key) && !held.has(key);
    });
    const add = missing.slice(0, room);
    return [{
      kind: weakness.kind,
      taskId,
      item: existing ?? createItem(playerKey, weakness, now),
      add,
      alreadyPresent,
      deferred: missing.length - add.length,
    }];
  });
}

export interface TrainingAdditionResult {
  tasks: number;
  added: number;
  alreadyPresent: number;
}

/** Stores a planned addition in one transaction. Idempotent: re-running adds nothing. */
export async function applyTrainingAddition(playerKey: string, additions: readonly TrainingAddition[]): Promise<TrainingAdditionResult> {
  const pending = additions.filter((addition) => addition.add.length > 0);
  const alreadyPresent = additions.reduce((total, addition) => total + addition.alreadyPresent, 0);
  if (pending.length === 0) return { tasks: 0, added: 0, alreadyPresent };

  const database = await openReviewDatabase();
  try {
    await writeLocalData(database, TRAINING_QUEUE_STORE, (transaction, fail) => {
      const store = transaction.objectStore(TRAINING_QUEUE_STORE);
      for (const addition of pending) {
        const read = store.get(addition.taskId);
        // Read-modify-write inside the transaction: another tab may have reviewed
        // a position or added the same game since the offer was planned, and the
        // write must merge into that record rather than restore this snapshot.
        read.onsuccess = () => {
          try {
            const current = normalizeTrainingItem((read.result ?? addition.item) as TrainingQueueItem);
            const held = new Set(current.evidence.map(trainingPositionKey));
            const merged = [...current.evidence, ...addition.add.filter((reference) => !held.has(trainingPositionKey(reference)))];
            const now = new Date().toISOString();
            const { completionKind: _completionKind, completedAt: _completedAt, ...open } = current;
            // New unreviewed positions mean the task is open again, even if the
            // earlier evidence had been reviewed through.
            const next = normalizeTrainingItem({
              ...(current.status === "completed" ? open : current),
              evidence: merged,
              status: current.status === "completed" ? "in-progress" : current.status,
              updatedAt: now,
            });
            store.put(next, next.id);
          } catch (error) { fail(error instanceof Error ? error : new Error("Unable to save these positions.")); }
        };
      }
    });
    notifyLocalDataChanged();
    return { tasks: pending.length, added: pending.reduce((total, addition) => total + addition.add.length, 0), alreadyPresent };
  } finally { database.close(); }
}

/**
 * How much one game contributed to Training.
 *
 * The end-of-review copy used to print the number of queue *items* as if it were
 * the number of positions: one task that holds three of this game's positions
 * read as "1 position", and a task mixing several games counted once per item.
 */
export function trainingGameContribution(items: readonly TrainingQueueItemV3[], gameId: string): TrainingGameContribution {
  const positions = new Set<string>();
  let tasks = 0;
  for (const item of items) {
    const own = item.evidence.filter((reference) => reference.gameId === gameId);
    if (own.length === 0) continue;
    tasks += 1;
    for (const reference of own) positions.add(trainingPositionKey(reference));
  }
  return { tasks, positions: positions.size };
}

/** Old aggregate/manual counts cannot identify which positions were reviewed. */
export function normalizeTrainingItem(item: TrainingQueueItem): TrainingQueueItemV3 {
  const evidence = [...new Map(item.evidence.map((source) => [trainingPositionKey(source), source])).values()];
  const keys = new Set(evidence.map(trainingPositionKey));
  const positions = item.version === 3
    ? [...new Map(item.progress.positions.filter((source) => keys.has(trainingPositionKey(source))).map((source) => [trainingPositionKey(source), source])).values()]
    : [];
  const manual = item.status === "completed" && (item.version !== 3 || item.completionKind === "manual");
  // A task is finished when its positions are *known*, not when they have been looked
  // at: reviewing every position once with the evidence on screen used to end the task
  // and its schedule with it, so the ladder could never run. A position comes round
  // again on its due date until it is mastered.
  const mastered = new Set(positions.filter((position) => position.mastery === "mastered").map(trainingPositionKey));
  const complete = evidence.length > 0 && evidence.every((source) => mastered.has(trainingPositionKey(source)));
  const next: TrainingQueueItemV3 = {
    ...item, version: 3, sourceReportVersion: "advanced-study-v2", evidence,
    status: manual || complete ? "completed" : item.status === "completed" ? "in-progress" : item.status,
    progress: {
      ...(item.version === 1 ? {} : item.progress), positions,
      reviewedPositionCount: positions.length, totalPositionCount: evidence.length,
    },
  };
  if (manual || complete) {
    next.completionKind = manual ? "manual" : "mastered";
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
    evidence: weakness.evidence.slice(0, MAX_TASK_EVIDENCE), sourceReportVersion: "advanced-study-v2",
    progress: { positions: [], reviewedPositionCount: 0, totalPositionCount: Math.min(MAX_TASK_EVIDENCE, weakness.evidence.length) },
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

/**
 * The task Training should offer today: one with positions that have come round again
 * first, then the task already in progress, then the highest-priority open one. The
 * queue arrives sorted by that same order, so a task is not skipped because it was
 * merely started after another one came due.
 *
 * Completed tasks are never offered; a completed task is a mastered one.
 */
export function todaysTrainingTask(items: readonly TrainingQueueItemV3[], now = new Date()): TrainingQueueItemV3 | undefined {
  const dueFirst = items
    .filter((item) => item.status !== "completed" && dueTrainingPositions(item, now).length > 0)
    .sort((left, right) => right.priority - left.priority || right.updatedAt.localeCompare(left.updatedAt))[0];
  if (dueFirst) return dueFirst;
  return items.find((item) => item.status === "in-progress") ?? items.find((item) => item.status === "queued");
}

/**
 * The position worth reviewing now: the one that has been waiting longest, then the
 * first that has never been reviewed, and nothing at all when every position is
 * reviewed and none is due — so the panel can say when to come back instead of
 * quietly offering work that is not due.
 */
export function nextTrainingPosition(item: TrainingQueueItemV3, now = new Date()): TrainingEvidenceReference | undefined {
  const due = dueTrainingPositions(item, now)[0];
  if (due) return item.evidence.find((source) => trainingPositionKey(source) === trainingPositionKey(due));
  const reviewed = new Set(item.progress.positions.map(trainingPositionKey));
  return item.evidence.find((source) => !reviewed.has(trainingPositionKey(source)));
}

/** Evidence identifies the played move; the decision board is one ply earlier. */
export function decisionReviewHref(source: Pick<TrainingEvidenceReference, "gameId" | "ply">): string {
  return `/review/${encodeURIComponent(source.gameId)}/moves?ply=${Math.max(0, source.ply - 1)}&decision=${source.ply}`;
}

export function trainingReviewHref(item: TrainingQueueItemV3, source = nextTrainingPosition(item) ?? item.evidence[0]): string {
  if (!source) return "/training";
  const query = new URLSearchParams({ training: item.id, position: trainingPositionKey(source), ply: String(Math.max(0, source.ply - 1)) });
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
async function updateTask(
  id: string,
  action: "start" | "review",
  key?: string,
  outcome: TrainingAttemptOutcome = "legacy",
): Promise<TrainingQueueItemV3> {
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
              if (action === "review" && key !== undefined) {
                // A review records what the visitor did with the position, which is what
                // the schedule is built from. Reviewing the same position again is the
                // whole point of the ladder, so it advances the existing record rather
                // than being ignored; the same history always schedules the same day,
                // because there is no hidden ease factor to drift.
                const index = item.progress.positions.findIndex((position) => trainingPositionKey(position) === key);
                const transition = masteryTransition(index === -1 ? undefined : item.progress.positions[index], outcome, new Date(now));
                const record = { gameId: source.gameId, ply: source.ply, reviewedAt: now, outcome, ...transition };
                if (index === -1) item.progress.positions.push(record);
                else item.progress.positions[index] = record;
                item.progress.lastReviewedAt = now;
              }
              item.status = "in-progress"; delete item.completionKind; delete item.completedAt;
              saved = normalizeTrainingItem({ ...item, updatedAt: now });
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
/**
 * Records one review of a source position with what it was worth.
 *
 * The outcome is required rather than defaulted: a review that does not say whether
 * the move was produced unaided cannot promote mastery, and the caller is the only
 * place that knows. `"exposed"` is the honest recording of the panel's plain confirm
 * action, where the evidence is on screen.
 */
export function reviewTrainingPosition(
  id: string,
  source: Pick<TrainingEvidenceReference, "gameId" | "ply">,
  outcome: TrainingAttemptOutcome,
): Promise<TrainingQueueItemV3> {
  return updateTask(id, "review", trainingPositionKey(source), outcome);
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
