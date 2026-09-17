"use client";

import type { GameAnalysisV2, PlayerColor } from "@chess-review/shared";
import type { RetroRuntime } from "../hooks/use-retrospect";
import { useReviewStore } from "../store/review-store";
import { useReviewRuntime } from "./review-runtime";
import { learnerColorForRecord } from "../lib/player-identity";
import { practiceEmptyCopy, practiceSetup, practiceSideName } from "../lib/practice-setup";

export function RetroPractice({ analysis }: { analysis: GameAnalysisV2 }) {
  const runtime = useReviewRuntime();
  const retro = runtime.retro;
  const currentPly = useReviewStore((store) => store.currentPly);
  const branch = useReviewStore((store) => store.branch);
  // Session-scoped to this review: the choice survives leaving and re-entering
  // the Practice panel, and the store clears it when another game is loaded.
  const practiceColor = useReviewStore((store) => store.practiceColor);
  const setPracticeColor = useReviewStore((store) => store.setPracticeColor);
  // Orientation is not identity: a manual import has no learner, so the side is
  // the visitor's choice and the default is the side with something to practise.
  const knownColor = learnerColorForRecord(runtime.record);

  const setup = practiceSetup({ analysis, includeInaccuracies: retro.includeInaccuracies, selected: practiceColor, knownColor });
  const offTrack = Boolean(
    retro.active
    && retro.locked
    && retro.status !== "evaluating"
    && retro.status !== "rewinding"
    && retro.current
    && branch === null
    && currentPly !== retro.current.promptPly,
  );

  function begin(nextColor: PlayerColor) {
    runtime.pausePlayback();
    retro.start(nextColor);
    document.querySelector(".board-wrap")?.scrollIntoView({ block: "nearest" });
  }

  if (!retro.active) {
    const { startable } = setup;
    return <section className="retro-practice retro-idle" aria-label="Practice setup">
      <p className="practice-heading">Practice your mistakes</p>
      <div className="practice-setup" role="group" aria-label="Which side to practise">
        {setup.sides.map((side) => (
          <button
            key={side.color}
            type="button"
            className="practice-side"
            aria-label={`${practiceSideName(side.color)}, ${side.count} ${side.count === 1 ? "position" : "positions"}`}
            aria-pressed={side.color === setup.selected}
            // An empty side stays in the selector and stays selectable: its
            // explanation is the answer to "why can I not practise this side?".
            data-empty={side.count === 0 ? "true" : undefined}
            onClick={() => setPracticeColor(side.color)}
          >
            <span>{practiceSideName(side.color)}</span>
            <small>{side.count} {side.count === 1 ? "position" : "positions"}</small>
          </button>
        ))}
      </div>
      <label className="practice-inline-check">
        <input type="checkbox" checked={retro.includeInaccuracies} onChange={(event) => retro.setIncludeInaccuracies(event.target.checked)} />
        Include inaccuracies
      </label>
      {/* Secondary by contract: at the start ply the guided route owns the one
          primary action, and practice is the second layer of that screen. */}
      {startable.count > 0 ? (
        <button type="button" className="secondary retro-idle-start" onClick={() => begin(startable.color)}>
          Practice {practiceSideName(startable.color)}&apos;s {startable.count} {startable.count === 1 ? "position" : "positions"}
        </button>
      ) : (
        <p className="utility-note">{practiceEmptyCopy(startable)}</p>
      )}
    </section>;
  }

  const total = retro.totalCount;
  const position = Math.min(retro.currentIndex + 1, Math.max(total, 1));
  // The running session's own colour, which the guided-moment entry
  // (`retro.startAt`) sets from the fault's mover. That deliberately overrides
  // the setup selection: a key moment practises that exact fault, whichever side
  // played it, and the setup selection is restored the next time practice starts
  // from this panel.
  const side = practiceSideName(retro.color);
  const last = retro.currentIndex + 1 >= total;

  return <section className="retro-practice" aria-label="Learn from your mistakes" data-status={retro.status}>
    <header className="retro-head">
      <strong>Learn from your mistakes</strong>
      {retro.answerExposed && <span className="retro-exposure" role="status">Review practice</span>}
      <span>{position} / {total}</span>
      <button type="button" className="text-button retro-close" onClick={() => retro.stop()}>Exit</button>
    </header>

    {retro.answerExposed && <p className="retro-lead retro-exposure-note">You have already seen this position&rsquo;s analysis. Solving it here is practice, not a first-time find.</p>}

    {retro.status === "complete" && <CompletePanel retro={retro} side={side} />}

    {retro.status !== "complete" && retro.current && <div className="retro-panel">
      {offTrack && <>
        <p className="retro-verdict" role="status">You browsed away</p>
        <p className="retro-lead">Return to the position to keep solving, or skip it.</p>
        <div className="retro-choices">
          <button type="button" className="primary" onClick={() => runtime.navigateToPly(retro.current!.promptPly)}>Resume learning</button>
          <button type="button" className="text-button" onClick={() => retro.skip()}>Skip</button>
        </div>
      </>}

      {!offTrack && retro.status === "evaluating" && <p className="retro-verdict" role="status">Checking this move…</p>}
      {!offTrack && retro.status === "rewinding" && <p className="retro-verdict" role="status">Returning to the position…</p>}

      {!offTrack && (retro.status === "solving" || retro.status === "rejected") && <>
        <p className="retro-meta">{side} to move</p>
        <p className="retro-instruction">
          <strong>{retro.current.faultLabel}</strong>
          {" "}was played.
        </p>
        <p className="retro-lead">Find a better move on the board. The red arrow is the original mistake.</p>
        {retro.hintSquare && (
          <p className="retro-hint" role="status">
            Look at the piece on <strong>{retro.hintSquare}</strong>. The best move starts there — other moves can still keep the position.
          </p>
        )}
        {retro.status === "rejected" && retro.lastOutcome?.reason !== "engine-unavailable" && retro.lastOutcome?.reason !== "timeout"
          ? <p className="retro-status" role="status">{`${retro.lastOutcome?.attemptedSan ?? "That move"} does not keep the position. Try again.`}</p>
          : null}
        {(retro.lastOutcome?.reason === "engine-unavailable" || retro.lastOutcome?.reason === "timeout") && (
          <p className="retro-status" role="status">
            {retro.lastOutcome.reason === "timeout"
              ? "The engine timed out, so that move was not marked wrong. Try again or view the answer."
              : `The engine could not verify ${retro.lastOutcome.attemptedSan ?? "that move"}, so it was not marked wrong. Try again or view the answer.`}
          </p>
        )}
        <div className="retro-choices">
          {retro.hintSquare === null && <button type="button" className="text-button" onClick={retro.useHint}>Hint</button>}
          <button type="button" className="text-button" onClick={() => retro.viewSolution()}>View the solution</button>
          <button type="button" className="text-button" onClick={() => retro.skip()}>Skip</button>
        </div>
      </>}

      {!offTrack && retro.status === "accepted" && <>
        <p className="retro-verdict solved" role="status">That move keeps the position</p>
        {retro.lastOutcome?.attemptedSan && <p className="retro-lead">{retro.lastOutcome.attemptedSan} is good enough — it is not necessarily the only best move.</p>}
        {retro.current.comparison
          ? <div className="retro-human" aria-label="Why the original move felt natural">
            <strong>Why the original move felt natural</strong>
            <p>{retro.current.comparison.summary}</p>
            <small>
              Human model {retro.current.comparison.model} at {retro.current.comparison.targetElo}
              {retro.current.comparison.bestMoveDifficulty === undefined
                ? " · this level's model did not rank the stronger move"
                : ` · difficulty of the stronger move: ${retro.current.comparison.bestMoveDifficulty.label.replaceAll("-", " ")}`}
            </small>
          </div>
          : runtime.humanServiceState === "available"
            ? <p className="retro-human-note">Run this move&rsquo;s human analysis in Review to see why the original move looked natural at your level.</p>
            : null}
        <div className="retro-choices">
          <button type="button" className="primary" onClick={() => retro.next()}>{last ? "View this session" : "Next"}</button>
        </div>
      </>}

      {!offTrack && retro.status === "revealed" && <>
        <p className="retro-verdict" role="status">Solution</p>
        <p className="retro-lead">Best was {retro.current.bestSan}. Keep playing this line, or continue.</p>
        <div className="retro-choices">
          <button type="button" className="primary" onClick={() => retro.next()}>{last ? "View this session" : "Next"}</button>
        </div>
      </>}
    </div>}
  </section>;
}


function CompletePanel({ retro, side }: { retro: RetroRuntime; side: string }) {
  const { tally } = retro;
  return <div className="retro-panel">
    <p className="retro-verdict solved" role="status">
      Reviewed {tally.processed} {side} {tally.processed === 1 ? "position" : "positions"}:
      {" "}solved {tally.solved}, viewed {tally.revealed}, skipped {tally.skipped}
      {tally.unavailable > 0 ? `, unavailable ${tally.unavailable}` : ""}.
    </p>
    <p className="retro-lead">A solved position is one you found yourself. Viewing the solution is not counted as solving it.</p>
    <div className="retro-choices">
      {tally.solved < tally.processed && <button type="button" className="primary" onClick={() => retro.retryUnsolved()}>Retry unsolved positions</button>}
      <button type="button" className={tally.solved < tally.processed ? "text-button" : "primary"} onClick={() => retro.stop()}>Return to review</button>
    </div>
  </div>;
}
