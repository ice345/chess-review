"use client";

import Link from "next/link";
import { useState } from "react";
import { replayUciLine } from "@chess-review/chess-core";
import { QUALITY_META, QualityIcon } from "@chess-review/ui";
import { CoachPanel } from "./coach-panel";
import { AnalysisLensPanel } from "./review/analysis-lens-panel";
import { ReviewMoves, ReviewOverview } from "./review-presentation";
import { useReviewRuntime } from "./review-runtime";
import { formatEngineScore } from "../lib/review-format";
import { selectedBranchNode } from "../lib/analysis-branch";
import { useReviewStore } from "../store/review-store";

function AnalysisGate({ section }: { section: string }) {
  const runtime = useReviewRuntime();
  return (
    <div className="analysis-gate">
      <span className="kicker">{section}</span>
      <h1>{runtime.record.kind === "fen" ? "Game facts are not available for a FEN study" : "Run the objective review first"}</h1>
      <p>{runtime.record.kind === "fen" ? "Use Engine Lab for this explicit position. PGN history is required for move quality, Accuracy, Human and Coach routes." : "Stockfish will build the canonical facts that every other section consumes."}</p>
      {runtime.record.kind === "fen" ? <Link className="primary-link" href={`/review/${runtime.gameId}/engine`}>Open Engine Lab →</Link> : runtime.reviewState === "running" ? (
        <div className="progress-card"><progress value={runtime.reviewProgress?.completed ?? 0} max={Math.max(1, runtime.reviewProgress?.total ?? 1)} /><span>{runtime.reviewProgress?.completed ?? 0}/{runtime.reviewProgress?.total ?? "?"} positions</span><button className="secondary" onClick={runtime.cancelFullGame}>Cancel</button></div>
      ) : <button className="primary" onClick={() => void runtime.analyzeFullGame()}>Analyze game</button>}
      {runtime.reviewError && <p className="error" role="alert">{runtime.reviewError}</p>}
    </div>
  );
}

function PositionAnalysis() {
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  const positionFen = useReviewStore((store) => store.positionFen);
  const branch = useReviewStore((store) => store.branch);
  const returnToGame = useReviewStore((store) => store.returnToGame);
  const canonical = branch ? null : analysis?.moves[currentPly]?.stockfish ?? null;
  const result = runtime.continuationResult ?? canonical;
  const rootFen = positionFen;
  const lines = result?.lines.slice(0, runtime.continuationLines) ?? [];
  const selectedRank = branch
    ? selectedBranchNode(branch).sources.find((source) => source.kind === "stockfish")?.rank
    : undefined;

  return (
    <section className="position-analysis">
      <AnalysisLensPanel objective={result} />
      {branch && (
        <div className="variation-banner"><span>Analysis branch · root ply {branch.rootPly} · {branch.selectedIndex}/{branch.activePath.length - 1}</span><button className="text-button" onClick={returnToGame}>Return to game <kbd>Esc</kbd></button></div>
      )}
      {runtime.analysisLens === "objective" && <div className="continuation-list" aria-label="Stockfish continuations">
        {lines.map((line) => {
          const san = (() => {
            try {
              return replayUciLine(rootFen, line.pv).slice(0, runtime.continuationLength).map((move) => move.san);
            } catch {
              return line.pv.slice(0, runtime.continuationLength);
            }
          })();
          return (
            <button className={selectedRank === line.rank ? "active" : ""} key={line.rank} onClick={() => runtime.playContinuation(line.rank, result)}>
              <span className="line-rank">{line.rank}</span>
              <strong>{formatEngineScore(line.score)}</strong>
              <span className="line-moves">{san.join(" ")}</span>
              <small>Explore →</small>
            </button>
          );
        })}
        {lines.length === 0 && <p className="continuation-empty">{runtime.continuationState === "running" ? "Analyzing this position…" : "Stockfish candidates appear here when this position is analyzed."}</p>}
      </div>}
      {runtime.analysisLens === "objective" && runtime.continuationError && <p className="error">{runtime.continuationError} <button className="text-button" onClick={() => void runtime.analyzeContinuations()}>Retry</button></p>}
    </section>
  );
}

export function ObjectiveRoutePanel() {
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  if (!analysis) return <div className="route-panel objective-route"><PositionAnalysis /><AnalysisGate section="Objective review" /></div>;
  const move = currentPly === 0 ? null : analysis.moves[currentPly - 1] ?? null;
  return (
    <div className="route-panel objective-route">
      <div className="route-heading"><span className="kicker">Objective review</span><h1>What happened?</h1><p>Engine truth first; interpretation comes later.</p></div>
      {move && <section className="position-verdict-card"><QualityIcon classification={move.classification} size={38} /><div><span>{move.ply}. {move.san}</span><strong>{QUALITY_META[move.classification].label}</strong><small>Objective move quality · Stockfish · Accuracy {move.accuracy.toFixed(1)} · {formatEngineScore(move.evaluationBefore)} → {formatEngineScore(move.playedMoveScore)}</small></div><details><summary>Why this label?</summary><p>{move.classificationReason.precedenceRule.replaceAll("-", " ")} · Win% loss {move.classificationReason.winPercentLoss.toFixed(1)}</p></details></section>}
      <PositionAnalysis />
      <ReviewOverview analysis={analysis} onSelectPly={runtime.navigateToPly} allMomentsHref={`/review/${runtime.gameId}/moves`} />
    </div>
  );
}

export function MovesRoutePanel() {
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  const [filter, setFilter] = useState<"all" | "critical" | "errors">("all");
  if (!analysis) return <AnalysisGate section="Move explorer" />;
  const move = currentPly === 0 ? null : analysis.moves[currentPly - 1] ?? null;
  return (
    <div className="route-panel moves-route">
      <div className="route-heading"><span className="kicker">Move explorer</span><h1>Every decision, in context</h1></div>
      <div className="move-filters" aria-label="Move filters">{(["all", "critical", "errors"] as const).map((value) => <button className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{value}</button>)}</div>
      <ReviewMoves analysis={analysis} currentPly={currentPly} onSelectPly={runtime.navigateToPly} filter={filter} />
      {move && <section className="move-evidence"><div><QualityIcon classification={move.classification} size={28} /><span><strong>{move.san} · {QUALITY_META[move.classification].label}</strong><small>{move.phase} · Accuracy {move.accuracy.toFixed(1)}</small></span></div><dl><div><dt>Rule</dt><dd>{move.classificationReason.precedenceRule.replaceAll("-", " ")}</dd></div><div><dt>Engine rank</dt><dd>{move.classificationReason.engineRank === undefined ? "Outside MultiPV" : `#${move.classificationReason.engineRank}`}</dd></div><div><dt>Win% loss</dt><dd>{move.classificationReason.winPercentLoss.toFixed(1)}</dd></div><div><dt>Legal choices</dt><dd>{move.classificationReason.legalMoveCount}</dd></div></dl>{move.classificationReason.exclusions.length > 0 && <small>Exclusions · {move.classificationReason.exclusions.join(", ")}</small>}</section>}
    </div>
  );
}

export function CoachRoutePanel() {
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  const setMoveCoach = useReviewStore((store) => store.setMoveCoach);
  const setGameCoachSummary = useReviewStore((store) => store.setGameCoachSummary);
  if (!analysis) return <AnalysisGate section="AI coach" />;
  const move = currentPly === 0 ? null : analysis.moves[currentPly - 1] ?? null;
  return (
    <div className="route-panel coach-route">
      <div className="route-heading"><span className="kicker">Coach</span><h1>Turn this position into a lesson</h1><p>Explanations stay inside the facts already verified by Stockfish, Maia and the rules layer.</p></div>
      <CoachPanel analysis={analysis} move={move} onMoveUpdate={(coach) => move && runtime.persistEnrichedAnalysis(setMoveCoach(move.ply, coach))} onGameUpdate={(summary) => runtime.persistEnrichedAnalysis(setGameCoachSummary(summary))} onSelectPly={runtime.navigateToPly} />
    </div>
  );
}

export function EngineRoutePanel() {
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  const result = runtime.engineResult ?? analysis?.moves[currentPly]?.stockfish ?? null;
  return (
    <div className="route-panel engine-route">
      <div className="route-heading"><span className="kicker">Advanced</span><h1>Engine Lab</h1><p>Raw Stockfish controls and diagnostics, kept outside the ordinary review flow.</p></div>
      <section className="engine-config"><label>Depth<select value={runtime.reviewDepth} disabled={runtime.reviewState === "running"} onChange={(event) => runtime.setReviewDepth(Number(event.target.value) as 10 | 12 | 15)}><option value={10}>10</option><option value={12}>12</option><option value={15}>15</option></select></label><label>MultiPV<select value={runtime.reviewMultiPv} disabled={runtime.reviewState === "running"} onChange={(event) => runtime.setReviewMultiPv(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label></section>
      <div className="engine-actions"><button className="primary" disabled={runtime.engineState === "running"} onClick={() => void runtime.analyzePosition()}>{runtime.engineState === "running" ? "Analyzing position…" : "Analyze current position"}</button>{runtime.record.kind === "pgn" && (runtime.reviewState === "running" ? <button className="secondary" onClick={runtime.cancelFullGame}>Cancel game review</button> : <button className="secondary" onClick={() => void runtime.analyzeFullGame()}>Re-analyze full game</button>)}</div>
      {(runtime.engineError || runtime.reviewError) && <p className="error">{runtime.engineError ?? runtime.reviewError}</p>}
      {runtime.reviewState === "running" && <div className="progress-card"><progress value={runtime.reviewProgress?.completed ?? 0} max={Math.max(1, runtime.reviewProgress?.total ?? 1)} /><span>{runtime.reviewProgress?.stage ?? "positions"} · {runtime.reviewProgress?.completed ?? 0}/{runtime.reviewProgress?.total ?? "?"}</span></div>}
      <section className="engine-diagnostics"><div><span>Engine</span><strong>Stockfish 18 WASM</strong></div><div><span>Cache</span><strong>{runtime.reviewState === "cached" ? "Loaded from IndexedDB" : analysis ? "Analysis in memory" : "No game analysis"}</strong></div><div><span>Score</span><strong>{formatEngineScore(result)}</strong></div><div><span>Divider</span><strong>{analysis ? `middle ${analysis.division.middlePly ?? "—"} · end ${analysis.division.endPly ?? "—"}` : "—"}</strong></div></section>
      <div className="candidate-list">{result?.lines.map((line) => <div className="candidate" key={line.rank}><span>#{line.rank}</span><strong>{line.pv[0]}</strong><code>{formatEngineScore(line.score)}</code><small>{line.pv.slice(1, 7).join(" ")}</small></div>) ?? <p className="utility-empty">Run the current-position engine to inspect raw MultiPV.</p>}</div>
    </div>
  );
}
