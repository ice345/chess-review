"use client";

import Link from "next/link";
import { useState } from "react";
import { replayUciLine } from "@chess-review/chess-core";
import { QUALITY_META, QualityIcon } from "@chess-review/ui";
import { CoachPanel } from "./coach-panel";
import { HumanPanel } from "./human-panel";
import { ReviewMoves, ReviewOverview } from "./review-presentation";
import { useReviewRuntime } from "./review-runtime";
import { formatEngineScore } from "../lib/review-format";
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

function TopContinuations() {
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  const positionFen = useReviewStore((store) => store.positionFen);
  const variation = useReviewStore((store) => store.variation);
  const returnToGame = useReviewStore((store) => store.returnToGame);
  const canonical = analysis?.moves[currentPly]?.stockfish ?? null;
  const result = runtime.continuationResult ?? canonical;
  const rootFen = variation?.rootFen ?? positionFen;
  const lines = result?.lines.slice(0, runtime.continuationLines) ?? [];
  const needsSearch = !result || result.lines.length < runtime.continuationLines;

  return (
    <section className="continuations-panel">
      <header>
        <div><span className="kicker">Current position</span><h2>Top continuations</h2></div>
        <div className="continuation-controls">
          <label><span>Lines</span><select value={runtime.continuationLines} onChange={(event) => runtime.setContinuationLines(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
          <label><span>Moves</span><select value={runtime.continuationLength} onChange={(event) => runtime.setContinuationLength(Number(event.target.value) as 6 | 8 | 10 | 12 | 16)}>{[6, 8, 10, 12, 16].map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
        </div>
      </header>
      {variation && (
        <div className="variation-banner"><span>Exploring line #{variation.rank} · {variation.cursor}/{variation.moves.length}</span><button className="text-button" onClick={returnToGame}>Return to game <kbd>Esc</kbd></button></div>
      )}
      <div className="continuation-list">
        {lines.map((line) => {
          const san = (() => {
            try {
              return replayUciLine(rootFen, line.pv).slice(0, runtime.continuationLength).map((move) => move.san);
            } catch {
              return line.pv.slice(0, runtime.continuationLength);
            }
          })();
          return (
            <button className={variation?.rank === line.rank ? "active" : ""} key={line.rank} onClick={() => runtime.playContinuation(line.rank, result)}>
              <span className="line-rank">{line.rank}</span>
              <strong>{formatEngineScore(line.score)}</strong>
              <span className="line-moves">{san.join(" ")}</span>
              <small>Explore →</small>
            </button>
          );
        })}
        {lines.length === 0 && <p className="continuation-empty">Ask browser Stockfish for candidate lines from this exact position.</p>}
      </div>
      {needsSearch && <button className="secondary continuation-search" disabled={runtime.continuationState === "running"} onClick={() => void runtime.analyzeContinuations()}>{runtime.continuationState === "running" ? "Calculating continuations…" : `Load ${runtime.continuationLines} line${runtime.continuationLines === 1 ? "" : "s"}`}</button>}
      {runtime.continuationError && <p className="error">{runtime.continuationError}</p>}
      <small className="continuation-note">Changing displayed move length only truncates validated SAN; it does not rerun Stockfish.</small>
    </section>
  );
}

export function ObjectiveRoutePanel() {
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const goToPly = useReviewStore((store) => store.goToPly);
  const currentPly = useReviewStore((store) => store.currentPly);
  if (!analysis) return <div className="route-panel objective-route"><TopContinuations /><AnalysisGate section="Objective review" /></div>;
  const move = currentPly === 0 ? null : analysis.moves[currentPly - 1] ?? null;
  return (
    <div className="route-panel objective-route">
      <div className="route-heading"><span className="kicker">Objective review</span><h1>What happened?</h1><p>Engine truth first; interpretation comes later.</p></div>
      {move && <section className="position-verdict-card"><QualityIcon classification={move.classification} size={38} /><div><span>{move.ply}. {move.san}</span><strong>{QUALITY_META[move.classification].label}</strong><small>Accuracy {move.accuracy.toFixed(1)} · {formatEngineScore(move.evaluationBefore)} → {formatEngineScore(move.playedMoveScore)}</small></div><details><summary>Why this label?</summary><p>{move.classificationReason.precedenceRule.replaceAll("-", " ")} · Win% loss {move.classificationReason.winPercentLoss.toFixed(1)}</p></details></section>}
      <TopContinuations />
      <ReviewOverview analysis={analysis} onSelectPly={goToPly} allMomentsHref={`/review/${runtime.gameId}/moves`} />
    </div>
  );
}

export function MovesRoutePanel() {
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  const goToPly = useReviewStore((store) => store.goToPly);
  const [filter, setFilter] = useState<"all" | "critical" | "errors">("all");
  if (!analysis) return <AnalysisGate section="Move explorer" />;
  const move = currentPly === 0 ? null : analysis.moves[currentPly - 1] ?? null;
  return (
    <div className="route-panel moves-route">
      <div className="route-heading"><span className="kicker">Move explorer</span><h1>Every decision, in context</h1></div>
      <div className="move-filters" aria-label="Move filters">{(["all", "critical", "errors"] as const).map((value) => <button className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{value}</button>)}</div>
      <ReviewMoves analysis={analysis} currentPly={currentPly} onSelectPly={goToPly} filter={filter} />
      {move && <section className="move-evidence"><div><QualityIcon classification={move.classification} size={28} /><span><strong>{move.san} · {QUALITY_META[move.classification].label}</strong><small>{move.phase} · Accuracy {move.accuracy.toFixed(1)}</small></span></div><dl><div><dt>Rule</dt><dd>{move.classificationReason.precedenceRule.replaceAll("-", " ")}</dd></div><div><dt>Engine rank</dt><dd>{move.classificationReason.engineRank === undefined ? "Outside MultiPV" : `#${move.classificationReason.engineRank}`}</dd></div><div><dt>Win% loss</dt><dd>{move.classificationReason.winPercentLoss.toFixed(1)}</dd></div><div><dt>Legal choices</dt><dd>{move.classificationReason.legalMoveCount}</dd></div></dl>{move.classificationReason.exclusions.length > 0 && <small>Exclusions · {move.classificationReason.exclusions.join(", ")}</small>}</section>}
    </div>
  );
}

export function HumanRoutePanel() {
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  const game = useReviewStore((store) => store.game);
  const setMoveHuman = useReviewStore((store) => store.setMoveHuman);
  if (!analysis) return <AnalysisGate section="Human analysis" />;
  const move = currentPly === 0 ? null : analysis.moves[currentPly - 1] ?? null;
  const normalizedMove = currentPly === 0 ? null : game?.plies[currentPly - 1] ?? null;
  return (
    <div className="route-panel human-route">
      <div className="route-heading"><span className="kicker">Human lens</span><h1>How natural was this move?</h1><p>Maia estimates human choice at a target rating. It never changes the Stockfish verdict.</p></div>
      <HumanPanel move={move} isForcing={normalizedMove?.isCheck === true || normalizedMove?.isCapture === true} onUpdate={(human) => move && runtime.persistEnrichedAnalysis(setMoveHuman(move.ply, human))} />
    </div>
  );
}

export function CoachRoutePanel() {
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  const goToPly = useReviewStore((store) => store.goToPly);
  const setMoveCoach = useReviewStore((store) => store.setMoveCoach);
  const setGameCoachSummary = useReviewStore((store) => store.setGameCoachSummary);
  if (!analysis) return <AnalysisGate section="AI coach" />;
  const move = currentPly === 0 ? null : analysis.moves[currentPly - 1] ?? null;
  return (
    <div className="route-panel coach-route">
      <div className="route-heading"><span className="kicker">Coach</span><h1>Turn this position into a lesson</h1><p>Explanations stay inside the facts already verified by Stockfish, Maia and the rules layer.</p></div>
      <CoachPanel analysis={analysis} move={move} onMoveUpdate={(coach) => move && runtime.persistEnrichedAnalysis(setMoveCoach(move.ply, coach))} onGameUpdate={(summary) => runtime.persistEnrichedAnalysis(setGameCoachSummary(summary))} onSelectPly={goToPly} />
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
