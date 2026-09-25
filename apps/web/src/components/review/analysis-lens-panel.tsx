"use client";

import Link from "next/link";
import { replayUciLine } from "@chess-review/chess-core";
import type { MaiaModel, StockfishMoveAnalysis, UiLanguage } from "@chess-review/shared";
import { useReviewRuntime } from "../review-runtime";
import {
  compareRecommendations,
  humanCandidateIdentity,
  overlappingCandidateUcis,
  type AnalysisMode,
} from "../../lib/board-analysis-arrows";
import { humanLensServiceCopy } from "../../lib/human-lens-state";
import { useReviewStore } from "../../store/review-store";
import { useUiLanguage } from "../../hooks/use-ui-language";

const ELO_OPTIONS = [800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600] as const;
const MODES: AnalysisMode[] = ["stockfish", "maia", "compare"];

type LensCopy = {
  sourceAria: string;
  stockfish: string;
  maiaElo: (elo: number) => string;
  compare: string;
  quickSettingsAria: string;
  maiaSettings: string;
  targetElo: string;
  savedElo: (elo: number) => string;
  maiaModel: string;
  modelFastest: string;
  modelBalanced: string;
  modelHeavy: string;
  running: string;
  refresh: string;
  downloading: string;
  download: string;
  enhancedHelp: string;
  checkService: string;
  modelIs: (model: string, state: string) => string;
  practiceHidden: string;
  humanWdl: string;
  whiteToMove: string;
  blackToMove: string;
  win: string;
  draw: string;
  loss: string;
  agreement: string;
  diverge: string;
  compareLine: (stockfish: string, maia: string, probability: string) => string;
  maiaOutside: string;
  maiaRank: (rank: number) => string;
  stockfishMaiaProb: (probability: string) => string;
  overlaps: (count: number) => string;
  candidatesAria: string;
  candidateAria: (rank: number, uci: string) => string;
  wdl: (win: string, draw: string, loss: string) => string;
  boundary: (model: string, elo: number) => string;
};

const COPY: Record<UiLanguage, LensCopy> = {
  en: {
    sourceAria: "Analysis source",
    stockfish: "Stockfish",
    maiaElo: (elo) => `Maia \u00b7 ${elo}`,
    compare: "Compare",
    quickSettingsAria: "Maia quick settings",
    maiaSettings: "Maia settings",
    targetElo: "Target Elo",
    savedElo: (elo) => `${elo} \u00b7 saved`,
    maiaModel: "Maia model",
    modelFastest: "Maia-3 5M \u00b7 Fastest",
    modelBalanced: "Maia-3 23M \u00b7 Balanced",
    modelHeavy: "Maia-3 79M \u00b7 Heavy",
    running: "Running Maia analysis\u2026",
    refresh: "Refresh Maia analysis",
    downloading: "Downloading model\u2026",
    download: "Download selected model",
    enhancedHelp: "Enhanced Local help \u2192",
    checkService: "Check Maia service",
    modelIs: (model, state) => `${model} is ${state}`,
    practiceHidden: "Human-model candidates are hidden while you solve this position.",
    humanWdl: "Maia human-game WDL",
    whiteToMove: "White to move",
    blackToMove: "Black to move",
    win: "Win",
    draw: "Draw",
    loss: "Loss",
    agreement: "Stockfish and Maia recommend the same move",
    diverge: "Objective and human recommendations diverge",
    compareLine: (stockfish, maia, probability) => `Stockfish: ${stockfish} \u00b7 Maia: ${maia} ${probability}`,
    maiaOutside: "Maia's top choice is outside displayed Stockfish candidates",
    maiaRank: (rank) => "Maia's top choice is Stockfish rank #" + rank,
    stockfishMaiaProb: (probability) => " \u00b7 Stockfish top choice has " + probability + " Maia probability",
    overlaps: (count) => `${count} exact UCI arrow overlap${count === 1 ? "" : "s"}`,
    candidatesAria: "Maia human candidates",
    candidateAria: (rank, uci) => `Maia candidate #${rank} ${uci}`,
    wdl: (win, draw, loss) => `W/D/L ${win} / ${draw} / ${loss}`,
    boundary: (model, elo) => `${model} @ ${elo} predicts human choices and outcomes. It never emits objective centipawns or Move Quality.`,
  },
  "zh-CN": {
    sourceAria: "分析来源",
    stockfish: "Stockfish",
    maiaElo: (elo) => `Maia · ${elo}`,
    compare: "比较",
    quickSettingsAria: "Maia 快捷设置",
    maiaSettings: "Maia 设置",
    targetElo: "目标 Elo",
    savedElo: (elo) => `${elo} · 已保存`,
    maiaModel: "Maia 模型",
    modelFastest: "Maia-3 5M · 最快",
    modelBalanced: "Maia-3 23M · 均衡",
    modelHeavy: "Maia-3 79M · 较重",
    running: "正在运行 Maia 分析…",
    refresh: "刷新 Maia 分析",
    downloading: "正在下载模型…",
    download: "下载所选模型",
    enhancedHelp: "本地增强帮助 →",
    checkService: "检查 Maia 服务",
    modelIs: (model, state) => `${model} 状态为 ${state}`,
    practiceHidden: "解题时隐藏人类模型候选着。",
    humanWdl: "Maia 人类对局 WDL",
    whiteToMove: "白方走棋",
    blackToMove: "黑方走棋",
    win: "胜",
    draw: "和",
    loss: "负",
    agreement: "Stockfish 与 Maia 推荐同一着",
    diverge: "客观推荐与人类推荐不一致",
    compareLine: (stockfish, maia, probability) => `Stockfish：${stockfish} · Maia：${maia} ${probability}`,
    maiaOutside: "Maia 首选不在当前显示的 Stockfish 候选中",
    maiaRank: (rank) => "Maia 首选是 Stockfish 第 #" + rank + " 候选",
    stockfishMaiaProb: (probability) => " · Stockfish 首选的 Maia 概率为 " + probability,
    overlaps: (count) => `${count} 处完全重合的 UCI 箭头`,
    candidatesAria: "Maia 人类候选着",
    candidateAria: (rank, uci) => `Maia 候选 #${rank} ${uci}`,
    wdl: (win, draw, loss) => `胜/和/负 ${win} / ${draw} / ${loss}`,
    boundary: (model, elo) => `${model} @ ${elo} 预测人类选择和结果。它从不给出客观百分兵或着法质量。`,
  },
};

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
  const language = useUiLanguage();
  const copy = COPY[language];
  const runtime = useReviewRuntime();
  const positionFen = useReviewStore((state) => state.positionFen);
  const result = runtime.humanPositionResult;
  const comparison = compareRecommendations(objective, result);
  const customTarget = !ELO_OPTIONS.some((value) => value === runtime.humanTargetElo);
  const showHuman = runtime.analysisMode !== "stockfish";
  const modelReady = runtime.humanModelState === "active" || runtime.humanModelState === "cached";
  const overlaps = overlappingCandidateUcis(objective, result, runtime.continuationLines);
  const modelLabels: Record<MaiaModel, string> = {
    "maia3-5m": copy.modelFastest,
    "maia3-23m": copy.modelBalanced,
    "maia3-79m": copy.modelHeavy,
  };

  return (
    <div className="analysis-lens-panel">
      <div className="lens-toolbar">
        <div className="lens-switch" role="group" aria-label={copy.sourceAria}>
          {MODES.map((value) => (
            <button
              type="button"
              aria-pressed={runtime.analysisMode === value}
              className={runtime.analysisMode === value ? "active" : ""}
              key={value}
              onClick={() => runtime.setAnalysisMode(value)}
            >
              {value === "stockfish" ? copy.stockfish : value === "maia" ? copy.maiaElo(runtime.humanTargetElo) : copy.compare}
            </button>
          ))}
        </div>
        {showHuman && (
          <details className="human-quick-settings">
            <summary aria-label={copy.quickSettingsAria}>{copy.maiaSettings}</summary>
            <div className="human-lens-controls">
              <label>
                <span>{copy.targetElo}</span>
                <select value={runtime.humanTargetElo} onChange={(event) => runtime.setHumanTargetElo(Number(event.target.value))}>
                  {customTarget && <option value={runtime.humanTargetElo}>{copy.savedElo(runtime.humanTargetElo)}</option>}
                  {ELO_OPTIONS.map((elo) => <option value={elo} key={elo}>{elo}</option>)}
                </select>
              </label>
              <label>
                <span>{copy.maiaModel}</span>
                <select value={runtime.humanModel} onChange={(event) => runtime.setHumanModel(event.target.value as MaiaModel)}>
                  {(Object.keys(modelLabels) as MaiaModel[]).map((value) => <option value={value} key={value}>{modelLabels[value]}</option>)}
                </select>
              </label>
              {modelReady ? (
                <button
                  type="button"
                  className="secondary"
                  disabled={runtime.humanPositionState === "running"}
                  onClick={() => runtime.humanServiceState === "available" ? void runtime.analyzeHumanPosition() : void runtime.refreshHumanService()}
                >
                  {runtime.humanPositionState === "running" ? copy.running : copy.refresh}
                </button>
              ) : runtime.humanServiceState === "available" ? (
                <button
                  type="button"
                  className="secondary model-download"
                  disabled={runtime.humanModelSetupState === "running"}
                  onClick={() => void runtime.setupHumanModel()}
                >
                  {runtime.humanModelSetupState === "running" ? copy.downloading : copy.download}
                </button>
              ) : (
                runtime.humanServiceState === "not-provided" || runtime.humanServiceState === "not-configured"
                  ? <Link className="text-button" href="/help#enhanced-local">{copy.enhancedHelp}</Link>
                  : <button type="button" className="secondary" onClick={() => void runtime.refreshHumanService()}>{copy.checkService}</button>
              )}
            </div>
          </details>
        )}
      </div>


      {showHuman && (
        <div className="human-lens-content">
          <p className="human-service-state" role="status">
            <i className={"service-dot " + runtime.humanServiceState} />
            {humanLensServiceCopy(runtime.humanServiceState, language)} · {copy.modelIs(runtime.humanModel, runtime.humanModelState)}
          </p>
          {runtime.humanPositionError && <p className="error">{runtime.humanPositionError}</p>}

          {/* Practice hides the position's evidence, and Maia's ranked candidates
              are evidence about the position the visitor is being asked to solve.
              They also play on click, so they must not be reachable mid-answer. */}
          {runtime.retro.locked && <p className="utility-note" role="status">{copy.practiceHidden}</p>}

          {result && !runtime.retro.locked && (
            <>
              <div className="human-root-wdl">
                <div><span>{copy.humanWdl}</span><strong>{result.sideToMove === "white" ? copy.whiteToMove : copy.blackToMove}</strong></div>
                <span><small>{copy.win}</small><b>{percentage(result.rootWdl.win)}</b></span>
                <span><small>{copy.draw}</small><b>{percentage(result.rootWdl.draw)}</b></span>
                <span><small>{copy.loss}</small><b>{percentage(result.rootWdl.loss)}</b></span>
              </div>
              {runtime.analysisMode === "compare" && comparison.status !== "insufficient" && (
                <div className={"recommendation-evidence " + comparison.status}>
                  <strong>{comparison.status === "agreement" ? copy.agreement : copy.diverge}</strong>
                  <span>{copy.compareLine(sanForUci(positionFen, comparison.objectiveUci), sanForUci(positionFen, comparison.humanUci), comparison.humanProbability === undefined ? "" : percentage(comparison.humanProbability))}</span>
                  <small>
                    {comparison.objectiveRankForHuman === undefined ? copy.maiaOutside : copy.maiaRank(comparison.objectiveRankForHuman)}
                    {comparison.humanProbabilityForObjective === undefined ? "" : copy.stockfishMaiaProb(percentage(comparison.humanProbabilityForObjective))}
                  </small>
                  <small data-testid="compare-arrow-overlap">{copy.overlaps(overlaps.length)}</small>
                </div>
              )}
              <div className="human-lens-candidates" aria-label={copy.candidatesAria}>
                {result.candidates.slice(0, runtime.continuationLines).map((candidate) => {
                  const identity = humanCandidateIdentity(result, candidate);
                  return (
                  <button
                    type="button"
                    aria-label={copy.candidateAria(candidate.policyRank, candidate.uci)}
                    data-candidate-uci={candidate.uci}
                    key={candidate.uci}
                    onClick={() => runtime.playHumanCandidate(identity)}
                  >
                    <span>#{candidate.policyRank}</span>
                    <strong>{candidate.san}</strong>
                    <i><b style={{ width: percentage(candidate.probability) }} /></i>
                    <em>{percentage(candidate.probability)}</em>
                    <code>{candidate.uci}</code>
                    {candidate.wdl && <small>{copy.wdl(percentage(candidate.wdl.win), percentage(candidate.wdl.draw), percentage(candidate.wdl.loss))}</small>}
                  </button>
                  );
                })}
              </div>
              <small className="model-boundary">{copy.boundary(runtime.humanModel, runtime.humanTargetElo)}</small>
            </>
          )}
        </div>
      )}
    </div>
  );
}
