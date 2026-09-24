import type { TrainingQueueItemV3 } from "@chess-review/shared";
import { dueTrainingPositions } from "./training-mastery";

/**
 * Practice chapter binding (Batch C / atmosphere-practice §C).
 *
 * MOVEMENT labels and the five score-desk steps are derived only from real
 * player/session events: import → observe → attempt → save → revisit.
 * Decorative Roman numerals and fake-full progress are out of scope.
 */

export type PracticeMovement = "I" | "II" | "III";
export type PracticeMovementTitle = "BEGIN" | "OBSERVE" | "RETURN";

export type PracticeChapterStepId = "import" | "observe" | "attempt" | "save" | "revisit";

/** Honest empty / ready kinds for the Today sheet (atmosphere-practice §C). */
export type PracticeEmptyKind =
  | "loading"
  | "read-failure"
  | "no-import"
  | "no-analysis"
  | "mistakes-without-weakness"
  | "no-due-tasks"
  | "ready";

export interface PracticeChapterStep {
  id: PracticeChapterStepId;
  label: string;
  done: boolean;
}

export interface PracticeChapterInput {
  /** Games this player has imported (synced and/or reviewed), including unanalyzed. */
  importedGameCount: number;
  /** Games with objective analysis in this player's study library. */
  analyzedGameCount: number;
  /** Single-game mistakes from the study report (practiceable without recurrence). */
  mistakeCount: number;
  /** Recurring weaknesses with enough multi-game evidence. */
  weaknessCount: number;
  queue: readonly TrainingQueueItemV3[];
  /** True when today's actionable task exists (due or unreviewed work). */
  hasTodayTask: boolean;
  queueState: "loading" | "ready" | "failed";
  sourcesFailed: boolean;
  now?: Date;
}

export interface PracticeChapterProgress {
  movement: PracticeMovement;
  title: PracticeMovementTitle;
  /** `MOVEMENT N ——— TITLE` for the instrument head. */
  kicker: string;
  lede: string;
  nudgeHref?: string;
  nudgeLabel?: string;
  steps: PracticeChapterStep[];
  /** Quiet mark beside the head when saved or revisit records exist. */
  hasRevisitMark: boolean;
  emptyKind: PracticeEmptyKind;
}

const STEP_LABELS: Record<PracticeChapterStepId, string> = {
  import: "Import",
  observe: "Observe",
  attempt: "Attempt",
  save: "Save",
  revisit: "Revisit",
};

function hasPracticeAttempt(queue: readonly TrainingQueueItemV3[]): boolean {
  return queue.some((item) =>
    item.progress.reviewedPositionCount > 0
    || item.progress.positions.some((position) => (position.attempts ?? 0) > 0 || Boolean(position.reviewedAt)));
}

function hasSavedTask(queue: readonly TrainingQueueItemV3[]): boolean {
  return queue.length > 0;
}

function hasRevisitRecord(queue: readonly TrainingQueueItemV3[], now: Date): boolean {
  return queue.some((item) => {
    if (dueTrainingPositions(item, now).length > 0) return true;
    return item.progress.positions.some((position) =>
      position.mastery === "mastered"
      || position.mastery === "review"
      || (position.attempts ?? 0) > 1
      || Boolean(position.dueAt));
  });
}

function isPracticeable(input: PracticeChapterInput): boolean {
  return input.mistakeCount > 0
    || input.weaknessCount > 0
    || input.hasTodayTask
    || input.queue.some((item) => item.evidence.length > 0);
}

function emptyKindFor(input: PracticeChapterInput): PracticeEmptyKind {
  if (input.sourcesFailed || input.queueState === "failed") return "read-failure";
  if (input.queueState === "loading") return "loading";
  if (input.importedGameCount <= 0) return "no-import";
  if (input.analyzedGameCount <= 0) return "no-analysis";
  if (input.hasTodayTask) return "ready";
  if (input.mistakeCount > 0 && input.weaknessCount <= 0 && input.queue.length === 0) {
    return "mistakes-without-weakness";
  }
  return "no-due-tasks";
}

/**
 * Bind the Practice instrument head and score-desk steps to real chapter state
 * for the selected player. Switching players re-runs this on that player's data.
 */
export function practiceChapterProgress(input: PracticeChapterInput): PracticeChapterProgress {
  const now = input.now ?? new Date();
  const imported = input.importedGameCount > 0;
  const observed = input.analyzedGameCount > 0;
  const attempted = hasPracticeAttempt(input.queue);
  const saved = hasSavedTask(input.queue);
  const revisited = hasRevisitRecord(input.queue, now);
  const practiceable = isPracticeable(input);

  let movement: PracticeMovement = "I";
  let title: PracticeMovementTitle = "BEGIN";
  let lede = "Bring a game to your desk.";
  let nudgeHref: string | undefined = "/import";
  let nudgeLabel: string | undefined = "Import a game →";

  if (imported && (!observed || !practiceable)) {
    movement = "II";
    title = "OBSERVE";
    lede = observed
      ? "Observe a decision in Review before practice can begin."
      : "Imported games are waiting to be observed.";
    nudgeHref = observed ? "/review" : "/history";
    nudgeLabel = observed ? "Open Review →" : "Review / analyse →";
  } else if (imported) {
    movement = "III";
    title = "RETURN";
    lede = "Return to the decision you missed.";
    nudgeHref = undefined;
    nudgeLabel = undefined;
  }

  const steps: PracticeChapterStep[] = (["import", "observe", "attempt", "save", "revisit"] as const).map((id) => ({
    id,
    label: STEP_LABELS[id],
    done: id === "import" ? imported
      : id === "observe" ? observed
        : id === "attempt" ? attempted
          : id === "save" ? saved
            : revisited,
  }));

  return {
    movement,
    title,
    kicker: `MOVEMENT ${movement} ——— ${title}`,
    lede,
    ...(nudgeHref && nudgeLabel ? { nudgeHref, nudgeLabel } : {}),
    steps,
    hasRevisitMark: saved || revisited,
    emptyKind: emptyKindFor(input),
  };
}
