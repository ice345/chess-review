"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { noLegalMoveTerminalStatus, replayUciLine } from "@chess-review/chess-core";
import { formatMoveNotation, type GameAnalysisV2 } from "@chess-review/shared";
import { EvaluationGraph, QUALITY_META, QualityIcon } from "@chess-review/ui";
import { CoachPanel } from "./coach-panel";
import { AnalysisLensPanel } from "./review/analysis-lens-panel";
import { CurrentMoveVerdict } from "./review/current-move-verdict";
import { KeyMomentNavigation } from "./review/key-moment-navigation";
import { OpeningExplorerPanel } from "./review/opening-explorer-panel";
import { TablebasePanel } from "./review/tablebase-panel";
import { ReviewMoves, ReviewOverview } from "./review-presentation";
import { displayPgnComment, importedAnnotations } from "../lib/imported-annotations";
import { displayedMoveQualityLabel } from "../lib/move-quality-label";
import { useReviewRuntime } from "./review-runtime";
import { formatEngineScore } from "../lib/review-format";
import { selectedBranchNode } from "../lib/analysis-branch";
import { useReviewStore } from "../store/review-store";
import { stockfishCandidateIdentity } from "../lib/board-analysis-arrows";
import { RetroPractice } from "./retro-practice";

function AnalysisGate({ section }: { section: string }) {
  const runtime = useReviewRuntime();
  return (
    <div className="analysis-gate">
      <span className="kicker">{section}</span>
      <h1>{runtime.record.kind === "fen" ? "Game facts are not available for a FEN study" : "Run the objective review first"}</h1>
      <p>{runtime.record.kind === "fen" ? "Use Engine Lab for this explicit position. PGN history is required for Move Quality, Accuracy, Maia move review and Study." : "Stockfish will build the canonical facts that every other section consumes."}</p>
      {runtime.record.kind === "fen" ? <Link className="primary-link" href={`/review/${runtime.gameId}/engine`}>Open Engine Lab →</Link> : runtime.reviewState === "running" ? (
        <div className="progress-card"><progress value={runtime.reviewProgress?.completed ?? 0} max={Math.max(1, runtime.reviewProgress?.total ?? 1)} /><span>{runtime.reviewProgress?.completed ?? 0}/{runtime.reviewProgress?.total ?? "?"} positions</span><button type="button" className="secondary" onClick={runtime.cancelFullGame}>Cancel</button></div>
      ) : <button type="button" className="primary" onClick={() => void runtime.analyzeFullGame()}>Analyze game</button>}
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
  // Mid-practice, `analysis.moves[currentPly].stockfish` is the prompt position's
  // own MultiPV root — the best move is its first line. Suppress it entirely.
  const practiceHidden = runtime.retro.locked;
  const canonical = branch || practiceHidden ? null : analysis?.moves[currentPly]?.stockfish ?? null;
  const result = practiceHidden ? null : runtime.continuationResult ?? canonical;
  const rootFen = positionFen;
  const terminal = noLegalMoveTerminalStatus(rootFen);
  const lines = result?.lines.slice(0, runtime.continuationLines) ?? [];
  const branchNode = branch ? selectedBranchNode(branch) : null;
  const branchQuality = branchNode?.moveQuality;
  const selectedRank = branch
    ? branchNode?.sources.find((source) => source.kind === "stockfish")?.rank
    : undefined;

  return (
    <section className="position-analysis">
      <AnalysisLensPanel objective={result} />
      {branch && (
        <div className="variation-banner">
          <span>Analysis branch · root ply {branch.rootPly} · {branch.selectedIndex}/{branch.activePath.length - 1}</span>
          {branchQuality?.state === "complete" && <span className="branch-quality-result"><QualityIcon classification={branchQuality.classification} size={20} /><strong>{QUALITY_META[branchQuality.classification].label}</strong><small>Accuracy {branchQuality.accuracy.toFixed(1)}</small></span>}
          {branchQuality?.state === "running" && <small>Stockfish is classifying this move…</small>}
          {branchQuality?.state === "error" && <button type="button" className="text-button" onClick={runtime.retryBranchMoveQuality}>Retry Move Quality</button>}
          <button type="button" className="text-button" onClick={returnToGame}>Return to game <kbd>Esc</kbd></button>
        </div>
      )}
      {runtime.analysisMode !== "maia" && <div className="continuation-list" aria-label="Stockfish continuations">
        {lines.map((line) => {
          const identity = result ? stockfishCandidateIdentity(result, line) : null;
          const san = (() => {
            try {
              return replayUciLine(rootFen, line.pv).slice(0, runtime.continuationLength).map((move) => move.san);
            } catch {
              return line.pv.slice(0, runtime.continuationLength);
            }
          })();
          return (
            <button
              type="button"
              aria-label={`Stockfish candidate #${line.rank} ${line.pv[0] ?? "unknown"}`}
              className={selectedRank === line.rank ? "active" : ""}
              data-candidate-uci={line.pv[0]}
              key={identity ? `${identity.fen}|${identity.rank}|${identity.pvKey}` : line.rank}
              disabled={!identity}
              onClick={() => identity && runtime.playContinuation(identity, result)}
            >
              <span className="line-rank">{line.rank}</span>
              <strong>{formatEngineScore(line.score)}</strong>
              <span className="line-moves">{san.join(" ")}</span>
              <code>{line.pv[0]}</code>
              <small>Explore →</small>
            </button>
          );
        })}
        {lines.length === 0 && <p className="continuation-empty">{
          terminal
            ? `${terminal.kind === "checkmate" ? "Checkmate" : "Stalemate"} · no legal continuation.`
            : runtime.continuationState === "running"
              ? "Analyzing this position…"
              : "Stockfish candidates appear here when this position is analyzed."
        }</p>}
      </div>}
      {runtime.analysisMode !== "maia" && runtime.continuationError && <p className="error">{runtime.continuationError} <button type="button" className="text-button" onClick={() => void runtime.analyzeContinuations()}>Retry</button></p>}
    </section>
  );
}

function EvaluationTimeline({
  analysis,
  currentPly,
  onSelectPly,
}: {
  analysis: GameAnalysisV2;
  currentPly: number;
  onSelectPly: (ply: number) => void;
}) {
  return (
    <details className="timeline-panel game-summary-timeline">
      <summary>
        <span className="kicker">The whole game</span>
        <strong>Evaluation timeline</strong>
      </summary>
      <small>Select a point to inspect that ply and return to the canonical game</small>
      <EvaluationGraph analysis={analysis} currentPly={currentPly} onSelectPly={onSelectPly} />
    </details>
  );
}

export function ObjectiveRoutePanel() {
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  const branch = useReviewStore((store) => store.branch);
  if (!analysis) return <div className="route-panel objective-route"><AnalysisGate section="Objective review" /><PositionAnalysis /></div>;
  const move = branch || currentPly === 0 ? null : analysis.moves[currentPly - 1] ?? null;
  const firstMoment = analysis.criticalMoments.find((moment) => analysis.moves[moment.ply - 1]);
  const firstMove = firstMoment ? analysis.moves[firstMoment.ply - 1] : undefined;
  const practice = runtime.retro.presentation.hideReviewChrome;
  return (
    <div className="route-panel objective-route">
      {!practice && currentPly === 0 && !branch && firstMove && (
        <p className="review-next-step" role="region" aria-label="Review next step">
          Start with a key moment
          <strong>{formatMoveNotation({ fenBefore: firstMove.fenBefore, color: firstMove.color, san: firstMove.san })} · {displayedMoveQualityLabel(firstMove)}</strong>
          <button
            type="button"
            className="text-button"
            onClick={(event) => {
              runtime.navigateToPly(firstMove.ply);
              event.currentTarget.closest(".context-panel")?.scrollTo({ top: 0 });
            }}
          >
            Review key moment →
          </button>
          <Link href={`/review/${runtime.gameId}/coach?ply=${firstMove.ply}`}>Study this move →</Link>
        </p>
      )}
      {!practice && currentPly === 0 && !branch && !firstMove && (
        <p className="review-next-step" role="region" aria-label="Review next step">
          Walk through your game
          <Link href={`/review/${runtime.gameId}/moves`}>Explore moves →</Link>
          <Link href={`/review/${runtime.gameId}/coach`}>Study this game →</Link>
        </p>
      )}

      <RetroPractice analysis={analysis} />
      {!practice && <KeyMomentNavigation analysis={analysis} />}
      {!practice && (
        <ReviewMoves analysis={analysis} currentPly={currentPly} onSelectPly={runtime.navigateToPly} />
      )}
      {!practice && move && <CurrentMoveVerdict move={move} />}
      {!runtime.retro.presentation.hideCoachAnswers && <PositionAnalysis />}
      {!practice && (
        <section className="game-summary-section" aria-label="Game summary">
          <div className="section-heading">
            <span className="kicker">Game summary</span>
            <h2>Accuracy, phases and Move Quality</h2>
          </div>
          <ReviewOverview analysis={analysis} onSelectPly={runtime.navigateToPly} allMomentsHref={`/review/${runtime.gameId}/moves`} />
          <EvaluationTimeline analysis={analysis} currentPly={currentPly} onSelectPly={runtime.navigateToPly} />
        </section>
      )}
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
  // The author's own note for the selected move, when the PGN had one.
  const importedComment = useMemo(
    () => move === null ? undefined : displayPgnComment(importedAnnotations(analysis)?.plies[move.ply - 1]?.comment),
    [analysis, move],
  );
  return (
    <div className="route-panel moves-route">
      <div className="move-filters" aria-label="Move filters">{([["all", "All"], ["critical", "Key"], ["errors", "Errors"]] as const).map(([value, label]) => <button type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{label}</button>)}</div>
      <ReviewMoves analysis={analysis} currentPly={currentPly} onSelectPly={runtime.navigateToPly} filter={filter} />
      {move && <section className="move-evidence">{importedComment !== undefined && <p className="move-imported-note">{importedComment}</p>}<div><QualityIcon classification={move.classification} size={28} /><span><strong>{move.san} · {displayedMoveQualityLabel(move)}</strong><small>{move.annotations.length > 0 ? `Annotations · ${move.annotations.map((annotation) => annotation.replaceAll("_", " ")).join(", ")} · ` : ""}{move.phase} · Accuracy {move.accuracy.toFixed(1)}</small></span></div><dl><div><dt>Quality rule</dt><dd>{(move.classificationReason.qualityRule ?? move.classificationReason.precedenceRule).replaceAll("-", " ")}</dd></div><div><dt>Engine rank</dt><dd>{move.classificationReason.engineRank === undefined ? "Outside MultiPV" : `#${move.classificationReason.engineRank}`}</dd></div><div><dt>Win% loss</dt><dd>{move.classificationReason.winPercentLoss.toFixed(1)}</dd></div><div><dt>Verification</dt><dd>{move.classificationReason.verification?.status ?? "not required"}</dd></div></dl>{move.classificationReason.exclusions.length > 0 && <small>Exclusions · {move.classificationReason.exclusions.join(", ")}</small>}</section>}
    </div>
  );
}

export function CoachRoutePanel() {
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  if (!analysis) return <AnalysisGate section="AI coach" />;
  const move = currentPly === 0 ? null : analysis.moves[currentPly - 1] ?? null;
  return (
    <div className="route-panel coach-route">
      <CoachPanel analysis={analysis} move={move} onSelectPly={runtime.navigateToPly} />
    </div>
  );
}

export function EngineRoutePanel() {
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  const positionFen = useReviewStore((store) => store.positionFen);
  const [tab, setTab] = useState<"engine" | "explorer" | "tablebase">("engine");
  const practiceHidden = runtime.retro.locked;
  // The explorer shows what is commonly played from this position, which is a
  // spoiler while the visitor still owes an answer, so the tabs stay away until
  // the practice session ends.
  const showTabs = !practiceHidden;
  const result = practiceHidden ? null : runtime.engineResult ?? analysis?.moves[currentPly]?.stockfish ?? null;
  const enginePanel = <>
      <section className="engine-config"><label>Depth<select value={runtime.reviewDepth} disabled={runtime.reviewState === "running"} onChange={(event) => runtime.setReviewDepth(Number(event.target.value) as 10 | 12 | 15)}><option value={10}>10</option><option value={12}>12</option><option value={15}>15</option></select></label><label>Engine Lab lines<select value={runtime.reviewMultiPv} onChange={(event) => runtime.setReviewMultiPv(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label></section>
      <div className="engine-actions"><button type="button" className="primary" disabled={runtime.engineState === "running"} onClick={() => void runtime.analyzePosition()}>{runtime.engineState === "running" ? "Analyzing position…" : "Analyze current position"}</button>{runtime.record.kind === "pgn" && (runtime.reviewState === "running" ? <button type="button" className="secondary" onClick={runtime.cancelFullGame}>Cancel game review</button> : <button type="button" className="secondary" onClick={() => void runtime.analyzeFullGame()}>Re-analyze full game</button>)}</div>
      {(runtime.engineError || runtime.reviewError) && <p className="error">{runtime.engineError ?? runtime.reviewError}</p>}
      {runtime.reviewState === "running" && <div className="progress-card"><progress value={runtime.reviewProgress?.completed ?? 0} max={Math.max(1, runtime.reviewProgress?.total ?? 1)} /><span>{runtime.reviewProgress?.stage ?? "positions"} · {runtime.reviewProgress?.completed ?? 0}/{runtime.reviewProgress?.total ?? "?"}</span></div>}
      <section className="engine-diagnostics"><div><span>Engine</span><strong>Stockfish 18 WASM</strong></div><div><span>Cache</span><strong>{runtime.reviewState === "cached" ? "Loaded from IndexedDB" : analysis ? "Analysis in memory" : "No game analysis"}</strong></div><div><span>Score</span><strong>{formatEngineScore(result)}</strong></div><div><span>Divider</span><strong>{analysis ? `middle ${analysis.division.middlePly ?? "—"} · end ${analysis.division.endPly ?? "—"}` : "—"}</strong></div></section>
      {practiceHidden && <p className="utility-empty" role="status">Engine lines are hidden while you solve this position. Answer on the board, view the solution, or skip.</p>}
      <div className="candidate-list">{practiceHidden ? null : result?.lines.map((line) => <div className="candidate" key={line.rank}><span>#{line.rank}</span><strong>{line.pv[0]}</strong><code>{formatEngineScore(line.score)}</code><small>{line.pv.slice(1, 7).join(" ")}</small></div>) ?? <p className="utility-empty">Run the current-position engine to inspect raw MultiPV.</p>}</div>
  </>;
  return (
    <div className="route-panel engine-route">
      {showTabs && (
        <div className="engine-tabs" role="tablist" aria-label="Engine Lab">
          <button type="button" role="tab" aria-selected={tab === "engine"} className={tab === "engine" ? "active" : ""} onClick={() => setTab("engine")}>Engine</button>
          <button type="button" role="tab" aria-selected={tab === "explorer"} className={tab === "explorer" ? "active" : ""} onClick={() => setTab("explorer")}>Explorer</button>
          <button type="button" role="tab" aria-selected={tab === "tablebase"} className={tab === "tablebase" ? "active" : ""} onClick={() => setTab("tablebase")}>Tablebase</button>
        </div>
      )}
      {!showTabs || tab === "engine"
        ? enginePanel
        : tab === "explorer"
          ? <OpeningExplorerPanel fen={positionFen} />
          : <TablebasePanel fen={positionFen} />}
    </div>
  );
}
