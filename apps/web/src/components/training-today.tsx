"use client";

import Link from "next/link";
import { masterySummary } from "../lib/training-mastery";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RecurringWeakness } from "@chess-review/analysis";
import type { TrainingQueueItemV3, UiLanguage } from "@chess-review/shared";
import type { PracticeEmptyKind } from "../lib/practice-chapter";
import { useUiLanguage } from "../hooks/use-ui-language";
import { nextTrainingPosition, startTrainingTask, trainingReviewHref } from "../lib/training-queue";
import { trainingTitle } from "./training-queue-panel";

type PlanItem = { weaknessKind: RecurringWeakness["kind"]; rationale: string };

type TodayCopy = {
  openError: string;
  ariaLabel: string;
  today: string;
  checking: string;
  couldNotRead: string;
  loadFailed: string;
  tryAgain: string;
  nothingImported: string;
  importToBegin: string;
  importGame: string;
  waitingObserved: string;
  needAnalysis: string;
  openLibrary: string;
  mistakesReady: string;
  mistakesNote: (n: number) => string;
  openLastReview: string;
  chooseGame: string;
  noDueTasks: string;
  noTaskQueued: string;
  addFocus: string;
  nothingDue: string;
  fromLink: string;
  positionsReviewedTail: (work: string) => string;
  dueNow: (n: number) => string;
  notYetReviewed: (n: number) => string;
  nextDue: (date: string) => string;
  inProgress: string;
  notStarted: string;
  nextPosition: string;
  noPositionsDue: string;
  continueToday: string;
  startToday: string;
  reviewedNote: string;
};

const COPY: Record<UiLanguage, TodayCopy> = {
  en: {
    openError: "Unable to open this task. Try again.",
    ariaLabel: "Today's training",
    today: "Today",
    checking: "Checking today's task…",
    couldNotRead: "Today's task could not be read",
    loadFailed: "The training data did not load. The message on this page says why.",
    tryAgain: "Try again",
    nothingImported: "Nothing imported yet",
    importToBegin: "Import a game to begin this chapter. Practice returns to decisions from your own games.",
    importGame: "Import a game →",
    waitingObserved: "Games are waiting to be observed",
    needAnalysis: "Imported games need objective analysis before practice can open a decision. Unanalyzed games do not offer a ply to continue.",
    openLibrary: "Open library / analyse →",
    mistakesReady: "Single-game mistakes are ready",
    mistakesNote: (n) => `There ${n === 1 ? "is 1 recorded mistake" : `are ${n} recorded mistakes`} in this population. Recurring-weakness conclusions need more games, but one game's mistakes are still practiceable in Review.`,
    openLastReview: "Open last analyzed review →",
    chooseGame: "Choose a game →",
    noDueTasks: "No due tasks today",
    noTaskQueued: "No task is queued for this population. Adding this focus creates one from the positions that were recorded for it.",
    addFocus: "Add this focus to training",
    nothingDue: "Nothing is due now. Analyse more games if you want a recurring focus, or revisit a saved task when its schedule says so.",
    fromLink: "This is the task you came from.",
    positionsReviewedTail: (work) => ` positions reviewed${work} · `,
    dueNow: (n) => ` · ${n} due now`,
    notYetReviewed: (n) => ` · ${n} not yet reviewed`,
    nextDue: (date) => ` · next due ${date}`,
    inProgress: "in progress",
    notStarted: "not started",
    nextPosition: "Next position:",
    noPositionsDue: "No positions due now",
    continueToday: "Continue today's review",
    startToday: "Start today's review",
    reviewedNote: "Reviewed means looked at, not mastered. The next due date tells you when to return.",
  },
  "zh-CN": {
    openError: "无法打开此任务。请重试。",
    ariaLabel: "今日训练",
    today: "今日",
    checking: "正在查看今日任务…",
    couldNotRead: "无法读取今日任务",
    loadFailed: "训练数据未能加载。本页上的说明会告诉你原因。",
    tryAgain: "重试",
    nothingImported: "尚未导入对局",
    importToBegin: "导入一盘对局以开始本章。训练会回到你自己对局中的决定。",
    importGame: "导入对局 →",
    waitingObserved: "对局正等待被观察",
    needAnalysis: "已导入的对局需要先完成客观分析，训练才能打开一个决定。未分析的对局没有可继续的半回合。",
    openLibrary: "打开棋库 / 分析 →",
    mistakesReady: "单局失误已经可以练习",
    mistakesNote: (n) => `此范围内记录了 ${n} 次失误。要得出反复弱点的结论还需要更多对局，但单局失误仍可在复盘中练习。`,
    openLastReview: "打开最近分析的复盘 →",
    chooseGame: "选择一盘对局 →",
    noDueTasks: "今日没有到期任务",
    noTaskQueued: "此范围还没有排队的任务。加入这一重点，会用已记录的局面创建一个任务。",
    addFocus: "将此重点加入训练",
    nothingDue: "现在没有到期内容。若想形成反复重点，请再分析一些对局；或在日程提示时回来看已保存的任务。",
    fromLink: "这是你刚进入的任务。",
    positionsReviewedTail: (work) => ` 个局面已复习${work} · `,
    dueNow: (n) => ` · ${n} 个到期`,
    notYetReviewed: (n) => ` · ${n} 个尚未复习`,
    nextDue: (date) => ` · 下次到期 ${date}`,
    inProgress: "进行中",
    notStarted: "未开始",
    nextPosition: "下一局面：",
    noPositionsDue: "现在没有到期局面",
    continueToday: "继续今日复盘",
    startToday: "开始今日复盘",
    reviewedNote: "已复习只表示看过，并不等于掌握。下次到期日会告诉你何时回来。",
  },
};

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
  const language = useUiLanguage();
  const copy = COPY[language];
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const rationale = task
    ? plan.find((item) => item.weaknessKind === task.weaknessKind)?.rationale
    : topWeakness ? plan.find((item) => item.weaknessKind === topWeakness.kind)?.rationale : undefined;

  async function start(id: string) {
    setError(null);
    try {
      router.push(trainingReviewHref(await startTrainingTask(id, language)));
    } catch (cause) {
      // Nothing else on the page can report this one: the queue panel only
      // reports its own rows, so a failed start says so here and stays retryable.
      setError(cause instanceof Error ? cause.message : copy.openError);
    }
  }

  if (state === "loading") {
    return (
      <section className="training-today" aria-label={copy.ariaLabel} aria-busy="true">
        <header>
          <span className="eyebrow">{copy.today}</span>
          <h2>{copy.checking}</h2>
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
      <section className="training-today" aria-label={copy.ariaLabel}>
        <header>
          <span className="eyebrow">{copy.today}</span>
          <h2>{copy.couldNotRead}</h2>
        </header>
        <p className="training-today-note">
          {copy.loadFailed}
        </p>
        <button type="button" className="secondary" onClick={onRetry}>{copy.tryAgain}</button>
      </section>
    );
  }

  if (!task) {
    if (emptyKind === "no-import") {
      return (
        <section className="training-today" aria-label={copy.ariaLabel}>
          <header>
            <span className="eyebrow">{copy.today}</span>
            <h2>{copy.nothingImported}</h2>
          </header>
          <p className="training-today-note">
            {copy.importToBegin}
          </p>
          <Link className="primary-link" href="/import">{copy.importGame}</Link>
        </section>
      );
    }
    if (emptyKind === "no-analysis") {
      return (
        <section className="training-today" aria-label={copy.ariaLabel}>
          <header>
            <span className="eyebrow">{copy.today}</span>
            <h2>{copy.waitingObserved}</h2>
          </header>
          <p className="training-today-note">
            {copy.needAnalysis}
          </p>
          <Link className="primary-link" href="/history">{copy.openLibrary}</Link>
        </section>
      );
    }
    if (emptyKind === "mistakes-without-weakness") {
      return (
        <section className="training-today" aria-label={copy.ariaLabel}>
          <header>
            <span className="eyebrow">{copy.today}</span>
            <h2>{copy.mistakesReady}</h2>
          </header>
          <p className="training-today-note">
            {copy.mistakesNote(mistakeCount)}
          </p>
          {lastReviewHref
            ? <Link className="primary-link" href={lastReviewHref}>{copy.openLastReview}</Link>
            : <Link className="primary-link" href="/review">{copy.chooseGame}</Link>}
        </section>
      );
    }
    return (
      <section className="training-today" aria-label={copy.ariaLabel}>
        <header>
          <span className="eyebrow">{copy.today}</span>
          <h2>{topWeakness ? trainingTitle(topWeakness.kind, language) : copy.noDueTasks}</h2>
        </header>
        {topWeakness ? (
          <>
            {rationale && <p>{rationale}</p>}
            <p className="training-today-note">
              {copy.noTaskQueued}
            </p>
            <button type="button" className="primary" disabled={disabled} onClick={() => onAddFocus(topWeakness)}>
              {copy.addFocus}
            </button>
          </>
        ) : (
          <p className="training-today-note">
            {copy.nothingDue}
            {lastReviewHref ? <>{" "}<Link href={lastReviewHref}>{copy.openLastReview}</Link></> : null}
          </p>
        )}
      </section>
    );
  }

  const mastery = masterySummary(task, new Date());
  // What is actionable now, before what the schedule says: a task with positions that
  // have never been reviewed is worked on today, whatever the next recorded due date is.
  const work = mastery.due > 0 ? copy.dueNow(mastery.due)
    : mastery.unreviewed > 0 ? copy.notYetReviewed(mastery.unreviewed)
      : mastery.nextDueAt === undefined ? "" : copy.nextDue(new Date(mastery.nextDueAt).toLocaleDateString());
  // The position the start button will actually open: the one that has been waiting
  // longest, then the first never reviewed. A second hand-rolled rule here is how the
  // label and the button can disagree.
  const next = nextTrainingPosition(task);
  const positions = task.evidence.map((source) => source.san);
  const status = task.status === "in-progress" ? copy.inProgress : copy.notStarted;
  return (
    <section className="training-today" aria-label={copy.ariaLabel}>
      <header>
        <span className="eyebrow">{copy.today}</span>
        <h2>{trainingTitle(task.weaknessKind, language)}</h2>
      </header>
      {focusedFromLink && <p className="training-today-note">{copy.fromLink}</p>}
      {rationale && <p>{rationale}</p>}
      <p className="training-today-progress">
        <strong>{task.progress.reviewedPositionCount} / {task.progress.totalPositionCount}</strong>{copy.positionsReviewedTail(work)}{status}
      </p>
      {next && (
        <p className="training-today-next">
          {copy.nextPosition} <Link href={trainingReviewHref(task, next)}>{next.san}</Link>
        </p>
      )}
      <p className="training-today-facts">{positions.join(" · ")}</p>
      <button type="button" className="primary" disabled={disabled || !next} onClick={() => void start(task.id)}>
        {!next ? copy.noPositionsDue : task.status === "in-progress" ? copy.continueToday : copy.startToday}
      </button>
      {error !== null && <p className="training-today-error" role="alert">{error}</p>}
      <p className="training-today-note">{copy.reviewedNote}</p>
    </section>
  );
}
