"use client";

import { useMemo, useState } from "react";
import { practiceMoves } from "@chess-review/analysis";
import { formatMoveNumber, type GameAnalysisV2, type MoveQuality, type UiLanguage } from "@chess-review/shared";

import { QualityIcon, qualityLabel } from "@chess-review/ui";
import { useReviewStore } from "../../store/review-store";
import { useReviewRuntime } from "../review-runtime";
import { criticalMomentPlies, keyMomentPosition, nextCriticalPly, previousCriticalPly } from "../../lib/critical-moment-navigation";
import { useReviewSession } from "../review-session-state";
import { ReviewCompletion } from "./review-completion";
import { useUiLanguage } from "../../hooks/use-ui-language";

/* Errors that are worth practising. This mirrors the practice queue's own
   eligibility rule by asking the same module, so a guided moment can never offer
   "Try again" for a position the practice session would exclude. */
const PRACTICE_QUALITIES: readonly MoveQuality[] = ["inaccuracy", "mistake", "blunder"];

type KeyMomentCopy = {
  nextStepAria: string;
  firstKeyMoment: string;
  stepToMove1: string;
  thisGame: string;
  progress: (total: number, seen: number) => string;
  momentAria: (index: number, seen: boolean) => string;
  finishEarly: string;
  keyMomentsAria: string;
  previous: string;
  momentOf: (index: number, total: number) => string;
  next: string;
  seenEvery: string;
  finish: string;
  tryYourself: string;
  answerHidden: string;
  solveFirst: string;
  tryIt: string;
  showAnalysis: string;
  tryAgainFact: (moveNumber: string, san: string, quality: string) => string;
  tryAgain: string;
};

const COPY: Record<UiLanguage, KeyMomentCopy> = {
  en: {
    nextStepAria: "Review next step",
    firstKeyMoment: "First key moment",
    stepToMove1: "Step to move 1 \u2192",
    thisGame: "This game",
    progress: (total, seen) => `${total} key ${total === 1 ? "moment" : "moments"} \u00b7 ${seen} seen`,
    momentAria: (index, seen) => `Key moment ${index}${seen ? ", seen" : ""}`,
    finishEarly: "Finish review early",
    keyMomentsAria: "Key moments",
    previous: "\u2190 Previous key moment",
    momentOf: (index, total) => `Moment ${index} of ${total}`,
    next: "Next key moment \u2192",
    seenEvery: "You have seen every key moment.",
    finish: "Finish review",
    tryYourself: "Try it yourself",
    answerHidden: "Answer hidden",
    solveFirst: "Solve this position before seeing what the engine says about it.",
    tryIt: "Try it",
    showAnalysis: "Show the analysis",
    tryAgainFact: (moveNumber, san, quality) => `${moveNumber} ${san} \u00b7 ${quality} \u00b7 try it again without the answer`,
    tryAgain: "Try again",
  },
  "zh-CN": {
    nextStepAria: "复盘下一步",
    firstKeyMoment: "第一个关键节点",
    stepToMove1: "走到第 1 着 →",
    thisGame: "本局",
    progress: (total, seen) => `${total} 个关键节点 · 已看 ${seen}`,
    momentAria: (index, seen) => `关键节点 ${index}${seen ? "，已看过" : ""}`,
    finishEarly: "提前结束复盘",
    keyMomentsAria: "关键节点",
    previous: "← 上一关键节点",
    momentOf: (index, total) => `节点 ${index} / ${total}`,
    next: "下一关键节点 →",
    seenEvery: "你已看过每个关键节点。",
    finish: "结束复盘",
    tryYourself: "自己试试",
    answerHidden: "答案已隐藏",
    solveFirst: "先解答这个局面，再看引擎怎么说。",
    tryIt: "试一试",
    showAnalysis: "显示分析",
    tryAgainFact: (moveNumber, san, quality) => `${moveNumber} ${san} · ${quality} · 不看答案再试一次`,
    tryAgain: "再试一次",
  },
};

/**
 * Guided review: where the visitor is among the key moments, where the next one
 * is, and the learning action for the moment they are on.
 *
 * The visitor is never locked in — every move stays clickable, and this panel
 * only adds direction to a review that already works without it.
 */
export function KeyMomentNavigation({ analysis }: { analysis: GameAnalysisV2 }) {
  const language = useUiLanguage();
  const copy = COPY[language];
  const runtime = useReviewRuntime();
  const currentPly = useReviewStore((store) => store.currentPly);
  const branch = useReviewStore((store) => store.branch);
  const { progress, counts } = useReviewSession();
  const [finished, setFinished] = useState(false);

  const plies = useMemo(() => criticalMomentPlies(analysis.criticalMoments), [analysis.criticalMoments]);
  const position = keyMomentPosition(analysis.criticalMoments, currentPly);
  const previous = previousCriticalPly(analysis.criticalMoments, currentPly);
  const next = nextCriticalPly(analysis.criticalMoments, currentPly);
  const complete = counts.browsedEverything;

  /** The same eligibility rule the practice queue uses, asked per ply. */
  const practisable = useMemo(() => (ply: number) => {
    const move = analysis.moves[ply - 1];
    if (!move || !PRACTICE_QUALITIES.includes(move.quality)) return false;
    if (!move.stockfish.bestMove) return false;
    return practiceMoves(analysis.moves, move.color, runtime.retro.includeInaccuracies).some((candidate) => candidate.ply === ply);
  }, [analysis, runtime.retro.includeInaccuracies]);

  const solvable = useMemo(() => (position ? analysis.moves[currentPly - 1] ?? null : null), [analysis, currentPly, position]);
  const withheld = useReviewStore((store) => store.concealedPly) === currentPly && currentPly > 0;

  /** Guided navigation offers a practisable moment blind instead of showing it. */
  function goToMoment(ply: number) {
    runtime.navigateToPly(ply);
    if (practisable(ply)) runtime.concealAnswer(ply);
  }

  if (finished) {
    const tally = runtime.retro.tally;
    return (
      <ReviewCompletion
        analysis={analysis}
        record={runtime.record}
        gameId={runtime.gameId}
        session={{
          ...progress,
          attempted: tally.processed,
          solvedUnassisted: tally.solved,
          hinted: tally.hinted,
          revealed: tally.revealed,
          skipped: tally.skipped,
          afterExposure: tally.afterExposure,
        }}
        onClose={() => setFinished(false)}
      />
    );
  }

  if (plies.length === 0) return null;

  const atStart = currentPly === 0 && !branch;
  const nextIsPrimary = position === null && next !== null;

  if (atStart) {
    return (
      <section className="key-moment-nav key-moment-invite" aria-label={copy.nextStepAria}>
        <div className="key-moment-invite-actions">
          <button type="button" className="primary key-moment-step" onClick={() => goToMoment(plies[0]!)}>
            {copy.firstKeyMoment}
          </button>
          <button type="button" className="text-button" disabled={analysis.moves.length === 0} onClick={() => runtime.navigateToPly(1)}>
            {copy.stepToMove1}
          </button>
        </div>
        <div className="key-moment-journey">
          <div className="key-moment-journey-head">
            <strong>{copy.thisGame}</strong>
            <span className="key-moment-progress">{copy.progress(plies.length, counts.seen)}</span>
          </div>
          <ol className="key-moment-dots">
            {plies.map((ply, index) => (
              <li key={ply}>
                <button
                  type="button"
                  aria-label={copy.momentAria(index + 1, progress.seen.includes(ply))}
                  data-seen={progress.seen.includes(ply) ? "true" : undefined}
                  onClick={() => goToMoment(ply)}
                />
              </li>
            ))}
          </ol>
        </div>
        <div className="key-moment-finish">
          <button type="button" className="text-button" onClick={() => setFinished(true)}>
            {copy.finishEarly}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="key-moment-nav" aria-label={copy.keyMomentsAria}>
      <div className="key-moment-row">
        <button
          type="button"
          className="key-moment-step"
          disabled={previous === null}
          onClick={() => previous !== null && goToMoment(previous)}
        >
          {copy.previous}
        </button>
        <span className="key-moment-progress" role="status">
          {position
            ? copy.momentOf(position.index, position.total)
            : copy.progress(plies.length, counts.seen)}
        </span>
        <button
          type="button"
          className={nextIsPrimary ? "primary key-moment-step" : "key-moment-step"}
          disabled={next === null}
          onClick={() => next !== null && goToMoment(next)}
        >
          {copy.next}
        </button>
        <div className="key-moment-finish">
          {complete && <span role="status">{copy.seenEvery}</span>}
          <button type="button" className={complete ? "primary" : "text-button"} onClick={() => setFinished(true)}>
            {complete ? copy.finish : copy.finishEarly}
          </button>
        </div>
      </div>


      {withheld ? (
        <div className="key-moment-action">
          <span className="key-moment-action-heading">{copy.tryYourself}</span>
          <span className="key-moment-action-meta">{copy.answerHidden}</span>
          <span className="key-moment-action-fact">
            {copy.solveFirst}
          </span>
          <button
            type="button"
            className="primary key-moment-retry"
            onClick={() => {
              runtime.pausePlayback();
              runtime.retro.startAt(currentPly);
            }}
          >
            {copy.tryIt}
          </button>
          <button type="button" className="text-button" onClick={() => runtime.clearConcealment()}>
            {copy.showAnalysis}
          </button>
        </div>
      ) : solvable && !branch && practisable(solvable.ply) && (
        <div className="key-moment-action">
          <span className="key-moment-action-fact">
            <QualityIcon classification={solvable.classification} size={20} language={language} />
            {copy.tryAgainFact(formatMoveNumber(solvable.fenBefore, solvable.color), solvable.san, qualityLabel(solvable.classification, language))}
          </span>
          <button
            type="button"
            className="primary key-moment-retry"
            onClick={() => {
              runtime.pausePlayback();
              runtime.retro.startAt(solvable.ply);
            }}
          >
            {copy.tryAgain}
          </button>
        </div>
      )}

    </section>
  );
}
