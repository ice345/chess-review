"use client";

import { useMemo, useState } from "react";
import { practiceMoves } from "@chess-review/analysis";
import { formatMoveNumber, type GameAnalysisV2, type MoveQuality } from "@chess-review/shared";

import { QualityIcon } from "@chess-review/ui";
import { useReviewStore } from "../../store/review-store";
import { useReviewRuntime } from "../review-runtime";
import { criticalMomentPlies, keyMomentPosition, nextCriticalPly, previousCriticalPly } from "../../lib/critical-moment-navigation";
import { useReviewSession } from "../review-session-state";
import { displayedMoveQualityLabel } from "../../lib/move-quality-label";
import { ReviewCompletion } from "./review-completion";

/* Errors that are worth practising. This mirrors the practice queue's own
   eligibility rule by asking the same module, so a guided moment can never offer
   "Try again" for a position the practice session would exclude. */
const PRACTICE_QUALITIES: readonly MoveQuality[] = ["inaccuracy", "mistake", "blunder"];

/**
 * Guided review: where the visitor is among the key moments, where the next one
 * is, and the learning action for the moment they are on.
 *
 * The visitor is never locked in — every move stays clickable, and this panel
 * only adds direction to a review that already works without it.
 */
export function KeyMomentNavigation({ analysis }: { analysis: GameAnalysisV2 }) {
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
      <section className="key-moment-nav key-moment-invite" aria-label="Review next step">
        <div className="key-moment-invite-actions">
          <button type="button" className="primary key-moment-step" onClick={() => goToMoment(plies[0]!)}>
            First key moment
          </button>
          <button type="button" className="text-button" disabled={analysis.moves.length === 0} onClick={() => runtime.navigateToPly(1)}>
            Step to move 1 →
          </button>
        </div>
        <div className="key-moment-journey">
          <div className="key-moment-journey-head">
            <strong>This game</strong>
            <span className="key-moment-progress">{plies.length} key {plies.length === 1 ? "moment" : "moments"} · {counts.seen} seen</span>
          </div>
          <ol className="key-moment-dots">
            {plies.map((ply, index) => (
              <li key={ply}>
                <button
                  type="button"
                  aria-label={`Key moment ${index + 1}${progress.seen.includes(ply) ? ", seen" : ""}`}
                  data-seen={progress.seen.includes(ply) ? "true" : undefined}
                  onClick={() => goToMoment(ply)}
                />
              </li>
            ))}
          </ol>
        </div>
        <div className="key-moment-finish">
          <button type="button" className="text-button" onClick={() => setFinished(true)}>
            Finish review early
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="key-moment-nav" aria-label="Key moments">
      <div className="key-moment-row">
        <button
          type="button"
          className="key-moment-step"
          disabled={previous === null}
          onClick={() => previous !== null && goToMoment(previous)}
        >
          ← Previous key moment
        </button>
        <span className="key-moment-progress" role="status">
          {position
            ? `Moment ${position.index} of ${position.total}`
            : `${plies.length} key ${plies.length === 1 ? "moment" : "moments"} · ${counts.seen} seen`}
        </span>
        <button
          type="button"
          className={nextIsPrimary ? "primary key-moment-step" : "key-moment-step"}
          disabled={next === null}
          onClick={() => next !== null && goToMoment(next)}
        >
          Next key moment →
        </button>
        <div className="key-moment-finish">
          {complete && <span role="status">You have seen every key moment.</span>}
          <button type="button" className={complete ? "primary" : "text-button"} onClick={() => setFinished(true)}>
            {complete ? "Finish review" : "Finish review early"}
          </button>
        </div>
      </div>


      {withheld ? (
        <div className="key-moment-action">
          <span className="key-moment-action-heading">Try it yourself</span>
          <span className="key-moment-action-meta">Answer hidden</span>
          <span className="key-moment-action-fact">
            Solve this position before seeing what the engine says about it.
          </span>
          <button
            type="button"
            className="primary key-moment-retry"
            onClick={() => {
              runtime.pausePlayback();
              runtime.retro.startAt(currentPly);
            }}
          >
            Try it
          </button>
          <button type="button" className="text-button" onClick={() => runtime.clearConcealment()}>
            Show the analysis
          </button>
        </div>
      ) : solvable && !branch && practisable(solvable.ply) && (
        <div className="key-moment-action">
          <span className="key-moment-action-fact">
            <QualityIcon classification={solvable.classification} size={20} />
            {formatMoveNumber(solvable.fenBefore, solvable.color)} {solvable.san} · {displayedMoveQualityLabel(solvable)} · try it again without the answer
          </span>
          <button
            type="button"
            className="primary key-moment-retry"
            onClick={() => {
              runtime.pausePlayback();
              runtime.retro.startAt(solvable.ply);
            }}
          >
            Try again
          </button>
        </div>
      )}

    </section>
  );
}
