"use client";

import { replayUciLine } from "@chess-review/chess-core";
import type { StockfishMoveAnalysis } from "@chess-review/shared";
import { useReviewRuntime } from "../review-runtime";
import { compareRecommendations, type AnalysisLens } from "../../lib/board-analysis-arrows";
import { humanLensServiceCopy } from "../../lib/human-lens-state";
import { useReviewStore } from "../../store/review-store";

const ELO_OPTIONS = [800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600] as const;

function percentage(value: number): string {
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
}

function sanForUci(fen: string, uci: string | undefined): string {
  if (!uci) return "—";
  try {
    return replayUciLine(fen, [uci])[0]?.san ?? uci;
  } catch {
    return uci;
  }
}

export function AnalysisLensPanel({ objective }: { objective: StockfishMoveAnalysis | null }) {
  const runtime = useReviewRuntime();
  const positionFen = useReviewStore((state) => state.positionFen);
  const result = runtime.humanPositionResult;
  const comparison = compareRecommendations(objective, result);
  const customTarget = !ELO_OPTIONS.some((value) => value === runtime.humanTargetElo);

  return (
    <div className="analysis-lens-panel">
      <div className="lens-toolbar">
        <div>
          <span className="kicker">Analysis lens</span>
          <strong>Choose the analysis shown here</strong>
        </div>
        <div className="lens-switch" role="group" aria-label="Analysis arrow lens">
          {(["objective", "human"] as AnalysisLens[]).map((lens) => (
            <button
              aria-pressed={runtime.analysisLens === lens}
              className={runtime.analysisLens === lens ? "active" : ""}
              key={lens}
              onClick={() => runtime.setAnalysisLens(lens)}
            >
              {lens === "objective" ? "Stockfish" : "Maia"}
            </button>
          ))}
        </div>
      </div>

      <div className="lens-legend" aria-label="Arrow source legend">
        <span><i className="objective" />Stockfish MultiPV</span>
        <span><i className="human" />Maia model probability @ {runtime.humanTargetElo}</span>
      </div>

      {runtime.analysisLens === "human" && (
        <div className="human-lens-content">
          <div className="human-lens-controls">
            <label>
              <span>Target Elo</span>
              <select value={runtime.humanTargetElo} onChange={(event) => runtime.setHumanTargetElo(Number(event.target.value))}>
                {customTarget && <option value={runtime.humanTargetElo}>{runtime.humanTargetElo} · saved</option>}
                {ELO_OPTIONS.map((elo) => <option value={elo} key={elo}>{elo}</option>)}
              </select>
            </label>
            <button
              className="secondary"
              disabled={runtime.humanPositionState === "running"}
              onClick={() => runtime.humanServiceState === "available" ? void runtime.analyzeHumanPosition() : void runtime.refreshHumanService()}
            >
              {runtime.humanPositionState === "running" ? "Running Maia…" : runtime.humanServiceState === "available" ? `Analyze with Maia @ ${runtime.humanTargetElo}` : "Check Maia service"}
            </button>
          </div>
          <p className="human-service-state" role="status"><i className={`service-dot ${runtime.humanServiceState}`} />{humanLensServiceCopy(runtime.humanServiceState)}</p>
          {runtime.humanPositionError && <p className="error">{runtime.humanPositionError}</p>}

          {result && (
            <>
              {comparison.status !== "insufficient" && (
                <div className={`recommendation-evidence ${comparison.status}`}>
                  <strong>{comparison.status === "agreement" ? "Stockfish and Maia recommend the same move" : "Objective and human recommendations diverge"}</strong>
                  <span>Stockfish: {sanForUci(positionFen, comparison.objectiveUci)} · Maia: {sanForUci(positionFen, comparison.humanUci)} {comparison.humanProbability === undefined ? "" : percentage(comparison.humanProbability)} @ {runtime.humanTargetElo}</span>
                  <small>
                    {comparison.objectiveRankForHuman === undefined ? "Maia's top choice is outside the displayed Stockfish candidates" : `Maia's top choice is Stockfish rank #${comparison.objectiveRankForHuman}`}
                    {comparison.humanProbabilityForObjective === undefined ? "" : ` · Stockfish's top choice has ${percentage(comparison.humanProbabilityForObjective)} Maia probability`}
                  </small>
                </div>
              )}
              {runtime.humanPlayedMove !== undefined && (
                <div className="played-probability">
                  <span>Next game move under Maia</span>
                  <strong>{percentage(result.playedMoveProbability)}</strong>
                  <small>{sanForUci(positionFen, runtime.humanPlayedMove)} · model prediction, not objective quality</small>
                </div>
              )}
              <div className="human-lens-candidates">
                {result.candidates.slice(0, runtime.continuationLines).map((candidate, index) => (
                  <button key={candidate.uci} onClick={() => runtime.playHumanCandidate(candidate.uci, candidate.probability)}>
                    <span>#{index + 1}</span><strong>{candidate.san}</strong><i><b style={{ width: percentage(candidate.probability) }} /></i><em>{percentage(candidate.probability)}</em>
                  </button>
                ))}
              </div>
              <small className="model-boundary">Maia-3 predicts Elo-conditioned human choices. Evaluation and move quality remain Stockfish-owned.</small>
            </>
          )}
        </div>
      )}
    </div>
  );
}
