import type { TrainingAttemptOutcome, TrainingMasteryState, TrainingPositionReview, TrainingQueueItemV3 } from "@chess-review/shared";

/**
 * Mastery for one training position.
 *
 * The queue used to record only that a position had been *looked at*, and the product
 * says so in its own copy ("Reviewed means looked at, not mastered"). That is honest
 * but it cannot schedule anything: a position reviewed once with the answer on screen
 * and a position recalled unaided are not the same state, and only the second is
 * evidence of knowing the move.
 *
 * So a review now carries what it was worth, and mastery advances on that:
 *
 * - `unaided` — the visitor produced the move before the evidence was shown.
 * - `hinted` — they got there with help. A lapse: the streak resets.
 * - `exposed` — the answer was on screen. A review, never evidence of recall.
 * - `legacy` — recorded before outcomes existed. Kept, and never counted as mastery.
 *
 * Only a review the schedule is waiting for counts. Reviewing a position again before it
 * comes round is recorded (the attempt count rises) but changes nothing else, because
 * recalling a move minutes after seeing it is not evidence of knowing it. Without that
 * rule three clicks in one sitting would earn mastery, and the ladder would mean nothing.
 *
 * The schedule is a fixed ladder in days (1, 3, 7, 21) driven by the streak, with no
 * randomness and no hidden ease factor: the same history always produces the same due
 * date, and the panel can say why.
 */

export const MASTERY_INTERVAL_DAYS = [1, 3, 7, 21] as const;
/** Consecutive unaided reviews a position needs before it is called mastered. */
export const MASTERED_STREAK = 3;

export interface MasteryTransition {
  mastery: TrainingMasteryState;
  streak: number;
  attempts: number;
  dueAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAfter(now: Date, days: number): string {
  return new Date(now.getTime() + days * DAY_MS).toISOString();
}

/** The ladder position for a streak of consecutive unaided reviews. */
export function masteryIntervalDays(streak: number): number {
  const index = Math.min(Math.max(streak, 1), MASTERY_INTERVAL_DAYS.length) - 1;
  return MASTERY_INTERVAL_DAYS[index]!;
}

/**
 * The next state of one position. Deterministic in `(current, outcome, now)`: the same
 * history and the same moment always produce the same record.
 */
export function masteryTransition(
  current: Pick<TrainingPositionReview, "mastery" | "streak" | "attempts" | "dueAt"> | undefined,
  outcome: TrainingAttemptOutcome,
  now: Date,
): MasteryTransition {
  const attempts = (current?.attempts ?? 0) + 1;
  // Not due yet: the attempt is recorded, the schedule is untouched.
  if (current?.dueAt !== undefined && Date.parse(current.dueAt) > now.getTime()) {
    return { mastery: current.mastery ?? "learning", streak: current.streak ?? 0, attempts, dueAt: current.dueAt };
  }
  if (outcome === "legacy") {
    // No claim about recall, and no claim about knowing it later either.
    return { mastery: current?.mastery ?? "learning", streak: current?.streak ?? 0, attempts, dueAt: daysAfter(now, 1) };
  }
  if (outcome !== "unaided") {
    // A lapse: the position goes back to learning and comes round tomorrow.
    return { mastery: "learning", streak: 0, attempts, dueAt: daysAfter(now, 1) };
  }
  const streak = (current?.streak ?? 0) + 1;
  const mastery: TrainingMasteryState = streak >= MASTERED_STREAK ? "mastered" : "review";
  return { mastery, streak, attempts, dueAt: daysAfter(now, masteryIntervalDays(streak)) };
}

/** When a recorded review is next worth doing. Records without a schedule are due. */
export function reviewDueAt(review: TrainingPositionReview): number {
  if (review.dueAt === undefined) return Date.parse(review.reviewedAt);
  const parsed = Date.parse(review.dueAt);
  return Number.isFinite(parsed) ? parsed : Date.parse(review.reviewedAt);
}

/** Positions whose recorded review is due at `now`, oldest due first. */
export function dueTrainingPositions(item: TrainingQueueItemV3, now: Date): TrainingPositionReview[] {
  return item.progress.positions
    .filter((review) => reviewDueAt(review) <= now.getTime())
    .sort((left, right) => reviewDueAt(left) - reviewDueAt(right));
}

export interface TrainingMasterySummary {
  reviewed: number;
  /** Source positions that have never been reviewed: work that is ready now. */
  unreviewed: number;
  mastered: number;
  /** Positions due now. */
  due: number;
  /** The earliest due date still ahead, when nothing is due yet. */
  nextDueAt?: string;
}

export function masterySummary(item: TrainingQueueItemV3, now: Date): TrainingMasterySummary {
  const positions = item.progress.positions;
  const due = dueTrainingPositions(item, now);
  const ahead = positions
    .filter((review) => reviewDueAt(review) > now.getTime())
    .map((review) => review.dueAt ?? review.reviewedAt)
    .sort();
  return {
    reviewed: positions.length,
    // A position that has never been reviewed is invisible to the schedule, so it has to
    // be counted from the task's evidence rather than from the recorded reviews.
    unreviewed: Math.max(item.evidence.length - positions.length, 0),
    mastered: positions.filter((review) => review.mastery === "mastered").length,
    due: due.length,
    ...(due.length === 0 && ahead.length > 0 ? { nextDueAt: ahead[0]! } : {}),
  };
}
