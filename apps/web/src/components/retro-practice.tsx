"use client";

import type { GameAnalysisV2, PlayerColor } from "@chess-review/shared";
import { Icon } from "@chess-review/ui";
import type { RetroRuntime } from "../hooks/use-retrospect";
import { useReviewStore } from "../store/review-store";
import { useReviewRuntime } from "./review-runtime";
import { learnerColorForRecord } from "../lib/player-identity";
import { PIECE_ASSET_DIR } from "../lib/board-piece-assets";
import { practiceEmptyCopy, practiceSetup, practiceSideName, type PracticeSetup } from "../lib/practice-setup";

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
      <SideChooser setup={setup} onSelect={setPracticeColor} />
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
  const pawnKey = retro.color === "white" ? "wP" : "bP";
  const answering = retro.status === "solving" || retro.status === "rejected";
  const canAdvance = retro.status !== "complete" && retro.status !== "evaluating" && retro.status !== "rewinding";

  function selectDuringSession(nextColor: PlayerColor) {
    setPracticeColor(nextColor);
    const next = setup.sides.find((entry) => entry.color === nextColor);
    if (next && next.count > 0 && nextColor !== retro.color) begin(nextColor);
  }

  function goNext() {
    if (!canAdvance) return;
    if (retro.status === "accepted" || retro.status === "revealed") retro.next();
    else retro.skip();
  }

  return <section className="retro-practice paper-panel" aria-label="Learn from your mistakes" data-status={retro.status}>
    <header className="retro-head">
      <span className="kicker">Practice</span>
      <span className="retro-position">
        Position {position} / {total}
        <button type="button" className="retro-position-nav" aria-label="Previous position" disabled>
          <Icon name="chevron-left" />
        </button>
        <button type="button" className="retro-position-nav" aria-label="Next position" disabled={!canAdvance} onClick={goNext}>
          <Icon name="chevron-right" />
        </button>
      </span>
      {retro.answerExposed && <span className="retro-exposure" role="status">Review practice</span>}
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

      {!offTrack && answering && <>
        <div className="retro-turn">
          <span className="retro-turn-badge" aria-hidden="true">
            <img src={`${PIECE_ASSET_DIR}/${pawnKey}.png`} alt="" width={40} height={40} draggable={false} />
          </span>
          <div>
            <p className="retro-your-turn">Your turn</p>
            <p className="retro-meta">{side} to move</p>
          </div>
        </div>
        <p className="retro-instruction retro-aside">
          <strong>{retro.current.faultLabel}</strong>
          {" "}was played.
        </p>
        <p className="retro-lead retro-aside">Find a better move on the board. The red arrow is the original mistake.</p>
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
        <button
          type="button"
          className="primary retro-commit"
          onClick={() => document.querySelector(".board-wrap")?.scrollIntoView({ block: "nearest" })}
        >
          Make your move →
        </button>
        <p className="retro-helper">Select a piece and a square on the board</p>
        <div className="retro-choices">
          {retro.hintSquare === null && (
            <button type="button" className="secondary" onClick={retro.useHint}>
              <Icon name="hint" /> Hint
            </button>
          )}
          <button type="button" className="secondary" aria-label="View the solution" onClick={() => retro.viewSolution()}>
            <Icon name="answer" /> Show answer
          </button>
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

    <ActiveSetup
      setup={setup}
      includeInaccuracies={retro.includeInaccuracies}
      onIncludeInaccuracies={retro.setIncludeInaccuracies}
      onSelect={selectDuringSession}
      onReset={() => retro.reset()}
    />
  </section>;
}


function SideChooser({ setup, onSelect }: { setup: PracticeSetup; onSelect: (color: PlayerColor) => void }) {
  return (
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
          onClick={() => onSelect(side.color)}
        >
          <span>{practiceSideName(side.color)}</span>
          <small>{side.count} {side.count === 1 ? "position" : "positions"}</small>
        </button>
      ))}
    </div>
  );
}

function ActiveSetup({
  setup,
  includeInaccuracies,
  onIncludeInaccuracies,
  onSelect,
  onReset,
}: {
  setup: PracticeSetup;
  includeInaccuracies: boolean;
  onIncludeInaccuracies: (value: boolean) => void;
  onSelect: (color: PlayerColor) => void;
  onReset: () => void;
}) {
  return (
    <div className="practice-active-setup">
      <div className="practice-active-setup-head">
        <strong>Practice setup</strong>
        <button type="button" className="text-button practice-reset" onClick={onReset}>
          <Icon name="reset" /> Reset
        </button>
      </div>
      <div className="practice-play-as">
        <span>Play as</span>
        <SideChooser setup={setup} onSelect={onSelect} />
      </div>
      <label className="practice-inline-check practice-option-row">
        Include inaccuracies
        <input type="checkbox" checked={includeInaccuracies} onChange={(event) => onIncludeInaccuracies(event.target.checked)} />
      </label>
    </div>
  );
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
