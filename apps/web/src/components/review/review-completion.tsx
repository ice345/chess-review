"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { gameTrainingWeaknesses } from "@chess-review/analysis";
import { formatMoveNotation, type GameAnalysisV2, type MoveAnnotation, type PlayerColor, type UiLanguage } from "@chess-review/shared";
import { classificationForAnnotation, QualityIcon, qualityLabel } from "@chess-review/ui";
import { buildReviewCompletion, type CompletionMoment } from "../../lib/review-completion";
import { extraMoveAnnotations } from "../../lib/move-quality-label";
import { reviewCompletionDetail, reviewCompletionHeadline, reviewSessionCounts, type ReviewSessionProgress } from "../../lib/review-session";
import { learnerColorForRecord } from "../../lib/player-identity";
import { studyPlayerKeyForRecord } from "../../lib/advanced-study-library";
import type { ReviewRecord } from "../../lib/review-library";
import {
  applyTrainingAddition,
  listTrainingQueue,
  planTrainingAddition,
  trainingGameContribution,
  type TrainingAddition,
  type TrainingAdditionResult,
} from "../../lib/training-queue";
import type { TrainingQueueItemV3 } from "@chess-review/shared";
import { useUiLanguage } from "../../hooks/use-ui-language";

type CompletionCopy = {
  complete: string;
  summary: string;
  tally: (solved: number, hinted: number, revealed: number, skipped: number, afterExposure: number) => string;
  mostImportant: string;
  white: string;
  black: string;
  gaveUp: (quality: string, loss: string) => string;
  worthLook: string;
  reviewMoves: string;
  openPractice: string;
  studyGame: string;
  backToMoments: string;
  annotations: Record<MoveAnnotation, string>;
  highlight: (labels: string[], quality: string, accuracy: string) => string;
  trainingLoad: string;
  addAria: string;
  alreadyInPractice: (positions: number, tasks: number) => string;
  noneInPractice: string;
  whosePositions: string;
  willJoin: (positions: number, tasks: number) => string;
  whichPositions: string;
  adding: string;
  addPositions: (planned: number) => string;
  deferred: (count: number) => string;
  everyAlready: string;
  noneAccepted: string;
  added: (positions: number, tasks: number) => string;
  openTask: string;
  unableToAdd: string;
};

const COPY: Record<UiLanguage, CompletionCopy> = {
  en: {
    complete: "Review complete",
    summary: "Review summary",
    tally: (solved, hinted, revealed, skipped, afterExposure) => {
      let text = `Solved ${solved}`;
      if (hinted > 0) text += `, hinted ${hinted}`;
      if (revealed > 0) text += `, viewed ${revealed}`;
      if (skipped > 0) text += `, skipped ${skipped}`;
      text += ".";
      if (hinted > 0) text += " A hinted position is not counted as solved.";
      if (afterExposure > 0) text += ` ${afterExposure} of them followed a position whose analysis you had already seen, so they are practice rather than a first-time find.`;
      return text;
    },
    mostImportant: "Most important mistake",
    white: "White",
    black: "Black",
    gaveUp: (quality, loss) => `${quality} \u00b7 gave up ${loss}% win probability`,
    worthLook: "Worth another look",
    reviewMoves: "Review the moves \u2192",
    openPractice: "Open Practice",
    studyGame: "Study this game",
    backToMoments: "Back to key moments",
    annotations: {
      brilliant: "Brilliant",
      critical: "Critical",
      book: "Book",
      forced: "Forced",
      sacrifice: "Sacrifice",
      missed_win: "Missed win",
      missed_mate: "Missed mate",
    },
    highlight: (labels, quality, accuracy) => `${labels.length > 0 ? `${labels.join(", ")} \u00b7 ` : ""}${quality} \u00b7 Accuracy ${accuracy}`,
    trainingLoad: "Practice positions load with your local library.",
    addAria: "Add this game to Practice",
    alreadyInPractice: (positions, tasks) => `${positions} ${positions === 1 ? "position" : "positions"} from this game ${positions === 1 ? "is" : "are"} already in Practice across ${tasks} ${tasks === 1 ? "task" : "tasks"}.`,
    noneInPractice: "No position from this game is in Practice yet.",
    whosePositions: "Whose positions are these?",
    willJoin: (positions, tasks) => `${positions} ${positions === 1 ? "position" : "positions"} will join ${tasks} practice ${tasks === 1 ? "task" : "tasks"}.`,
    whichPositions: "Which positions",
    adding: "Adding\u2026",
    addPositions: (planned) => `Add ${planned === 1 ? "this position" : `these ${planned} positions`} to Practice`,
    deferred: (count) => `${count} ${count === 1 ? "position does" : "positions do"} not fit the five-position limit of a task and ${count === 1 ? "was" : "were"} not added.`,
    everyAlready: "Every position from this game is already in Practice.",
    noneAccepted: "This game recorded no position that the training queue accepts.",
    added: (positions, tasks) => `Added ${positions} ${positions === 1 ? "position" : "positions"} to ${tasks} ${tasks === 1 ? "task" : "tasks"}. `,
    openTask: "Open the task \u2192",
    unableToAdd: "Unable to add these positions. Try again.",
  },
  "zh-CN": {
    complete: "复盘完成",
    summary: "复盘摘要",
    tally: (solved, hinted, revealed, skipped, afterExposure) => {
      let text = `独立解出 ${solved}`;
      if (hinted > 0) text += `，提示后 ${hinted}`;
      if (revealed > 0) text += `，查看 ${revealed}`;
      if (skipped > 0) text += `，跳过 ${skipped}`;
      text += "。";
      if (hinted > 0) text += " 看过提示的局面不计入解出。";
      if (afterExposure > 0) text += ` 其中 ${afterExposure} 个是在已经看过分析之后再练的，属于训练而非第一次发现。`;
      return text;
    },
    mostImportant: "最重要的失误",
    white: "白方",
    black: "黑方",
    gaveUp: (quality, loss) => `${quality} · 丢掉 ${loss}% 胜率`,
    worthLook: "值得再看",
    reviewMoves: "复盘着法 →",
    openPractice: "打开训练",
    studyGame: "学习本局",
    backToMoments: "返回关键节点",
    annotations: {
      brilliant: "精彩",
      critical: "关键",
      book: "定式",
      forced: "强制",
      sacrifice: "弃子",
      missed_win: "错过胜机",
      missed_mate: "错过杀棋",
    },
    highlight: (labels, quality, accuracy) => `${labels.length > 0 ? `${labels.join("、")} · ` : ""}${quality} · 准确率 ${accuracy}`,
    trainingLoad: "训练局面随你的本地棋库加载。",
    addAria: "把本局加入训练",
    alreadyInPractice: (positions, tasks) => `本局已有 ${positions} 个局面在训练中，分布在 ${tasks} 个任务里。`,
    noneInPractice: "本局还没有局面进入训练。",
    whosePositions: "这些是谁的局面？",
    willJoin: (positions, tasks) => `${positions} 个局面将加入 ${tasks} 个训练任务。`,
    whichPositions: "哪些局面",
    adding: "正在添加…",
    addPositions: (planned) => planned === 1 ? "把这个局面加入训练" : `把这 ${planned} 个局面加入训练`,
    deferred: (count) => `${count} 个局面超出任务的五局面上限，因此未加入。`,
    everyAlready: "本局每个局面都已在训练中。",
    noneAccepted: "本局没有训练队列接受的局面。",
    added: (positions, tasks) => `已将 ${positions} 个局面加入 ${tasks} 个任务。 `,
    openTask: "打开任务 →",
    unableToAdd: "无法添加这些局面。请重试。",
  },
};

/**
 * End-of-review state.
 *
 * Everything shown is either a canonical analysis fact or a count of this
 * session's own work; no new chess claim is generated, and nothing here waits on
 * a coach response. The headline counts what the session actually viewed, so
 * finishing early can never read as a finished review.
 */
export function ReviewCompletion({
  analysis,
  record,
  gameId,
  session,
  onClose,
}: {
  analysis: GameAnalysisV2;
  record: ReviewRecord;
  gameId: string;
  session: ReviewSessionProgress;
  onClose: () => void;
}) {
  const language = useUiLanguage();
  const copy = COPY[language];
  const learner = learnerColorForRecord(record);
  // A manual import has no learner, so the visitor names the side. Start on the
  // side that actually recorded trainable positions; the choice stays theirs.
  const [side, setSide] = useState<PlayerColor>(() => learner ?? sideWithMostEvidence(analysis, gameId));
  const facts = buildReviewCompletion(analysis, learner, language);
  const counts = reviewSessionCounts(session, analysis.criticalMoments);
  const { items: queue, reload: reloadQueue } = useTrainingQueue();
  const addition = useTrainingAddition(analysis, record, gameId, side, queue, reloadQueue);

  return (
    <section className="review-completion" aria-label={counts.browsedEverything ? copy.complete : copy.summary}>
      <header>
        <span className="review-completion-staff" aria-hidden="true" />
        <span className="kicker">{counts.browsedEverything ? copy.complete : copy.summary}</span>
        <h2>{reviewCompletionHeadline(counts, language)}</h2>
        <p className="review-completion-detail">{reviewCompletionDetail(counts, language)}</p>
        {counts.attempted > 0 && (
          <p className="review-completion-tally">
            {copy.tally(counts.solvedUnassisted, counts.hinted, counts.revealed, counts.skipped, counts.afterExposure)}
          </p>
        )}
      </header>

      {facts.lesson && <p className="review-completion-lesson">{facts.lesson}</p>}

      <dl className="review-completion-facts">
        {facts.mostImportantMistake && (
          <div>
            <dt>{copy.mostImportant}</dt>
            <dd>
              <QualityIcon classification={facts.mostImportantMistake.classification} size={22} language={language} />
              <span>
                <strong>{formatMoveNotation(facts.mostImportantMistake)}</strong>
                {facts.scope === "both" && <span className="review-completion-color">{facts.mostImportantMistake.color === "white" ? copy.white : copy.black}</span>}
                <small>{copy.gaveUp(qualityLabel(facts.mostImportantMistake.classification, language), facts.mostImportantMistake.loss.toFixed(1))}</small>
              </span>
            </dd>
          </div>
        )}
        {facts.highlight && (
          <div>
            <dt>{copy.worthLook}</dt>
            <dd>
              <HighlightIcon moment={facts.highlight} />
              <span>
                <strong>{formatMoveNotation(facts.highlight)}</strong>
                {facts.scope === "both" && <span className="review-completion-color">{facts.highlight.color === "white" ? copy.white : copy.black}</span>}
                <small>{highlightEvidence(facts.highlight, language, copy)}</small>
              </span>
            </dd>
          </div>
        )}
      </dl>

      <div className="review-completion-actions">
        <Link className="primary-link" href={`/review/${gameId}/moves`}>{copy.reviewMoves}</Link>
        <Link className="text-button" href="/training">{copy.openPractice}</Link>
        <Link className="text-button" href={`/review/${gameId}/coach`}>{copy.studyGame}</Link>
        <button type="button" className="text-button" onClick={onClose}>{copy.backToMoments}</button>
      </div>

      <TrainingHandoff
        analysis={analysis}
        gameId={gameId}
        learner={learner}
        side={side}
        onSide={setSide}
        queue={queue}
        addition={addition}
      />
    </section>
  );
}

/** The canonical classification icon, plus any annotation the row's icon does not show. */
function HighlightIcon({ moment }: { moment: CompletionMoment }) {
  const language = useUiLanguage();
  const copy = COPY[language];
  return (
    <span className="review-completion-icons">
      <QualityIcon classification={moment.classification} size={22} language={language} />
      {extraMoveAnnotations(moment).map((annotation) => (
        <QualityIcon classification={classificationForAnnotation(annotation)} size={22} key={annotation} title={copy.annotations[annotation]} language={language} />
      ))}
    </span>
  );
}

/** Why this move was selected, from its own canonical evidence. */
function highlightEvidence(moment: CompletionMoment, language: UiLanguage, copy: CompletionCopy): string {
  const quality = qualityLabel(moment.classification, language);
  const labels = moment.annotations
    .map((annotation) => copy.annotations[annotation])
    .filter((label) => label !== quality);
  return copy.highlight(labels, quality, moment.accuracy.toFixed(1));
}

/**
 * The handoff into Practice: the exact positions this game would contribute.
 *
 * The offer and the result state the same numbers because both come from
 * `planTrainingAddition`. The learner is the record's own account when the game
 * has one; otherwise the visitor chooses the side, which is what makes the
 * resulting task belong to a player the Practice page already knows.
 */
function TrainingHandoff({
  analysis,
  gameId,
  learner,
  side,
  onSide,
  queue,
  addition,
}: {
  analysis: GameAnalysisV2;
  gameId: string;
  learner: PlayerColor | null;
  side: PlayerColor;
  onSide: (side: PlayerColor) => void;
  queue: TrainingQueueItemV3[] | null;
  addition: TrainingHandoffState;
}) {
  const copy = COPY[useUiLanguage()];
  const training = queue === null ? null : trainingGameContribution(queue, gameId);

  if (queue === null || addition.plan === null) {
    return <p className="review-completion-training">{copy.trainingLoad}</p>;
  }

  const planned = addition.plan.reduce((total, entry) => total + entry.add.length, 0);
  const already = addition.plan.reduce((total, entry) => total + entry.alreadyPresent, 0);
  const deferred = addition.plan.reduce((total, entry) => total + entry.deferred, 0);
  const taskIds = [...new Set(addition.plan.filter((entry) => entry.add.length > 0).map((entry) => entry.taskId))];
  const addedTask = addition.result?.taskIds[0];
  const trainingHref = addition.result === null || addedTask === undefined
    ? "/training"
    : `/training?${new URLSearchParams({ player: addition.playerKey ?? "", task: addedTask })}`;
  const positions = addition.plan.flatMap((entry) => entry.add);

  return (
    <section className="review-completion-training-block" aria-label={copy.addAria}>
      <p className="review-completion-training">
        {training !== null && training.positions > 0
          ? copy.alreadyInPractice(training.positions, training.tasks)
          : copy.noneInPractice}
      </p>

      {learner === null && (
        <fieldset className="review-completion-side">
          <legend>{copy.whosePositions}</legend>
          {(["white", "black"] as const).map((color) => (
            <button
              type="button"
              key={color}
              className={side === color ? "active" : ""}
              aria-pressed={side === color}
              onClick={() => onSide(color)}
            >
              {color === "white" ? copy.white : copy.black}
            </button>
          ))}
        </fieldset>
      )}

      {planned > 0 && (
        <>
          <p className="review-completion-offer">
            {copy.willJoin(planned, taskIds.length)}
          </p>
          <details className="review-completion-which">
            <summary>{copy.whichPositions}</summary>
            <ul className="review-completion-positions">
              {positions.map((position) => (
                <li key={`${position.gameId}:${position.ply}`}>
                  <QualityIcon classification={position.classification} size={18} decorative />
                  <span>{formatMoveNotation({ fenBefore: fenBeforeFor(analysis, position.ply), color: analysis.moves[position.ply - 1]?.color ?? "white", san: position.san })}</span>
                  <small>−{position.winPercentLoss.toFixed(1)} Win%</small>
                </li>
              ))}
            </ul>
          </details>
          <button type="button" className="text-button" disabled={addition.busy || addition.playerKey === null} onClick={() => void addition.add()}>
            {addition.busy ? copy.adding : copy.addPositions(planned)}
          </button>
        </>
      )}

      {deferred > 0 && (
        <p className="review-completion-training">{copy.deferred(deferred)}</p>
      )}
      {planned === 0 && already > 0 && <p className="review-completion-training">{copy.everyAlready}</p>}
      {planned === 0 && already === 0 && <p className="review-completion-training">{copy.noneAccepted}</p>}

      {addition.result !== null && (
        <p className="review-completion-training" role="status">
          {copy.added(addition.result.summary.added, addition.result.summary.tasks)}
          <Link href={trainingHref}>{copy.openTask}</Link>
        </p>
      )}
      {addition.error !== null && <p className="error" role="alert">{addition.error}</p>}
    </section>
  );
}

function sideWithMostEvidence(analysis: GameAnalysisV2, gameId: string): PlayerColor {
  const evidence = (color: PlayerColor) => gameTrainingWeaknesses(analysis, gameId, color)
    .reduce((total, weakness) => total + weakness.evidence.length, 0);
  return evidence("black") > evidence("white") ? "black" : "white";
}

/** The position before a move, so the move notation matches every other surface. */
function fenBeforeFor(analysis: GameAnalysisV2, ply: number): string {
  return analysis.moves[ply - 1]?.fenBefore ?? analysis.game.initialFen;
}

interface TrainingHandoffState {
  /** The plan for the chosen side, or null when that side cannot name a player. */
  plan: TrainingAddition[] | null;
  playerKey: string | null;
  busy: boolean;
  /** What the last write stored, and which tasks it touched. */
  result: { summary: TrainingAdditionResult; taskIds: string[] } | null;
  error: string | null;
  add: () => Promise<void>;
}

function useTrainingQueue(): { items: TrainingQueueItemV3[] | null; reload: () => Promise<void> } {
  const [items, setItems] = useState<TrainingQueueItemV3[] | null>(null);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let active = true;
    void listTrainingQueue()
      .then((loaded) => { if (active) setItems(loaded); })
      .catch(() => { if (active) setItems(null); });
    return () => { active = false; };
  }, [generation]);
  return {
    items,
    reload: async () => { setGeneration((current) => current + 1); },
  };
}

function useTrainingAddition(
  analysis: GameAnalysisV2,
  record: ReviewRecord,
  gameId: string,
  side: PlayerColor,
  queue: TrainingQueueItemV3[] | null,
  reloadQueue: () => Promise<void>,
): TrainingHandoffState {
  const copy = COPY[useUiLanguage()];
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ summary: TrainingAdditionResult; taskIds: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playerKey = studyPlayerKeyForRecord(record, analysis, side);
  const plan = queue === null || playerKey === null
    ? null
    : planTrainingAddition(queue, playerKey, gameTrainingWeaknesses(analysis, gameId, side));

  async function add() {
    if (plan === null || playerKey === null) return;
    setBusy(true);
    setError(null);
    // The task ids come from the plan that was written, not from the queue the
    // write is about to change.
    const taskIds = [...new Set(plan.filter((entry) => entry.add.length > 0).map((entry) => entry.taskId))];
    try {
      setResult({ summary: await applyTrainingAddition(playerKey, plan), taskIds });
      // The offer is recomputed from the stored queue, so a second click cannot
      // add the same positions twice and the counts stay true.
      await reloadQueue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.unableToAdd);
    } finally {
      setBusy(false);
    }
  }

  // Changing the side starts a new offer; a stored result belongs to the old one.
  useEffect(() => { setResult(null); setError(null); }, [playerKey]);

  return { plan, playerKey, busy, result, error, add };
}
