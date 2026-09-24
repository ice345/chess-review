"use client";

import Link from "next/link";
import { masterySummary } from "../lib/training-mastery";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RecurringWeakness } from "@chess-review/analysis";
import type { TrainingQueueItemV3 } from "@chess-review/shared";
import type { PracticeEmptyKind } from "../lib/practice-chapter";
import { nextTrainingPosition, startTrainingTask, trainingReviewHref } from "../lib/training-queue";
import { TRAINING_TITLES } from "./training-queue-panel";

type PlanItem = { weaknessKind: RecurringWeakness["kind"]; rationale: string };

/**
 * What to train now, before the report.
 *
 * Training used to open with statistics and leave the actionable task to a list
 * below them. This states one task, why it was chosen, how far it has been
 * worked through, and one button that opens it. The report stays below as
 * evidence for the choice, not as the entry point.
 */
export function TrainingToday({
  state,
  task,
  plan,
  topWeakness,
  focusedFromLink,
  onAddFocus,
  onRetry,
  disabled,
  lastReviewHref,
  emptyKind = "no-due-tasks",
  mistakeCount = 0,
}: {
  /** What the page knows: the queue is still being read, unreadable, or read. */
  state: "loading" | "ready" | "failed";
  /** `todaysTrainingTask(queue)`: the in-progress task, else the top open one. */
  task: TrainingQueueItemV3 | undefined;
  plan: readonly PlanItem[];
  /** The highest-priority recorded weakness, for the empty-queue case. */
  topWeakness: RecurringWeakness | undefined;
  /** True when ?task= named this task, so the page can say where it came from. */
  focusedFromLink: boolean;
  onAddFocus: (weakness: RecurringWeakness) => void;
  /** Re-read the data this block needs; the queue panel cannot clear this state. */
  onRetry: () => void;
  disabled: boolean;
  /**
   * Link into an already-analyzed review only. Never invent a ply continue for
   * an unanalyzed game (atmosphere-practice §C / Batch C).
   */
  lastReviewHref?: string;
  /** Honest empty kind from practiceChapterProgress. */
  emptyKind?: PracticeEmptyKind;
  /** Single-game mistakes available when recurring weakness is not. */
  mistakeCount?: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const rationale = task
    ? plan.find((item) => item.weaknessKind === task.weaknessKind)?.rationale
    : topWeakness ? plan.find((item) => item.weaknessKind === topWeakness.kind)?.rationale : undefined;

  async function start(id: string) {
    setError(null);
    try {
      router.push(trainingReviewHref(await startTrainingTask(id)));
    } catch (cause) {
      // Nothing else on the page can report this one: the queue panel only
      // reports its own rows, so a failed start says so here and stays retryable.
      setError(cause instanceof Error ? cause.message : "Unable to open this task. Try again.");
    }
  }

  if (state === "loading") {
    return (
      <section className="training-today" aria-label="Today's training" aria-busy="true">
        <header>
          <span className="eyebrow">Today</span>
          <h2>Checking today's task…</h2>
        </header>
      </section>
    );
  }

  if (state === "failed") {
    // Data that could not be read is not an empty set (see the roadmap's
    // local-data rule): say so instead of offering work that may not exist. The
    // failure can come from the training data or from the queue that holds the
    // tasks, so the note names neither as the cause — the page's own notice
    // carries the message the reader actually got.
    return (
      <section className="training-today" aria-label="Today's training">
        <header>
          <span className="eyebrow">Today</span>
          <h2>Today's task could not be read</h2>
        </header>
        <p className="training-today-note">
          The training data did not load. The message on this page says why.
        </p>
        <button type="button" className="secondary" onClick={onRetry}>Try again</button>
      </section>
    );
  }

  if (!task) {
    if (emptyKind === "no-import") {
      return (
        <section className="training-today" aria-label="Today's training">
          <header>
            <span className="eyebrow">Today</span>
            <h2>Nothing imported yet</h2>
          </header>
          <p className="training-today-note">
            Import a game to begin this chapter. Practice returns to decisions from your own games.
          </p>
          <Link className="primary-link" href="/import">Import a game →</Link>
        </section>
      );
    }
    if (emptyKind === "no-analysis") {
      return (
        <section className="training-today" aria-label="Today's training">
          <header>
            <span className="eyebrow">Today</span>
            <h2>Games are waiting to be observed</h2>
          </header>
          <p className="training-today-note">
            Imported games need objective analysis before practice can open a decision. Unanalyzed
            games do not offer a ply to continue.
          </p>
          <Link className="primary-link" href="/history">Open library / analyse →</Link>
        </section>
      );
    }
    if (emptyKind === "mistakes-without-weakness") {
      return (
        <section className="training-today" aria-label="Today's training">
          <header>
            <span className="eyebrow">Today</span>
            <h2>Single-game mistakes are ready</h2>
          </header>
          <p className="training-today-note">
            There {mistakeCount === 1 ? "is 1 recorded mistake" : `are ${mistakeCount} recorded mistakes`} in
            this population. Recurring-weakness conclusions need more games, but one game's mistakes are still practiceable in Review.
          </p>
          {lastReviewHref
            ? <Link className="primary-link" href={lastReviewHref}>Open last analyzed review →</Link>
            : <Link className="primary-link" href="/review">Choose a game →</Link>}
        </section>
      );
    }
    return (
      <section className="training-today" aria-label="Today's training">
        <header>
          <span className="eyebrow">Today</span>
          <h2>{topWeakness ? TRAINING_TITLES[topWeakness.kind] : "No due tasks today"}</h2>
        </header>
        {topWeakness ? (
          <>
            {rationale && <p>{rationale}</p>}
            <p className="training-today-note">
              No task is queued for this population. Adding this focus creates one from the positions
              that were recorded for it.
            </p>
            <button type="button" className="primary" disabled={disabled} onClick={() => onAddFocus(topWeakness)}>
              Add this focus to training
            </button>
          </>
        ) : (
          <p className="training-today-note">
            Nothing is due now. Analyse more games if you want a recurring focus, or revisit a saved
            task when its schedule says so.
            {lastReviewHref ? <>{" "}<Link href={lastReviewHref}>Open last analyzed review →</Link></> : null}
          </p>
        )}
      </section>
    );
  }

  const mastery = masterySummary(task, new Date());
  // What is actionable now, before what the schedule says: a task with positions that
  // have never been reviewed is worked on today, whatever the next recorded due date is.
  const work = mastery.due > 0 ? ` · ${mastery.due} due now`
    : mastery.unreviewed > 0 ? ` · ${mastery.unreviewed} not yet reviewed`
      : mastery.nextDueAt === undefined ? "" : ` · next due ${new Date(mastery.nextDueAt).toLocaleDateString()}`;
  // The position the start button will actually open: the one that has been waiting
  // longest, then the first never reviewed. A second hand-rolled rule here is how the
  // label and the button can disagree.
  const next = nextTrainingPosition(task);
  const positions = task.evidence.map((source) => source.san);
  return (
    <section className="training-today" aria-label="Today's training">
      <header>
        <span className="eyebrow">Today</span>
        <h2>{TRAINING_TITLES[task.weaknessKind]}</h2>
      </header>
      {focusedFromLink && <p className="training-today-note">This is the task you came from.</p>}
      {rationale && <p>{rationale}</p>}
      <p className="training-today-progress">
        <strong>{task.progress.reviewedPositionCount} / {task.progress.totalPositionCount}</strong> positions reviewed{work} · {" "}
        {task.status === "in-progress" ? "in progress" : "not started"}
      </p>
      {next && (
        <p className="training-today-next">
          Next position: <Link href={trainingReviewHref(task, next)}>{next.san}</Link>
        </p>
      )}
      <p className="training-today-facts">{positions.join(" · ")}</p>
      <button type="button" className="primary" disabled={disabled || !next} onClick={() => void start(task.id)}>
        {!next ? "No positions due now" : task.status === "in-progress" ? "Continue today's review" : "Start today's review"}
      </button>
      {error !== null && <p className="training-today-error" role="alert">{error}</p>}
      <p className="training-today-note">Reviewed means looked at, not mastered. The next due date tells you when to return.</p>
    </section>
  );
}
