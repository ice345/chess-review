"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Chessboard, defaultArrowOptions } from "react-chessboard";
import { legalBoardDestinations, replayUciLine } from "@chess-review/chess-core";
import { buildHumanAnalysis, matchesHumanAnalysisIdentity } from "@chess-review/analysis";
import type { StockfishMoveAnalysis } from "@chess-review/shared";
import { BoardQualityBadge, EvaluationGraph, QUALITY_META } from "@chess-review/ui";
import { AppHeader } from "./app-header";
import { ReviewRuntimeProvider } from "./review-runtime";
import { BoardFlipButton } from "./review/board-flip-button";
import { EvaluationBar } from "./review/evaluation-bar";
import { MoveTransport } from "./review/move-transport";
import { PlayerStrip } from "./review/player-strip";
import { usePlayerIdentities } from "../hooks/use-player-identities";
import { useBranchMoveQuality } from "../hooks/use-branch-move-quality";
import { useReviewAnalysis } from "../hooks/use-review-analysis";
import { useReviewCoach } from "../hooks/use-review-coach";
import { useReviewHuman } from "../hooks/use-review-human";
import { useReviewPlayback } from "../hooks/use-review-playback";
import { useReviewRecord } from "../hooks/use-review-record";
import { loadAppSettings } from "../lib/app-settings";
import {
  analysisModeArrows,
  matchingHumanCandidate,
  matchingStockfishCandidate,
  type HumanCandidateIdentity,
  type StockfishCandidateIdentity,
} from "../lib/board-analysis-arrows";
import { boardMoveHintStyles, pieceMatchesTurn } from "../lib/board-move-hints";
import { selectedBranchNode } from "../lib/analysis-branch";
import { orderPlayersForBoard } from "../lib/player-identity";
import { downloadBlob, renderGameReviewCard, renderPositionCard, reviewFilename } from "../lib/png-export";
import { BlueBishopMark } from "@chess-review/ui";
import { saveReviewRecord, type ReviewRecord } from "../lib/review-library";
import { exportAnalysisJson, exportAnnotatedPgn } from "@chess-review/shared";
import { useReviewStore } from "../store/review-store";

export function ReviewShell({ children }: { children: ReactNode }) {
  const params = useParams<{ gameId: string }>();
  const pathname = usePathname();
  const gameId = params.gameId;
  const state = useReviewStore();
  const settings = useMemo(() => loadAppSettings(), []);
  const analysisRuntime = useReviewAnalysis({
    gameId,
    positionFen: state.positionFen,
    currentPly: state.currentPly,
    settings,
  });
  const {
    reviewDepth,
    setReviewDepth,
    reviewMultiPv,
    setReviewMultiPv,
    continuationLines,
    continuationLength,
    reviewState,
    reviewError,
    reviewProgress,
    engineResult,
    engineState,
    engineError,
    continuationResult,
    continuationState,
    continuationError,
    analyzeFullGame,
    cancelFullGame,
    analyzePosition,
    analyzeContinuations,
    persistEnrichedAnalysis,
  } = analysisRuntime;
  const branchQualityRuntime = useBranchMoveQuality(reviewDepth, reviewMultiPv);
  const coachRuntime = useReviewCoach(settings, persistEnrichedAnalysis);
  const { record, setRecord, loadState, loadError } = useReviewRecord({
    gameId,
    settings,
    runFullGame: analysisRuntime.runFullGame,
    setReviewState: analysisRuntime.setReviewState,
  });
  const players = usePlayerIdentities(record, state.game);
  const orderedPlayers = orderPlayersForBoard(players, state.orientation);
  const totalPlies = state.game?.plies.length ?? 0;
  const playback = useReviewPlayback({
    currentPly: state.currentPly,
    totalPlies,
    inVariation: state.branch !== null,
    goToPly: state.goToPly,
  });
  const pausePlayback = playback.pause;
  const branchPositionFen = state.branch ? state.positionFen : null;
  const canonicalPositionResult = state.branch ? null : state.analysis?.moves[state.currentPly]?.stockfish ?? null;
  const candidateResult = continuationResult ?? canonicalPositionResult;
  const reviewedAnalysis = state.branch || state.currentPly === 0
    ? null
    : state.analysis?.moves[state.currentPly - 1] ?? null;
  const reviewedMoveTarget = reviewedAnalysis
    ? { ply: reviewedAnalysis.ply, fenBefore: reviewedAnalysis.fenBefore, uci: reviewedAnalysis.uci }
    : null;
  const positionStockfishCandidateMoves = useMemo(
    () => candidateResult?.lines.flatMap((line) => line.pv[0] ? [line.pv[0]] : []) ?? [],
    [candidateResult],
  );
  const moveStockfishCandidateMoves = useMemo(
    () => reviewedAnalysis?.stockfish.lines.flatMap((line) => line.pv[0] ? [line.pv[0]] : []) ?? [],
    [reviewedAnalysis],
  );
  const humanRuntime = useReviewHuman({
    positionFen: state.positionFen,
    reviewedMove: reviewedMoveTarget,
    persistedHuman: reviewedAnalysis?.human,
    moveStockfishCandidateMoves,
    positionStockfishCandidateMoves,
    initialTargetElo: settings.humanTargetElo,
    initialModel: settings.humanModel,
  });
  const matchingStoredHuman = reviewedAnalysis?.human
    && matchesHumanAnalysisIdentity(reviewedAnalysis.human, humanRuntime.model, humanRuntime.targetElo)
    ? reviewedAnalysis.human
    : null;
  const liveHuman = useMemo(() => {
    if (!reviewedAnalysis || !humanRuntime.moveReview) return null;
    try {
      return buildHumanAnalysis(reviewedAnalysis, humanRuntime.moveReview);
    } catch {
      return null;
    }
  }, [humanRuntime.moveReview, reviewedAnalysis]);
  const currentHuman = matchingStoredHuman ?? liveHuman;
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const legalDestinations = useMemo(
    () => selectedSquare ? legalBoardDestinations(state.positionFen, selectedSquare) : [],
    [selectedSquare, state.positionFen],
  );
  const boardSquareStyles = useMemo(
    () => boardMoveHintStyles(selectedSquare, legalDestinations),
    [legalDestinations, selectedSquare],
  );

  useEffect(() => {
    setSelectedSquare(null);
  }, [state.positionFen]);

  useEffect(() => {
    if (!state.analysis) return;
    const before = state.analysis;
    const updated = useReviewStore.getState().invalidateHumanAnalysis(humanRuntime.model, humanRuntime.targetElo);
    if (updated && updated !== before) persistEnrichedAnalysis(updated);
  }, [humanRuntime.model, humanRuntime.targetElo, persistEnrichedAnalysis, state.analysis]);

  useEffect(() => {
    if (!reviewedAnalysis || !liveHuman || matchingStoredHuman) return;
    persistEnrichedAnalysis(useReviewStore.getState().setMoveHuman(reviewedAnalysis.ply, liveHuman));
  }, [liveHuman, matchingStoredHuman, persistEnrichedAnalysis, reviewedAnalysis]);

  useEffect(() => {
    if (loadState !== "ready" || !record || humanRuntime.mode === "maia" || analysisRuntime.continuationResult) return;
    if (!branchPositionFen && canonicalPositionResult) return;
    void analysisRuntime.analyzeContinuations();
  }, [analysisRuntime.analyzeContinuations, analysisRuntime.continuationResult, branchPositionFen, canonicalPositionResult, humanRuntime.mode, loadState, record]);

  useEffect(() => {
    function navigate(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      const review = useReviewStore.getState();
      if (event.key === "Escape" && review.branch) {
        pausePlayback();
        review.returnToGame();
      }
      if (event.key === "ArrowLeft") {
        pausePlayback();
        if (review.branch) review.stepBranch(-1);
        else review.goToPly(review.currentPly - 1);
      }
      if (event.key === "ArrowRight") {
        pausePlayback();
        if (review.branch) review.stepBranch(1);
        else review.goToPly(review.currentPly + 1);
      }
    }
    window.addEventListener("keydown", navigate);
    return () => window.removeEventListener("keydown", navigate);
  }, [pausePlayback]);

  if (loadState !== "ready" || !record) {
    return (
      <main className="review-loading">
        <AppHeader compact />
        <section>
          <span className="brand-mark"><BlueBishopMark decorative /></span>
          <h1>{loadState === "missing" ? "Review not found" : loadState === "error" ? "Unable to open review" : "Preparing workspace"}</h1>
          <p>{loadError ?? (loadState === "missing" ? "This browser has no record for that review ID." : "Loading the persisted game and analysis cache…")}</p>
          {loadState !== "loading" && <Link href="/">Return home →</Link>}
        </section>
      </main>
    );
  }

  const currentMove = state.currentPly === 0 ? null : state.game?.plies[state.currentPly - 1] ?? null;
  const currentAnalysis = state.currentPly === 0 ? null : state.analysis?.moves[state.currentPly - 1] ?? null;
  const selectedBranch = state.branch ? selectedBranchNode(state.branch) : null;
  const selectedBranchQuality = selectedBranch?.moveQuality;
  const positionResult = canonicalPositionResult;
  const displayedResult = engineResult ?? continuationResult ?? positionResult;
  const displayedScore = displayedResult?.score
    ?? currentAnalysis?.evaluationAfter
    ?? state.analysis?.moves[0]?.evaluationBefore
    ?? null;
  const root = `/review/${gameId}`;
  const primary = [
    { href: root, label: "Review" },
    { href: `${root}/moves`, label: "Moves" },
    { href: `${root}/coach`, label: "Study" },
  ];
  const selectedBranchMove = selectedBranch?.move ?? null;
  const boardArrows = analysisModeArrows({
    mode: humanRuntime.mode,
    stockfish: candidateResult,
    human: humanRuntime.positionAnalysis,
    lineCount: continuationLines,
    ...(selectedBranchMove?.uci === undefined ? {} : { selectedUci: selectedBranchMove.uci }),
  });

  function downloadText(content: string, mimeType: string, filename: string) {
    downloadBlob(new Blob([content], { type: `${mimeType};charset=utf-8` }), filename);
  }

  async function exportPositionPng() {
    if (!state.analysis || !currentAnalysis) return;
    downloadBlob(await renderPositionCard(state.analysis, currentAnalysis, state.orientation), reviewFilename(state.analysis, `move-${currentAnalysis.ply}.png`));
  }

  async function exportReviewPng() {
    if (!state.analysis) return;
    downloadBlob(await renderGameReviewCard(state.analysis), reviewFilename(state.analysis, "game-review.png"));
  }

  function flipBoard() {
    if (!record) return;
    const orientation: "white" | "black" = state.orientation === "white" ? "black" : "white";
    state.setOrientation(orientation);
    const updated: ReviewRecord = { ...record, orientationOverride: orientation };
    setRecord(updated);
    void saveReviewRecord(updated).catch(() => undefined);
  }

  function navigateToPly(ply: number) {
    playback.pause();
    state.goToPly(ply);
  }

  function navigateFirst() {
    playback.pause();
    if (state.branch) state.stepBranch(-state.branch.selectedIndex);
    else state.goToPly(0);
  }

  function navigatePrevious() {
    playback.pause();
    if (state.branch) state.stepBranch(-1);
    else state.goToPly(state.currentPly - 1);
  }

  function navigateNext() {
    playback.pause();
    if (state.branch) state.stepBranch(1);
    else state.goToPly(state.currentPly + 1);
  }

  function navigateLast() {
    playback.pause();
    if (state.branch) state.stepBranch(state.branch.activePath.length - 1 - state.branch.selectedIndex);
    else state.goToPly(totalPlies);
  }

  const runtime = {
    gameId,
    record,
    reviewState,
    reviewError,
    reviewProgress,
    reviewDepth,
    setReviewDepth,
    reviewMultiPv,
    setReviewMultiPv,
    engineResult,
    engineState,
    engineError,
    continuationLines,
    continuationLength,
    continuationResult,
    continuationState,
    continuationError,
    analysisMode: humanRuntime.mode,
    setAnalysisMode: humanRuntime.setMode,
    humanTargetElo: humanRuntime.targetElo,
    setHumanTargetElo: humanRuntime.setTargetElo,
    humanModel: humanRuntime.model,
    setHumanModel: humanRuntime.setModel,
    humanModelState: humanRuntime.modelState,
    humanModelSetupState: humanRuntime.setupState,
    humanMoveReview: humanRuntime.moveReview,
    currentHuman,
    humanPositionResult: humanRuntime.positionAnalysis,
    humanPositionState: humanRuntime.requestState,
    humanPositionError: humanRuntime.error,
    humanServiceState: humanRuntime.serviceState,
    coachProvider: coachRuntime.provider,
    coachLanguage: coachRuntime.language,
    coachModel: coachRuntime.selectedModel,
    coachServiceState: coachRuntime.serviceState,
    coachHealth: coachRuntime.health,
    coachTask: coachRuntime.task,
    coachNotice: coachRuntime.notice,
    analyzeFullGame,
    cancelFullGame,
    analyzePosition,
    analyzeContinuations,
    analyzeHumanPosition: humanRuntime.analyze,
    setupHumanModel: humanRuntime.setupModel,
    refreshHumanService: humanRuntime.refreshService,
    generateMoveCoach: coachRuntime.generateMove,
    generateGameCoach: coachRuntime.generateGame,
    retryBranchMoveQuality: branchQualityRuntime.retry,
    navigateToPly,
    playContinuation: (identity: StockfishCandidateIdentity, result: StockfishMoveAnalysis | null = candidateResult) => {
      const line = matchingStockfishCandidate(result, identity);
      if (!line) return;
      try {
        playback.pause();
        state.startEngineLine(identity.rank, replayUciLine(identity.fen, line.pv));
      } catch (error) {
        analysisRuntime.reportContinuationError(error);
      }
    },
    playHumanCandidate: (identity: HumanCandidateIdentity) => {
      const candidate = matchingHumanCandidate(humanRuntime.positionAnalysis, identity);
      if (!candidate || state.positionFen !== identity.fen) return;
      playback.pause();
      state.playHumanCandidate(candidate.uci, identity.targetElo, candidate.probability);
    },
    persistEnrichedAnalysis,
  };

  return (
    <ReviewRuntimeProvider value={runtime}>
      <main className="review-shell">
        <AppHeader compact />
        <div className="review-titlebar">
          <div><span className="kicker">{record.kind === "pgn" ? "Game review" : "Position study"}</span><strong>{record.title}</strong><small>{record.subtitle}</small></div>
          <nav className="review-nav" aria-label="Review sections">
            {primary.map((item) => <Link aria-current={pathname === item.href ? "page" : undefined} className={pathname === item.href ? "active" : ""} href={item.href} key={item.href}>{item.label}{item.label === "Study" && coachRuntime.task?.status === "running" ? <small>Generating…</small> : null}</Link>)}
          </nav>
          <div className="review-actions">
            <details key={`export-${pathname}`}><summary>Export</summary><div className="action-menu">
              <button type="button" disabled={!state.analysis} onClick={() => state.analysis && downloadText(exportAnalysisJson(state.analysis), "application/json", reviewFilename(state.analysis, "analysis.json"))}>Canonical JSON</button>
              <button type="button" disabled={!state.analysis} onClick={() => state.analysis && downloadText(exportAnnotatedPgn(state.analysis), "application/x-chess-pgn", reviewFilename(state.analysis, "annotated.pgn"))}>Annotated PGN</button>
              <button type="button" disabled={!currentAnalysis} onClick={() => void exportPositionPng()}>Position PNG</button>
              <button type="button" disabled={!state.analysis} onClick={() => void exportReviewPng()}>Review PNG</button>
            </div></details>
            <details key={`more-${pathname}`}><summary>More</summary><div className="action-menu"><Link href={`${root}/engine`}>Engine Lab</Link><Link href="/settings">Settings</Link></div></details>
          </div>
        </div>

        <div className="review-workspace">
          <div className="analysis-column">
            <section className="position-workspace" aria-label="Persistent board workspace">
              <div className="board-toolbar"><BoardFlipButton onFlip={flipBoard} /></div>
              <PlayerStrip player={orderedPlayers.top} />
              <div className="board-stage">
                <EvaluationBar
                  mode={humanRuntime.mode}
                  stockfish={displayedScore}
                  maia={humanRuntime.positionAnalysis}
                  orientation={state.orientation}
                />
                <div className="board-wrap">
                  <Chessboard options={{
                    position: state.positionFen,
                    allowDragging: true,
                    allowDrawingArrows: false,
                    arrows: boardArrows,
                    arrowOptions: { ...defaultArrowOptions, arrowWidthDenominator: 9, opacity: .76 },
                    boardOrientation: state.orientation,
                    animationDurationInMs: 160,
                    squareStyles: boardSquareStyles,
                    canDragPiece: ({ piece }) => pieceMatchesTurn(piece.pieceType, state.positionFen),
                    onPieceDrag: ({ piece, square }) => {
                      if (square && pieceMatchesTurn(piece.pieceType, state.positionFen)) setSelectedSquare(square);
                    },
                    onPieceDragCancel: () => setSelectedSquare(null),
                    onPieceDrop: ({ sourceSquare, targetSquare }) => {
                      setSelectedSquare(null);
                      if (!targetSquare) return false;
                      playback.pause();
                      return state.playAnalysisMove(sourceSquare, targetSquare);
                    },
                    onSquareClick: ({ piece, square }) => {
                      if (selectedSquare) {
                        const destination = legalDestinations.find((move) => move.to === square && (move.promotion === undefined || move.promotion === "q"))
                          ?? legalDestinations.find((move) => move.to === square);
                        if (destination) {
                          playback.pause();
                          const promotion = destination.promotion;
                          state.playAnalysisMove(
                            selectedSquare,
                            square,
                            promotion === "q" || promotion === "r" || promotion === "b" || promotion === "n" ? promotion : undefined,
                          );
                          setSelectedSquare(null);
                          return;
                        }
                      }
                      if (pieceMatchesTurn(piece?.pieceType, state.positionFen)) {
                        setSelectedSquare(selectedSquare === square ? null : square);
                        return;
                      }
                      setSelectedSquare(null);
                      // Candidate arrows are visual hints. A destination square is
                      // not a move identity (for example f2f3 and g1f3), so exact
                      // Stockfish/Maia branches are entered from candidate rows.
                    },
                    lightSquareStyle: { backgroundColor: "#f2e5cf" },
                    darkSquareStyle: { backgroundColor: "#91aeb6" },
                    lightSquareNotationStyle: { color: "#6d8290" },
                    darkSquareNotationStyle: { color: "#f4eadb" },
                    boardStyle: { borderRadius: "5px", boxShadow: "0 20px 54px rgba(60, 74, 84, .16)" },
                  }} />
                  {state.branch && selectedBranchMove && selectedBranchQuality?.state === "complete"
                    ? <BoardQualityBadge square={selectedBranchMove.uci.slice(2, 4)} orientation={state.orientation} classification={selectedBranchQuality.classification} />
                    : currentAnalysis && !state.branch
                      ? <BoardQualityBadge square={currentAnalysis.uci.slice(2, 4)} orientation={state.orientation} classification={currentAnalysis.classification} />
                      : null}
                </div>
              </div>
              <PlayerStrip player={orderedPlayers.bottom} />

              <div className="move-dock">
                <div className="move-status">
                  <span>
                    <strong>{state.branch ? `Analysis variation · ${selectedBranchMove?.san ?? "root"}` : currentMove ? `${currentMove.moveNumber}${currentMove.color === "white" ? "." : "…"} ${currentMove.san}` : "Starting position"}</strong>
                    <small>{state.branch
                      ? selectedBranchQuality?.state === "complete"
                        ? `${QUALITY_META[selectedBranchQuality.classification].label} · Accuracy ${selectedBranchQuality.accuracy.toFixed(1)}`
                        : selectedBranchQuality?.state === "running"
                          ? "Analyzing this move’s objective quality…"
                          : selectedBranchQuality?.state === "error"
                            ? "Move Quality analysis failed"
                            : `${state.branch.selectedIndex} / ${state.branch.activePath.length - 1} branch ply`
                      : `${state.currentPly} / ${totalPlies} ply`}</small>
                  </span>
                  {state.branch && <button type="button" className="return-to-game" onClick={() => { playback.pause(); state.returnToGame(); }}>Return to game <kbd>Esc</kbd></button>}
                </div>
                <MoveTransport
                  isPlaying={playback.isPlaying}
                  inVariation={state.branch !== null}
                  playDisabled={state.branch !== null || totalPlies === 0}
                  atStart={state.branch ? state.branch.selectedIndex === 0 : state.currentPly === 0}
                  atEnd={state.branch ? state.branch.selectedIndex === state.branch.activePath.length - 1 : state.currentPly === totalPlies}
                  onFirst={navigateFirst}
                  onPrevious={navigatePrevious}
                  onTogglePlayback={playback.toggle}
                  onNext={navigateNext}
                  onLast={navigateLast}
                />
              </div>
            </section>

            {state.analysis && <section className="timeline-panel"><div><span className="kicker">The whole game</span><strong>Evaluation timeline</strong><small>Hover for details · selecting a point returns to the canonical game</small></div><EvaluationGraph analysis={state.analysis} currentPly={state.currentPly} onSelectPly={navigateToPly} /></section>}
          </div>

          <aside className="context-panel">{children}</aside>
        </div>
      </main>
    </ReviewRuntimeProvider>
  );
}
