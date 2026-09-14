"use client";

import { useEffect, useMemo, useState } from "react";
import { practiceMoves } from "@chess-review/analysis";
import { formatMoveNumber, type GameAnalysisV2, type MoveQuality } from "@chess-review/shared";
import { QualityIcon } from "@chess-review/ui";
import { useReviewStore } from "../../store/review-store";
import { useReviewRuntime } from "../review-runtime";
import { allKeyMomentsVisited, criticalMomentPlies, keyMomentPosition, nextCriticalPly, previousCriticalPly } from "../../lib/critical-moment-navigation";
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
  const [visited, setVisited] = useState<ReadonlySet<number>>(() => new Set());
  const [finished, setFinished] = useState(false);

  const plies = useMemo(() => criticalMomentPlies(analysis.criticalMoments), [analysis.criticalMoments]);
  const position = keyMomentPosition(analysis.criticalMoments, currentPly);
  const previous = previousCriticalPly(analysis.criticalMoments, currentPly);
  const next = nextCriticalPly(analysis.criticalMoments, currentPly);
  const complete = allKeyMomentsVisited(analysis.criticalMoments, visited);

  useEffect(() => {
    if (!position) return;
    setVisited((current) => current.has(currentPly) ? current : new Set(current).add(currentPly));
  }, [currentPly, position]);

  const solvable = useMemo(() => {
    if (!position) return null;
    const move = analysis.moves[currentPly - 1];
    if (!move || !PRACTICE_QUALITIES.includes(move.quality)) return null;
    if (!move.stockfish.bestMove) return null;
    if (!practiceMoves(analysis.moves, move.color, runtime.retro.includeInaccuracies).some((candidate) => candidate.ply === currentPly)) return null;
    return move;
  }, [analysis, currentPly, position, runtime.retro.includeInaccuracies]);

  if (finished) {
    return (
      <ReviewCompletion
        analysis={analysis}
        player={runtime.record.preferredOrientation ?? null}
        gameId={runtime.gameId}
        tally={runtime.retro.tally}
        onClose={() => setFinished(false)}
      />
    );
  }

  if (plies.length === 0) return null;

  return (
    <section className="key-moment-nav" aria-label="Key moments">
      <div className="key-moment-row">
        <button
          type="button"
          className="key-moment-step"
          disabled={previous === null}
          onClick={() => previous !== null && runtime.navigateToPly(previous)}
        >
          ← Previous key moment
        </button>
        <span className="key-moment-progress" role="status">
          {position
            ? `Moment ${position.index} of ${position.total}`
            : `${plies.length} key ${plies.length === 1 ? "moment" : "moments"} · ${visited.size} seen`}
        </span>
        <button
          type="button"
          className="key-moment-step"
          disabled={next === null}
          onClick={() => next !== null && runtime.navigateToPly(next)}
        >
          Next key moment →
        </button>
      </div>

      {solvable && !branch && (
        <div className="key-moment-action">
          <span className="key-moment-action-fact">
            <QualityIcon classification={solvable.classification} size={20} />
            {formatMoveNumber(solvable.fenBefore, solvable.color)} {solvable.san} · {displayedMoveQualityLabel(solvable)} · try it before the answer
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

      <div className="key-moment-finish">
        {complete && <span role="status">You have seen every key moment.</span>}
        <button type="button" className={complete ? "primary" : "text-button"} onClick={() => setFinished(true)}>
          {complete ? "Finish review" : "Finish review early"}
        </button>
      </div>
    </section>
  );
}
