"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useMemo } from "react";
import { noLegalMoveTerminalStatus, replayUciLine } from "@chess-review/chess-core";
import { formatMoveNotation, type GameAnalysisV2 } from "@chess-review/shared";

import { EvaluationGraph, Icon, QUALITY_META, QualityIcon, type IconName } from "@chess-review/ui";
import { CoachPanel } from "./coach-panel";
import { AnalysisLensPanel } from "./review/analysis-lens-panel";
import { CurrentMoveVerdict } from "./review/current-move-verdict";
import { runDiagnosticsLine, runDiagnosticsText } from "../lib/run-diagnostics-copy";
import { criticalMomentPlies } from "../lib/critical-moment-navigation";
import { KeyMomentNavigation } from "./review/key-moment-navigation";
import { OpeningExplorerPanel } from "./review/opening-explorer-panel";
import { TablebasePanel } from "./review/tablebase-panel";
import { ReviewMoves, ReviewOverview } from "./review-presentation";
import { useWithheldPly } from "./review-session-state";
import { displayPgnComment, importedAnnotations } from "../lib/imported-annotations";
import { annotationsLabel, baselineOnlyCaveat, engineChoiceLabel, moveEvidenceSentence, sacrificeLabel, verificationLabel, winningChancesLabel } from "../lib/move-evidence-copy";
import { displayedMoveQualityLabel } from "../lib/move-quality-label";
import { useReviewRuntime } from "./review-runtime";
import { formatEngineScore } from "../lib/review-format";
import { selectedBranchNode } from "../lib/analysis-branch";
import { useReviewStore } from "../store/review-store";
import { stockfishCandidateIdentity } from "../lib/board-analysis-arrows";
import { RetroPractice } from "./retro-practice";

function engineLinesMeta(analysis: GameAnalysisV2 | null): string | null {
  if (!analysis) return null;
  const version = /stockfish/i.test(analysis.engine.stockfishVersion)
    ? analysis.engine.stockfishVersion
    : `Stockfish ${analysis.engine.stockfishVersion}`;
  return `${version} · depth ${analysis.engine.depth}`;
}

function PanelRowSummary({
  icon,
  kicker,
  label,
  meta,
}: {
  icon: IconName;
  kicker?: string;
  label: string;
  meta?: string | null;
}) {
  return (
    <summary>
      <Icon name={icon} />
      <span className="review-row-copy">
        {kicker ? <span className="eyebrow">{kicker}</span> : null}
        <strong>{label}</strong>
      </span>
      {meta ? <span className="review-row-meta">{meta}</span> : null}
      <Icon className="review-row-chevron" name="chevron-right" />
    </summary>
  );
}

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

function PositionAnalysis({ compact = false }: { compact?: boolean } = {}) {
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

  const hideLens = compact && branch === null;
  return (
    <section className="position-analysis">
      {!hideLens && <AnalysisLensPanel objective={result} />}
      {branch && (
        <div className="variation-banner">
          <span>Analysis branch · root ply {branch.rootPly} · {branch.selectedIndex}/{branch.activePath.length - 1}</span>
          {branchQuality?.state === "complete" && <span className="branch-quality-result"><QualityIcon classification={branchQuality.classification} size={20} /><strong>{QUALITY_META[branchQuality.classification].label}</strong><small>Accuracy {branchQuality.accuracy.toFixed(1)}</small></span>}
          {branchQuality?.state === "running" && <small>Stockfish is classifying this move…</small>}
          {branchQuality?.state === "error" && <button type="button" className="text-button" onClick={runtime.retryBranchMoveQuality}>Retry Move Quality</button>}
          <button type="button" className="text-button" onClick={returnToGame}>Return to game <kbd>Esc</kbd></button>
        </div>
      )}
      {runtime.analysisMode !== "maia" && (() => {
        const list = (
          <div className="continuation-list" aria-label="Stockfish continuations">
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
          </div>
        );
        // Guided Review folds the engine lines away so the first screen has one
        // job. Playing a move from a historical position is the visitor asking
        // "what happens instead?", so the answer opens with the branch rather
        // than needing a second click. `key` remounts the disclosure when the
        // branch appears or is left, which is what re-applies `open`; without it
        // React keeps the element's current open state.
        return compact
          ? (
            <details className="review-engine-lines review-panel-row" key={branch ? "branch" : "canonical"} open={branch !== null}>
              <PanelRowSummary icon="engine" label="Engine lines" meta={engineLinesMeta(analysis)} />
              {list}
            </details>
          )
          : list;
      })()}
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
      <small>Select a point to inspect that move and return to the canonical game</small>
      <EvaluationGraph analysis={analysis} currentPly={currentPly} onSelectPly={onSelectPly} />
    </details>
  );
}

export function ObjectiveRoutePanel() {
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  const branch = useReviewStore((store) => store.branch);
  // Hooks first: this panel mounts without an analysis and gains one later.
  const answerWithheld = useWithheldPly() !== null;

  const keyPlies = useMemo(
    () => (analysis ? criticalMomentPlies(analysis.criticalMoments) : []),
    [analysis],
  );
  const mode: string = !analysis
    ? "gate"
    : runtime.retro.active
      ? "practice"
      : branch
        ? "branch"
        : currentPly === 0
          ? "start"
          : keyPlies.includes(currentPly)
            ? "moment"
            : "move";
  // Animate only the contextual paper. Cancelling the previous animation keeps
  // rapid mode changes responsive without remounting disclosures or the board.
  const panelRef = useRef<HTMLDivElement>(null);
  const lastMode = useRef(mode);
  useEffect(() => {
    if (lastMode.current === mode) return;
    lastMode.current = mode;
    const panel = panelRef.current;
    if (!panel || typeof panel.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = panel.animate([
      { opacity: 0, transform: "translateY(4px)" },
      { opacity: 1, transform: "none" },
    ], { duration: 240, easing: "cubic-bezier(.22, .68, .2, 1)" });
    return () => animation.cancel();
  }, [mode]);

  if (!analysis) return <div className="route-panel objective-route"><AnalysisGate section="Objective review" /><PositionAnalysis /></div>;
  const move = branch || currentPly === 0 ? null : analysis.moves[currentPly - 1] ?? null;
  const hasKeyMoments = analysis.criticalMoments.some((moment) => analysis.moves[moment.ply - 1]);
  const practice = runtime.retro.presentation.hideReviewChrome;
  // The start of the game is its own state: nothing has been played yet, so the panel
  // has one job and everything that describes a *current* move is background. Both
  // halves of the first screen read this one definition.
  const atStart = !branch && currentPly === 0;
  return (
    <div
      ref={panelRef}
      className="route-panel objective-route review-mode-panel paper-panel"
      data-mode={mode}
    >
      {!practice && atStart && (
        <header className="review-panel-head">
          <p className="kicker">{hasKeyMoments ? "One thing at a time" : "Review"}</p>
          <h2 className="review-panel-display">
            {hasKeyMoments ? "Start with the first moment that mattered." : "Walk through your game"}
          </h2>
          {hasKeyMoments ? (
            <p className="review-panel-lede">
              The review stops at each key moment, asks what you would play, and only then shows the evidence.
            </p>
          ) : null}
        </header>
      )}
      {!practice && !atStart && mode === "moment" && move && (
        <header className="review-panel-head">
          <p className="kicker">The moment</p>
          <h2 className="review-panel-display">{`Why does ${formatMoveNotation({ fenBefore: move.fenBefore, color: move.color, san: move.san })} matter?`}</h2>
          <p className="review-panel-lede">{moveEvidenceSentence(move)}</p>
        </header>
      )}

      {!practice && !hasKeyMoments && atStart && (
        <p className="review-next-step" role="region" aria-label="Review next step">
          {/* A game with no key moments still has one thing to do first: the start ply
              keeps a single primary action either way. */}
          <Link className="primary-link" href={`/review/${runtime.gameId}/moves`}>Explore moves →</Link>
          <Link className="text-button" href={`/review/${runtime.gameId}/coach`}>Study this game →</Link>
        </p>
      )}

      {/* One guided strip, then this move, then nearby evidence. Engine lines and
          the whole-game report stay folded so the first screen has one job. */}
      {!practice && <KeyMomentNavigation analysis={analysis} />}
      {!practice && move && !answerWithheld && <CurrentMoveVerdict move={move} />}
      {mode === "moment" && !practice && !answerWithheld ? (
        <div className="key-moment-disclosure-row" aria-label="Moment details">
          {/* Evidence lives inside CurrentMoveVerdict; Engine + Nearby share this row band. */}
          <PositionAnalysis compact />
          <details className="review-context-moves folded-block review-panel-row">
            <PanelRowSummary
              icon="moves"
              label="Nearby moves"
              meta={`${Math.min(5, currentPly)} before · ${Math.min(5, Math.max(0, analysis.moves.length - currentPly))} after`}
            />
            <ReviewMoves analysis={analysis} currentPly={currentPly} onSelectPly={runtime.navigateToPly} contextWindow={5} />
            <Link className="view-all-moments" href={`/review/${runtime.gameId}/moves`}>
              All {analysis.moves.length} moves, filters and evidence →
            </Link>
          </details>
        </div>
      ) : null}
      <div className={atStart ? "review-other-paths" : mode === "moment" ? "review-other-paths review-other-paths-moment" : undefined}>
      <RetroPractice analysis={analysis} foldIdle={!runtime.retro.active} />

      {!practice && mode !== "moment" && (atStart ? (
        <details className="review-context-moves folded-block review-panel-row">
          <PanelRowSummary
            icon="moves"
            label="Moves, quality and accuracy"
            meta={`${analysis.moves.length} ${analysis.moves.length === 1 ? "move" : "moves"}`}
          />
          <ReviewMoves analysis={analysis} currentPly={currentPly} onSelectPly={runtime.navigateToPly} contextWindow={5} />
          <Link className="view-all-moments" href={`/review/${runtime.gameId}/moves`}>
            All {analysis.moves.length} moves, filters and evidence →
          </Link>
        </details>
      ) : (
        <section className="review-context-moves" aria-label="Nearby moves">
          <div className="review-row-static">
            <Icon name="moves" />
            <span className="review-row-copy"><strong>Nearby moves</strong></span>
            <span className="review-row-meta">{`${Math.min(5, currentPly)} before · ${Math.min(5, Math.max(0, analysis.moves.length - currentPly))} after`}</span>
          </div>
          <ReviewMoves analysis={analysis} currentPly={currentPly} onSelectPly={runtime.navigateToPly} contextWindow={5} />
          <Link className="view-all-moments" href={`/review/${runtime.gameId}/moves`}>
            All {analysis.moves.length} moves, filters and evidence →
          </Link>
        </section>
      ))}
      {mode !== "moment" && !runtime.retro.presentation.hideCoachAnswers && !answerWithheld && <PositionAnalysis compact />}
      {!practice && (
        <details className="game-summary-section review-panel-row" id="game-summary">
          <PanelRowSummary
            icon="book"
            label="Game summary and timeline"
            meta="Accuracy · phases · key moments"
          />
          <ReviewOverview analysis={analysis} onSelectPly={runtime.navigateToPly} allMomentsHref={`/review/${runtime.gameId}/moves`} />
          <EvaluationTimeline analysis={analysis} currentPly={currentPly} onSelectPly={runtime.navigateToPly} />
        </details>
      )}
      </div>
    </div>
  );
}

export function MovesRoutePanel() {
  const runtime = useReviewRuntime();
  const analysis = useReviewStore((store) => store.analysis);
  const currentPly = useReviewStore((store) => store.currentPly);
  const [filter, setFilter] = useState<"all" | "critical" | "errors">("all");
  // Hooks run before the gate returns: the panel can be mounted without an
  // analysis and gain one later, which used to change the hook count mid-life.
  const answerWithheld = useWithheldPly() !== null;
  const move = !analysis || currentPly === 0 ? null : analysis.moves[currentPly - 1] ?? null;
  // The author's own note for the selected move, when the PGN had one.
  const importedComment = useMemo(
    () => !analysis || move === null ? undefined : displayPgnComment(importedAnnotations(analysis)?.plies[move.ply - 1]?.comment),
    [analysis, move],
  );
  if (!analysis) return <AnalysisGate section="Move explorer" />;
  return (
    <div className="route-panel moves-route">
      <div className="move-filters" aria-label="Move filters">{([["all", "All"], ["critical", "Key"], ["errors", "Errors"]] as const).map(([value, label]) => <button type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{label}</button>)}</div>
      <ReviewMoves analysis={analysis} currentPly={currentPly} onSelectPly={runtime.navigateToPly} filter={filter} />
      {/* A withheld guided moment survives the route change, so this panel must
          keep the answer hidden here too. */}
      {move && !answerWithheld && <section className="move-evidence">
        {importedComment !== undefined && <p className="move-imported-note">{importedComment}</p>}
        <div>
          <QualityIcon classification={move.classification} size={28} />
          <span>
            <strong>{move.san} · {displayedMoveQualityLabel(move)}</strong>
            <small>{move.annotations.length > 0 ? `Annotations · ${annotationsLabel(move.annotations)} · ` : ""}{move.phase} · Accuracy {move.accuracy.toFixed(1)}</small>
          </span>
        </div>
        <p className="move-evidence-sentence">{moveEvidenceSentence(move)}</p>
        {baselineOnlyCaveat(move) !== null && <p className="move-verdict-caveat">{baselineOnlyCaveat(move)}</p>}
        <div className="move-evidence-actions">
          <button
            type="button"
            className="text-button"
            disabled={move.stockfish.lines.length === 0 || runtime.retro.presentation.hideAnalysisExports}
            onClick={() => {
              const line = move.stockfish.lines[0];
              if (!line) return;
              const identity = stockfishCandidateIdentity(move.stockfish, line);
              if (!identity) return;
              // Show the answer on the board from the position the move was played in,
              // which is where the engine's line starts.
              runtime.pausePlayback();
              runtime.navigateToPly(move.ply - 1);
              runtime.playContinuation(identity, move.stockfish);
            }}
          >
            Show the engine&rsquo;s answer on the board
          </button>
        </div>
        <details className="move-evidence-details">
          <summary>Evidence behind this label</summary>
          <dl>
            <div><dt>Engine</dt><dd>{engineChoiceLabel(move.classificationReason)}</dd></div>
            <div><dt>Winning chances</dt><dd>{winningChancesLabel(move.classificationReason)}</dd></div>
            <div><dt>Search</dt><dd>{verificationLabel(move)}</dd></div>
            {sacrificeLabel(move.classificationReason) !== null && (
              <div><dt>Sacrifice</dt><dd>{sacrificeLabel(move.classificationReason)}</dd></div>
            )}
            {move.classificationReason.exclusions.length > 0 && (
              <div><dt>Ruled out</dt><dd>{move.classificationReason.exclusions.join(", ").replaceAll("-", " ")}</dd></div>
            )}
          </dl>
          <details className="move-verdict-internals">
            <summary>Classification internals</summary>
            <code>{(move.classificationReason.qualityRule ?? move.classificationReason.precedenceRule)}</code>
            <p>{move.classificationReason.exclusions.length === 0 ? "No exclusion was recorded." : `Exclusions: ${move.classificationReason.exclusions.join(", ")}`}</p>
          </details>
        </details>
      </section>}
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
  const branch = useReviewStore((store) => store.branch);
  const [tab, setTab] = useState<"engine" | "explorer" | "tablebase">("engine");
  // Copying the record is the point of the button, so a refused clipboard has to be
  // visible rather than silently doing nothing: the timeline above stays selectable.
  const [diagnosticsCopy, setDiagnosticsCopy] = useState<"idle" | "copied" | "failed">("idle");
  const practiceHidden = runtime.retro.locked;
  // The explorer shows what is commonly played from this position, which is a
  // spoiler while the visitor still owes an answer, so the tabs stay away until
  // the practice session ends.
  const showTabs = !practiceHidden;
  // The lab shows the position the board is actually on. A recorded canonical
  // node only describes it while the board still stands on that node, and on a
  // branch the shell's own continuation search is the evidence for it — so the
  // panel never labels another position's numbers as this one's.
  const canonical = branch ? null : analysis?.moves[currentPly]?.stockfish ?? null;
  const result = practiceHidden ? null : runtime.engineResult ?? runtime.continuationResult ?? canonical;
  const enginePanel = <>
      <section className="engine-config"><label>Depth<select value={runtime.reviewDepth} disabled={runtime.reviewState === "running"} onChange={(event) => runtime.setReviewDepth(Number(event.target.value) as 10 | 12 | 15)}><option value={10}>10</option><option value={12}>12</option><option value={15}>15</option></select></label><label>Engine Lab lines<select value={runtime.reviewMultiPv} onChange={(event) => runtime.setReviewMultiPv(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label></section>
      <div className="engine-actions"><button type="button" className="primary" disabled={runtime.engineState === "running"} onClick={() => void runtime.analyzePosition()}>{runtime.engineState === "running" ? "Analyzing position…" : "Analyze current position"}</button>{runtime.record.kind === "pgn" && (runtime.reviewState === "running" ? <button type="button" className="secondary" onClick={runtime.cancelFullGame}>Cancel game review</button> : <button type="button" className="secondary" onClick={() => void runtime.analyzeFullGame()}>Re-analyze full game</button>)}</div>
      {(runtime.engineError || runtime.reviewError) && <p className="error">{runtime.engineError ?? runtime.reviewError}</p>}
      {runtime.reviewState === "running" && <div className="progress-card"><progress value={runtime.reviewProgress?.completed ?? 0} max={Math.max(1, runtime.reviewProgress?.total ?? 1)} /><span>{runtime.reviewProgress?.stage ?? "positions"} · {runtime.reviewProgress?.completed ?? 0}/{runtime.reviewProgress?.total ?? "?"}</span></div>}
      {/* What the last run's engine actually did. A run that stalled without engine
          traffic looked exactly like a slow machine before this existed. */}
      {runtime.runDiagnostics && runtime.runDiagnosticsSummary && <details className="run-diagnostics" open={runtime.runDiagnosticsSummary.searches === 0}>
        <summary>Run diagnostics</summary>
        <p>{runDiagnosticsLine(runtime.runDiagnosticsSummary)}{runtime.runDiagnostics.dropped > 0 ? ` · ${runtime.runDiagnostics.dropped} earlier event(s) dropped` : ""}</p>
        <ol>
          {runtime.runDiagnostics.events.slice(-40).map((event, index) => <li key={`${event.at}-${event.kind}-${index}`}>
            <code>{event.at} ms</code> {event.kind}{event.worker === undefined ? "" : ` · engine ${event.worker}`}{event.detail === undefined ? "" : ` · ${Object.entries(event.detail).map(([key, value]) => `${key} ${value}`).join(", ")}`}
          </li>)}
        </ol>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            void navigator.clipboard.writeText(runDiagnosticsText(runtime.runDiagnostics!, runtime.runDiagnosticsSummary!))
              .then(() => setDiagnosticsCopy("copied"))
              .catch(() => setDiagnosticsCopy("failed"));
          }}
        >
          Copy diagnostics
        </button>
        {diagnosticsCopy === "copied" && <small role="status">Diagnostics copied</small>}
        {diagnosticsCopy === "failed" && <small role="alert">Could not copy. The timeline above can be selected by hand.</small>}
      </details>}
      <section className="engine-diagnostics"><div><span>Engine</span><strong>Stockfish 18 WASM</strong></div><div><span>Cache</span><strong>{runtime.reviewState === "cached" ? "Loaded from IndexedDB" : analysis ? "Analysis in memory" : "No game analysis"}</strong></div><div><span>Score</span><strong>{formatEngineScore(result)}</strong></div><div><span>Divider</span><strong>{analysis ? `middle ${analysis.division.middlePly ?? "—"} · end ${analysis.division.endPly ?? "—"}` : "—"}</strong></div></section>
      {practiceHidden && <p className="utility-note" role="status">Engine lines are hidden while you solve this position. Answer on the board, view the solution, or skip.</p>}
      {/* The lab reads raw MultiPV, but a line the visitor cannot play is a
          dead end: the same rows create a validated branch here as in Review,
          through the board's own path, so both surfaces walk a line the same
          way. Raw UCI stays visible because this is the lab. */}
      <div className="candidate-list" aria-label="Stockfish candidates">
        {practiceHidden ? null : result ? result.lines.map((line) => {
          const identity = stockfishCandidateIdentity(result, line);
          return (
            <button
              type="button"
              key={identity ? `${identity.fen}|${identity.rank}|${identity.pvKey}` : line.rank}
              className="candidate"
              aria-label={`Stockfish candidate #${line.rank} ${line.pv[0] ?? "unknown"}`}
              disabled={!identity}
              onClick={() => identity && runtime.playContinuation(identity, result)}
            >
              <span>#{line.rank}</span>
              <strong>{line.pv[0]}</strong>
              <code>{formatEngineScore(line.score)}</code>
              <small>{line.pv.slice(1, 7).join(" ")}</small>
              <em>Explore →</em>
            </button>
          );
        }) : (
          <p className="utility-empty">
            {runtime.engineState === "running" || runtime.continuationState === "running"
              ? "Analyzing this position…"
              : "Run the current-position engine to inspect raw MultiPV."}
          </p>
        )}
      </div>
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
