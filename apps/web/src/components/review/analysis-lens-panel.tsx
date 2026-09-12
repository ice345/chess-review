"use client";

import Link from "next/link";
import { replayUciLine } from "@chess-review/chess-core";
import type { MaiaModel, StockfishMoveAnalysis } from "@chess-review/shared";
import { useReviewRuntime } from "../review-runtime";
import {
  compareRecommendations,
  humanCandidateIdentity,
  overlappingCandidateUcis,
  type AnalysisMode,
} from "../../lib/board-analysis-arrows";
import { humanLensServiceCopy } from "../../lib/human-lens-state";
import { useReviewStore } from "../../store/review-store";

const ELO_OPTIONS = [800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600] as const;
const MODES: AnalysisMode[] = ["stockfish", "maia", "compare"];
const MODELS: Array<{ value: MaiaModel; label: string }> = [
  { value: "maia3-5m", label: "Maia-3 5M · Fastest" },
  { value: "maia3-23m", label: "Maia-3 23M · Balanced" },
  { value: "maia3-79m", label: "Maia-3 79M · Heavy" },
];

function percentage(value: number): string {
  return (value * 100).toFixed(value < 0.1 ? 1 : 0) + "%";
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
  const showHuman = runtime.analysisMode !== "stockfish";
  const modelReady = runtime.humanModelState === "active" || runtime.humanModelState === "cached";
  const overlaps = overlappingCandidateUcis(objective, result, runtime.continuationLines);

  return (
    <div className="analysis-lens-panel">
      <div className="lens-toolbar">
        <div className="lens-switch" role="group" aria-label="Analysis source">
          {MODES.map((value) => (
            <button
              type="button"
              aria-pressed={runtime.analysisMode === value}
              className={runtime.analysisMode === value ? "active" : ""}
              key={value}
              onClick={() => runtime.setAnalysisMode(value)}
            >
              {value === "stockfish" ? "Stockfish" : value === "maia" ? `Maia · ${runtime.humanTargetElo}` : "Compare"}
            </button>
          ))}
        </div>
        {showHuman && (
          <details className="human-quick-settings">
            <summary aria-label="Maia quick settings">Maia settings</summary>
            <div className="human-lens-controls">
              <label>
                <span>Target Elo</span>
                <select value={runtime.humanTargetElo} onChange={(event) => runtime.setHumanTargetElo(Number(event.target.value))}>
                  {customTarget && <option value={runtime.humanTargetElo}>{runtime.humanTargetElo} · saved</option>}
                  {ELO_OPTIONS.map((elo) => <option value={elo} key={elo}>{elo}</option>)}
                </select>
              </label>
              <label>
                <span>Maia model</span>
                <select value={runtime.humanModel} onChange={(event) => runtime.setHumanModel(event.target.value as MaiaModel)}>
                  {MODELS.map((model) => <option value={model.value} key={model.value}>{model.label}</option>)}
                </select>
              </label>
              {modelReady ? (
                <button
                  type="button"
                  className="secondary"
                  disabled={runtime.humanPositionState === "running"}
                  onClick={() => runtime.humanServiceState === "available" ? void runtime.analyzeHumanPosition() : void runtime.refreshHumanService()}
                >
                  {runtime.humanPositionState === "running" ? "Running Maia analysis…" : "Refresh Maia analysis"}
                </button>
              ) : runtime.humanServiceState === "available" ? (
                <button
                  type="button"
                  className="secondary model-download"
                  disabled={runtime.humanModelSetupState === "running"}
                  onClick={() => void runtime.setupHumanModel()}
                >
                  {runtime.humanModelSetupState === "running" ? "Downloading model…" : "Download selected model"}
                </button>
              ) : (
                runtime.humanServiceState === "not-provided" || runtime.humanServiceState === "not-configured"
                  ? <Link className="text-button" href="/help#enhanced-local">Enhanced Local help →</Link>
                  : <button type="button" className="secondary" onClick={() => void runtime.refreshHumanService()}>Check Maia service</button>
              )}
            </div>
          </details>
        )}
      </div>


      {showHuman && (
        <div className="human-lens-content">
          <p className="human-service-state" role="status">
            <i className={"service-dot " + runtime.humanServiceState} />
            {humanLensServiceCopy(runtime.humanServiceState)} · {runtime.humanModel} is {runtime.humanModelState}
          </p>
          {runtime.humanPositionError && <p className="error">{runtime.humanPositionError}</p>}

          {/* Practice hides the position's evidence, and Maia's ranked candidates
              are evidence about the position the visitor is being asked to solve.
              They also play on click, so they must not be reachable mid-answer. */}
          {runtime.retro.locked && <p className="utility-empty" role="status">Human-model candidates are hidden while you solve this position.</p>}

          {result && !runtime.retro.locked && (
            <>
              <div className="human-root-wdl">
                <div><span>Maia human-game WDL</span><strong>{result.sideToMove === "white" ? "White" : "Black"} to move</strong></div>
                <span><small>Win</small><b>{percentage(result.rootWdl.win)}</b></span>
                <span><small>Draw</small><b>{percentage(result.rootWdl.draw)}</b></span>
                <span><small>Loss</small><b>{percentage(result.rootWdl.loss)}</b></span>
              </div>
              {runtime.analysisMode === "compare" && comparison.status !== "insufficient" && (
                <div className={"recommendation-evidence " + comparison.status}>
                  <strong>{comparison.status === "agreement" ? "Stockfish and Maia recommend the same move" : "Objective and human recommendations diverge"}</strong>
                  <span>Stockfish: {sanForUci(positionFen, comparison.objectiveUci)} · Maia: {sanForUci(positionFen, comparison.humanUci)} {comparison.humanProbability === undefined ? "" : percentage(comparison.humanProbability)}</span>
                  <small>
                    {comparison.objectiveRankForHuman === undefined ? "Maia's top choice is outside displayed Stockfish candidates" : "Maia's top choice is Stockfish rank #" + comparison.objectiveRankForHuman}
                    {comparison.humanProbabilityForObjective === undefined ? "" : " · Stockfish top choice has " + percentage(comparison.humanProbabilityForObjective) + " Maia probability"}
                  </small>
                  <small data-testid="compare-arrow-overlap">{overlaps.length} exact UCI arrow overlap{overlaps.length === 1 ? "" : "s"}</small>
                </div>
              )}
              <div className="human-lens-candidates" aria-label="Maia human candidates">
                {result.candidates.slice(0, runtime.continuationLines).map((candidate) => {
                  const identity = humanCandidateIdentity(result, candidate);
                  return (
                  <button
                    type="button"
                    aria-label={`Maia candidate #${candidate.policyRank} ${candidate.uci}`}
                    data-candidate-uci={candidate.uci}
                    key={candidate.uci}
                    onClick={() => runtime.playHumanCandidate(identity)}
                  >
                    <span>#{candidate.policyRank}</span>
                    <strong>{candidate.san}</strong>
                    <i><b style={{ width: percentage(candidate.probability) }} /></i>
                    <em>{percentage(candidate.probability)}</em>
                    <code>{candidate.uci}</code>
                    {candidate.wdl && <small>W/D/L {percentage(candidate.wdl.win)} / {percentage(candidate.wdl.draw)} / {percentage(candidate.wdl.loss)}</small>}
                  </button>
                  );
                })}
              </div>
              <small className="model-boundary">{runtime.humanModel} @ {runtime.humanTargetElo} predicts human choices and outcomes. It never emits objective centipawns or Move Quality.</small>
            </>
          )}
        </div>
      )}
    </div>
  );
}
