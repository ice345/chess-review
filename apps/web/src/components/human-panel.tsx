"use client";

import { useMemo, useState } from "react";
import { humanFindDifficulty } from "@chess-review/analysis";
import type { HumanAnalysis, MoveAnalysis } from "@chess-review/shared";
import {
  analyzeMaiaMove,
  type MaiaAvailability,
  type MaiaModel,
} from "../lib/local-ai";
import { useLocalAiHealth } from "../lib/use-local-ai-health";

const ELO_OPTIONS = [800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600] as const;
const DIFFICULTY_LABELS = {
  natural: "Natural",
  findable: "Findable",
  hard: "Hard",
  "very-hard": "Very Hard",
  exceptional: "Exceptional",
} as const;

type ServiceState = "checking" | MaiaAvailability | "offline";

function percentage(value: number): string {
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
}

function engineScore(move: MoveAnalysis, uci: string): string {
  const score = move.stockfish.lines.find((line) => line.pv[0] === uci)?.score;
  if (!score) return "—";
  if (score.kind === "mate") return score.mateIn > 0 ? `M${score.mateIn}` : `−M${Math.abs(score.mateIn)}`;
  const pawns = score.cp / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}

function serviceMessage(state: ServiceState): string {
  if (state === "checking") return "Checking the optional local service…";
  if (state === "available") return "Maia-3 is ready in Enhanced Local Mode.";
  if (state === "not-installed") return "Local service found; install Maia with `uv sync --extra maia`.";
  if (state === "error") return "Maia initialization failed. Restart the local service after checking its log.";
  return "Human model offline · start it with pnpm dev. This page reconnects automatically.";
}

export function HumanPanel({
  move,
  isForcing,
  onUpdate,
}: {
  move: MoveAnalysis | null;
  isForcing: boolean;
  onUpdate: (human: HumanAnalysis) => void;
}) {
  const localAi = useLocalAiHealth();
  const serviceState: ServiceState = localAi.state === "checking"
    ? "checking"
    : localAi.health?.maia ?? "offline";
  const [ratingOption, setRatingOption] = useState("1400");
  const [customElo, setCustomElo] = useState(1400);
  const [model, setModel] = useState<MaiaModel>("maia3-5m");
  const [requestState, setRequestState] = useState<"idle" | "running">("idle");
  const [error, setError] = useState<string | null>(null);

  const targetElo = ratingOption === "custom" ? customElo : Number(ratingOption);
  const human = move?.human;
  const comparisonRows = useMemo(() => {
    if (!move || !human) return [];
    const uciMoves = new Set([
      ...move.stockfish.lines.map((line) => line.pv[0]).filter((uci): uci is string => uci !== undefined),
      ...human.candidates.map((candidate) => candidate.uci),
    ]);
    return [...uciMoves].slice(0, 8).map((uci) => ({
      uci,
      san: human.candidates.find((candidate) => candidate.uci === uci)?.san ?? uci,
      stockfishRank: move.stockfish.lines.find((line) => line.pv[0] === uci)?.rank,
      maiaProbability: human.candidates.find((candidate) => candidate.uci === uci)?.probability,
    }));
  }, [human, move]);

  async function analyze() {
    if (!move || serviceState !== "available") return;
    setRequestState("running");
    setError(null);
    try {
      const response = await analyzeMaiaMove({
        fen: move.fenBefore,
        targetElo,
        selfElo: targetElo,
        opponentElo: targetElo,
        playedMove: move.uci,
        multiPv: 5,
        model,
      });
      const findDifficulty = humanFindDifficulty({
        playedMoveProbability: response.playedMoveProbability,
        legalMoveCount: move.classificationReason.legalMoveCount,
        ...(move.classificationReason.secondBestGapCp === undefined
          ? {}
          : { secondBestGapCp: move.classificationReason.secondBestGapCp }),
        ...(move.classificationReason.secondBestGapWinPercent === undefined
          ? {}
          : { secondBestGapWinPercent: move.classificationReason.secondBestGapWinPercent }),
        isEngineBest: move.classificationReason.isEngineBest,
        isForced: move.classificationReason.isForced,
        isForcing,
        isSacrifice: move.classificationReason.sacrifice?.genuine === true,
        tacticalMotifCount: move.motifs.length,
      });
      onUpdate({ ...response, findDifficulty });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Maia analysis failed.");
    } finally {
      setRequestState("idle");
    }
  }

  return (
    <div className="human-tab">
      <div className="human-boundary">
        <span>Maia-3 · Elo-conditioned prediction</span>
        <span className={`service-dot ${serviceState}`} />
      </div>
      <p className="service-message">{serviceMessage(serviceState)}</p>
      {serviceState !== "available" && (
        <button className="text-button refresh-service" onClick={() => void localAi.refresh()}>Check again</button>
      )}

      <div className="human-controls">
        <label>
          <span>Target Elo</span>
          <select value={ratingOption} onChange={(event) => setRatingOption(event.target.value)}>
            {ELO_OPTIONS.map((elo) => <option value={elo} key={elo}>{elo}</option>)}
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>
          <span>Model</span>
          <select value={model} onChange={(event) => setModel(event.target.value as MaiaModel)}>
            <option value="maia3-5m">Maia3 5M · CPU</option>
            <option value="maia3-23m">Maia3 23M</option>
            <option value="maia3-79m">Maia3 79M</option>
          </select>
        </label>
        {ratingOption === "custom" && (
          <label className="custom-elo">
            <span>Custom Elo</span>
            <input type="number" min={400} max={3000} value={customElo} onChange={(event) => setCustomElo(Number(event.target.value))} />
          </label>
        )}
      </div>
      <button
        className="primary"
        disabled={!move || serviceState !== "available" || requestState === "running" || targetElo < 400 || targetElo > 3000}
        onClick={() => void analyze()}
      >
        {requestState === "running" ? "Running Maia…" : move ? `Analyze ${move.san} as a human move` : "Select a reviewed move"}
      </button>
      {error && <p className="error">{error}</p>}

      {human && move && (
        <>
          <div className="human-result-heading">
            <div><span>Played move probability</span><strong>{percentage(human.playedMoveProbability)}</strong></div>
            <div><span>Human Find Difficulty</span><strong className={`difficulty ${human.findDifficulty.label}`}>{DIFFICULTY_LABELS[human.findDifficulty.label]}</strong></div>
          </div>
          <p className="experimental-note">Experimental heuristic · score {human.findDifficulty.score}/100 · not an Elo measurement</p>

          <div className="human-candidates">
            <div className="eyebrow">CANDIDATE POLICY @ {human.targetElo}</div>
            {human.candidates.map((candidate, index) => (
              <div className={candidate.uci === move.uci ? "played" : ""} key={candidate.uci}>
                <span>#{index + 1}</span><strong>{candidate.san}</strong><small>{candidate.uci}</small>
                <i><b style={{ width: percentage(candidate.probability) }} /></i>
                <em>{percentage(candidate.probability)}</em>
              </div>
            ))}
            <small className="probability-mass">Displayed probability mass {percentage(human.candidateProbabilityMass)}; probabilities are raw Maia policy outputs.</small>
          </div>

          {human.humanWdl && (
            <div className="human-wdl">
              <span><small>Win</small><strong>{percentage(human.humanWdl.win)}</strong></span>
              <span><small>Draw</small><strong>{percentage(human.humanWdl.draw)}</strong></span>
              <span><small>Loss</small><strong>{percentage(human.humanWdl.loss)}</strong></span>
            </div>
          )}

          <div className="dual-analysis">
            <div className="eyebrow">STOCKFISH / MAIA</div>
            <div className="dual-head"><span>Move</span><span>SF rank</span><span>White POV</span><span>Maia</span></div>
            {comparisonRows.map((row) => (
              <div className={row.uci === move.uci ? "played" : ""} key={row.uci}>
                <strong>{row.san}</strong>
                <span>{row.stockfishRank === undefined ? "—" : `#${row.stockfishRank}`}</span>
                <span>{engineScore(move, row.uci)}</span>
                <span>{row.maiaProbability === undefined ? "—" : percentage(row.maiaProbability)}</span>
              </div>
            ))}
          </div>

          <details className="difficulty-evidence">
            <summary>Why this difficulty?</summary>
            <span>Maia band: {human.findDifficulty.evidence.probabilityBand.replaceAll("-", " ")}</span>
            <span>Legal moves: {human.findDifficulty.evidence.legalMoveCount}</span>
            {human.findDifficulty.evidence.adjustments.map((adjustment) => (
              <span key={adjustment.factor}>{adjustment.factor.replaceAll("-", " ")}: {adjustment.points > 0 ? "+" : ""}{adjustment.points}</span>
            ))}
          </details>
        </>
      )}
    </div>
  );
}
