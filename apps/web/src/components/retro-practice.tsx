"use client";

import { useMemo, useState } from "react";
import { practiceQueue, type PracticeQueue } from "@chess-review/analysis";
import type { GameAnalysisV2, PlayerColor } from "@chess-review/shared";
import type { RetroRuntime } from "../hooks/use-retrospect";
import { useReviewStore } from "../store/review-store";
import { useReviewRuntime } from "./review-runtime";

function sideName(color: PlayerColor): string {
  return color === "white" ? "White" : "Black";
}

export function RetroPractice({ analysis }: { analysis: GameAnalysisV2 }) {
  const runtime = useReviewRuntime();
  const retro = runtime.retro;
  const currentPly = useReviewStore((store) => store.currentPly);
  const branch = useReviewStore((store) => store.branch);
  const knownColor = runtime.record.preferredOrientation;
  const [color, setColor] = useState<PlayerColor>(knownColor ?? "white");

  const queue = useMemo(
    () => practiceQueue(analysis.moves, color, retro.includeInaccuracies),
    [analysis, color, retro.includeInaccuracies],
  );
  const whiteName = analysis.game.headers.White ?? "White";
  const blackName = analysis.game.headers.Black ?? "Black";
  const playerName = color === "white" ? whiteName : blackName;

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
    const count = queue.eligible.length;
    return <section className="retro-practice retro-idle" aria-label="Learn from your mistakes">
      <div className="retro-idle-row">
        <span className="retro-idle-who">{playerName} · {count === 1 ? "1 position" : `${count} positions`}</span>
        {(!knownColor || count === 0) && (
          <div className="practice-setup" role="group" aria-label="Which side to practise">
            <button type="button" className={color === "white" ? "secondary active" : "secondary"} onClick={() => setColor("white")}>White</button>
            <button type="button" className={color === "black" ? "secondary active" : "secondary"} onClick={() => setColor("black")}>Black</button>
          </div>
        )}
        <details className="practice-filters">
          <summary>Filters</summary>
          <label className="practice-inline-check">
            <input type="checkbox" checked={retro.includeInaccuracies} onChange={(event) => retro.setIncludeInaccuracies(event.target.checked)} />
            Include inaccuracies
          </label>
        </details>
        <button
          type="button"
          className="primary"
          disabled={count === 0}
          onClick={() => begin(color)}
        >
          Review {sideName(color)}&apos;s {count} {count === 1 ? "position" : "positions"}
        </button>
      </div>
      {count === 0 && <p className="utility-empty">{emptyCopy(queue, color)}</p>}
    </section>;
  }

  const total = retro.totalCount;
  const position = Math.min(retro.currentIndex + 1, Math.max(total, 1));
  const side = sideName(retro.color);
  const last = retro.currentIndex + 1 >= total;

  return <section className="retro-practice" aria-label="Learn from your mistakes">
    <header className="retro-head">
      <strong>Learn from your mistakes</strong>
      <span>{position} / {total}</span>
      <button type="button" className="text-button retro-close" onClick={() => retro.stop()}>Exit</button>
    </header>

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

function emptyCopy(queue: PracticeQueue<GameAnalysisV2["moves"][number]>, color: PlayerColor): string {
  const side = sideName(color);
  if (queue.excluded.length === 0) {
    return `No mistakes were recorded for ${side}.`;
  }
  const theory = queue.excluded.filter((item) => item.reason === "opening-theory").length;
  const evidence = queue.excluded.filter((item) => item.reason === "missing-engine-evidence").length;
  if (theory > 0 && evidence === 0) {
    return `${theory} ${theory === 1 ? "fault" : "faults"} for ${side} stayed inside recognised opening theory, so there is nothing to practise.`;
  }
  if (evidence > 0 && theory === 0) {
    return `Engine evidence is not ready for ${side}'s faults yet. Re-analyse the game, or try the other side.`;
  }
  return `${theory} opening-theory ${theory === 1 ? "fault" : "faults"} and ${evidence} without usable engine evidence were excluded for ${side}.`;
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
