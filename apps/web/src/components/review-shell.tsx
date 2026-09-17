"use client";

import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Chessboard, defaultArrowOptions } from "react-chessboard";
import { legalBoardDestinations, replayUciLine } from "@chess-review/chess-core";
import { buildHumanAnalysis, matchesHumanAnalysisIdentity } from "@chess-review/analysis";
import type { StockfishMoveAnalysis } from "@chess-review/shared";
import { BoardQualityBadge, QUALITY_META, WINDOWLIGHT_BOARD_APPEARANCE } from "@chess-review/ui";
import { LocalDataNotice } from "./local-data-notice";
import { TrainingSession } from "./training-session";
import { ReviewRuntimeProvider } from "./review-runtime";
import { ReviewSessionProvider } from "./review-session-state";
import { BoardControls } from "./review/board-controls";
import { BoardFlipButton } from "./review/board-flip-button";
import { BoardFocusButton } from "./review/board-focus-button";
import { ShortcutHelp } from "./review/shortcut-help";
import { EvaluationBar } from "./review/evaluation-bar";
import { MoveEntry } from "./review/move-entry";
import { MoveTransport } from "./review/move-transport";
import { PlayerStrip } from "./review/player-strip";
import { useBoardGeometryPreference } from "../hooks/use-board-geometry-preference";
import { useDismissibleDetails } from "../hooks/use-dismissible-details";
import { PIECE_ANIMATION_MS, useBoardDisplaySettings } from "../hooks/use-board-display-settings";
import { useReviewKeyboardShortcuts } from "../hooks/use-review-keyboard-shortcuts";
import { usePlayerIdentities } from "../hooks/use-player-identities";
import { useBranchMoveQuality } from "../hooks/use-branch-move-quality";
import { useChessSounds } from "../hooks/use-chess-sounds";
import { useReviewAnalysis } from "../hooks/use-review-analysis";
import { useReviewCoach } from "../hooks/use-review-coach";
import { useReviewHuman } from "../hooks/use-review-human";
import { useReviewPlayback } from "../hooks/use-review-playback";
import { useRetrospect } from "../hooks/use-retrospect";
import { useReviewRecord } from "../hooks/use-review-record";
import { useReviewNotebook } from "../hooks/use-review-notebook";
import { useBoardPieces } from "../hooks/use-board-pieces";
import { boardSquareDescription } from "../lib/board-piece-assets";
import { loadAppSettings } from "../lib/app-settings";
import { useLocalAiHealth } from "../lib/use-local-ai-health";
import {
  analysisModeArrows,
  faultArrow,
  matchingHumanCandidate,
  matchingStockfishCandidate,
  type HumanCandidateIdentity,
  type StockfishCandidateIdentity,
} from "../lib/board-analysis-arrows";
import { boardMoveHintStyles, pieceMatchesTurn } from "../lib/board-move-hints";
import { concealedAnswerPly, withheldPresentation } from "../lib/practice-presentation";
import { selectedBranchNode } from "../lib/analysis-branch";
import { orderPlayersForBoard } from "../lib/player-identity";
import { downloadBlob, renderDisplayedPositionCard, renderGameReviewCard, renderPositionCard, reviewFilename } from "../lib/png-export";
import { BrandMark } from "@chess-review/ui";
import { saveReviewRecord, type ReviewRecord } from "../lib/review-library";
import { exportAnalysisJson, exportAnnotatedPgn } from "@chess-review/shared";
import { useReviewStore } from "../store/review-store";
import { buildShareUrl } from "../lib/share-link";

export function ReviewShell({ children }: { children: ReactNode }) {
  const params = useParams<{ gameId: string }>();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const query = new URLSearchParams(search);
  const trainingId = query.get("training");
  const gameId = params.gameId;
  const state = useReviewStore();
  const settings = useMemo(() => loadAppSettings(), []);
  const pieces = useBoardPieces();
  // Review's Maia and Coach surfaces share one capability poller. This keeps
  // route transitions and health updates from creating duplicate /health
  // requests and intervals.
  const localAi = useLocalAiHealth();
  const soundRuntime = useChessSounds({
    game: state.game,
    currentPly: state.currentPly,
    branch: state.branch,
  });
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
    runDiagnostics,
    runDiagnosticsSummary,
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
  const coachRuntime = useReviewCoach(settings, persistEnrichedAnalysis, localAi);
  const { record, setRecord, loadState, loadError } = useReviewRecord({
    gameId,
    settings,
    runFullGame: analysisRuntime.runFullGame,
    setReviewState: analysisRuntime.setReviewState,
  });
  const players = usePlayerIdentities(record, state.game);
  const notebook = useReviewNotebook(loadState === "ready" ? record : null);
  const orderedPlayers = orderPlayersForBoard(players, state.orientation);
  const totalPlies = state.game?.plies.length ?? 0;
  const playback = useReviewPlayback({
    currentPly: state.currentPly,
    totalPlies,
    inVariation: state.branch !== null,
    goToPly: state.goToPly,
  });
  const pausePlayback = playback.pause;
  const playUciOnBoard = useCallback((uci: string) => {
    const promo = uci[4];
    return useReviewStore.getState().playAnalysisMove(
      uci.slice(0, 2),
      uci.slice(2, 4),
      promo === "q" || promo === "r" || promo === "b" || promo === "n" ? promo : undefined,
    );
  }, []);
  // In-place mistake practice. It drives navigation itself, so it is created
  // after playback and receives the canonical ply setter.
  const retro = useRetrospect({ analysis: state.analysis, goToPly: state.goToPly, playUci: playUciOnBoard });
  const branchPositionFen = state.branch ? state.positionFen : null;
  const canonicalPositionResult = state.branch ? null : state.analysis?.moves[state.currentPly]?.stockfish ?? null;
  const candidateResult = continuationResult ?? canonicalPositionResult;
  // While practising, the board holds the position BEFORE the fault — and after
  // a correct answer it holds a variation rooted there. The human request, the
  // built facts and the ply they are stored against must stay on the fault
  // itself for the whole session, including while that variation exists.
  // Keying off the board-derived move would file the facts under the wrong ply
  // (or drop them the moment playAnalysisMove sets a branch).
  const reviewedAnalysis = retro.active && retro.current !== null
    ? state.analysis?.moves[retro.current.faultPly - 1] ?? null
    : state.branch || state.currentPly === 0
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
    localAi,
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
  const [exportBusy, setExportBusy] = useState(false);
  const exporting = useRef(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const shareCopiedTimer = useRef<number | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const requestedPlyApplied = useRef<string | null>(null);
  const legalDestinations = useMemo(
    () => selectedSquare ? legalBoardDestinations(state.positionFen, selectedSquare) : [],
    [selectedSquare, state.positionFen],
  );
  const boardSquareStyles = useMemo(
    () => boardMoveHintStyles(selectedSquare, legalDestinations, retro.hintSquare),
    [legalDestinations, retro.hintSquare, selectedSquare],
  );

  useEffect(() => {
    setSelectedSquare(null);
    setPendingPromotion(null);
  }, [state.positionFen]);

  useEffect(() => {
    if (loadState !== "ready" || !state.game) return;
    const identity = `${gameId}:${search}`;
    if (requestedPlyApplied.current === identity) return;
    requestedPlyApplied.current = identity;
    const rawPly = new URLSearchParams(search).get("ply");
    // Removing a deep-link query during section navigation must not reset the
    // persistent board or discard an exploratory line (Number(null) is zero).
    if (rawPly === null || !/^\d+$/.test(rawPly)) return;
    const requested = Number(rawPly);
    if (Number.isInteger(requested) && requested >= 0) state.goToPly(requested);
  }, [gameId, loadState, search, state.game, state.goToPly]);

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

  // Whatever the visitor can see in free analysis counts as having seen the answer
  // for that ply: arrows, evaluation and the verdict panel are all on screen. A
  // later practice attempt at the same position is still useful, but it is not a
  // first-time solve, and the session records that. A withheld answer is not
  // visible, so it does not count.
  useEffect(() => {
    if (retro.active || state.currentPly === 0 || state.concealedPly === state.currentPly) return;
    retro.noteAnswerExposed(state.currentPly);
  }, [retro.active, retro.noteAnswerExposed, state.concealedPly, state.currentPly]);

  // The promotion chooser owns Escape while it is open, and every other
  // shortcut stays suspended until it closes.
  useEffect(() => {
    if (!pendingPromotion) return;
    function closeChooser(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setPendingPromotion(null);
    }
    window.addEventListener("keydown", closeChooser);
    return () => window.removeEventListener("keydown", closeChooser);
  }, [pendingPromotion]);

  const boardGeometry = useBoardGeometryPreference();
  const boardDisplay = useBoardDisplaySettings();
  const [focusBoard, setFocusBoard] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const toggleFocusBoard = useCallback(() => setFocusBoard((focused) => !focused), []);
  const openShortcutHelp = useCallback(() => setShortcutHelpOpen(true), []);
  const leaveVariation = useCallback(() => {
    const review = useReviewStore.getState();
    if (review.branch) {
      pausePlayback();
      review.returnToGame();
      return;
    }
    // Focus board is transient session state, so Escape also closes it.
    setFocusBoard(false);
  }, [pausePlayback]);

  useDismissibleDetails();

  const boardControlsRef = useRef<HTMLDetailsElement>(null);
  const openMoveEntry = useCallback(() => {
    const menu = boardControlsRef.current;
    if (menu) menu.open = true;
    window.requestAnimationFrame(() => document.getElementById("board-move-input")?.focus());
  }, []);

  useReviewKeyboardShortcuts({
    previous: navigatePrevious,
    next: navigateNext,
    first: navigateFirst,
    last: navigateLast,
    togglePlayback: playback.toggle,
    leaveVariation,
    flipBoard,
    toggleFocus: toggleFocusBoard,
    toggleMoveEntry: openMoveEntry,
    toggleHelp: openShortcutHelp,
  }, { suspended: pendingPromotion !== null || shortcutHelpOpen });

  const root = `/review/${gameId}`;

  if (loadState !== "ready" || !record) {
    return (
      <main className="review-loading">
        <LocalDataNotice />
        <div className="review-titlebar">
          <Link className="brand review-home" href="/" aria-label="Open Chess Review home">
            <span className="brand-mark"><BrandMark decorative /></span>
          </Link>
        </div>
        <section>
          <span className="brand-mark"><BrandMark decorative /></span>
          <h1>{loadState === "missing" ? "Review not found" : loadState === "error" ? "Unable to open review" : "Preparing workspace"}</h1>
          <p>{loadError ?? (loadState === "missing" ? "This browser has no record for that review ID." : "Loading the persisted game and analysis cache…")}</p>
          {loadState === "error" && <button type="button" className="secondary" onClick={() => window.location.reload()}>Retry opening review</button>}
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
  // Guided review and free exploration are the product's two working modes, so
  // both are reachable from the titlebar. Analysis is the existing Engine Lab
  // route (engine, explorer, tablebase) under the name that says what it is for;
  // burying it under More left the free half of the product looking like a
  // utility beside History and Settings.
  const primary = [
    { href: root, label: "Review" },
    { href: `${root}/moves`, label: "Moves" },
    { href: `${root}/coach`, label: "Study" },
    { href: `${root}/engine`, label: "Analysis" },
  ];
  const more = [
    { href: `${root}/notebook`, label: "Notebook" },
  ];
  const sectionHref = (href: string) => (
    trainingId
      ? `${href}?${new URLSearchParams({ training: trainingId, position: query.get("position") ?? "", ply: String(state.currentPly) })}`
      : href
  );
  const moreOpen = more.some((item) => pathname === item.href);
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

  async function runExport(label: string, action: () => void | Promise<void>) {
    if (exporting.current) return;
    exporting.current = true; setExportBusy(true); setExportError(null);
    try { await action(); }
    catch (cause) { setExportError(`${label} export failed. ${cause instanceof Error ? cause.message : "Please try again."}`); }
    finally { exporting.current = false; setExportBusy(false); }
  }

  function playBoardMove(from: string, to: string, promotion?: "q" | "r" | "b" | "n") {
    const destinations = legalBoardDestinations(state.positionFen, from).filter((move) => move.to === to);
    const promotionChoices = destinations.flatMap((move) => (
      move.promotion === "q" || move.promotion === "r" || move.promotion === "b" || move.promotion === "n"
        ? [move.promotion]
        : []
    ));
    if (promotionChoices.length > 0 && promotion === undefined) {
      setPendingPromotion({ from, to });
      return false;
    }
    setPendingPromotion(null);
    if (retro.evaluating || retro.status === "rejected" || retro.status === "rewinding") return false;
    const practice = retro.active && retro.locked && !state.branch ? retro.current : null;
    if (practice && state.currentPly === practice.promptPly) {
      if (!destinations.some((move) => move.to === to)) return false;
      const played = state.playAnalysisMove(from, to, promotion);
      if (!played) return false;
      void retro.attempt(`${from}${to}${promotion ?? ""}`);
      return true;
    }
    return state.playAnalysisMove(from, to, promotion);
  }

  async function exportPositionPng() {
    const fen = state.positionFen;
    const title = state.branch
      ? `Analysis variation · ${selectedBranchMove?.san ?? "root"}`
      : currentMove
        ? `${currentMove.moveNumber}${currentMove.color === "white" ? "." : "…"} ${currentMove.san}`
        : "Starting position";
    if (state.analysis && currentAnalysis && !state.branch) {
      downloadBlob(await renderPositionCard(state.analysis, currentAnalysis, state.orientation, settings.pieceSet), reviewFilename(state.analysis, `move-${currentAnalysis.ply}.png`));
      return;
    }
    downloadBlob(
      await renderDisplayedPositionCard({
        fen,
        orientation: state.orientation,
        title,
        subtitle: state.analysis?.opening ? `${state.analysis.opening.eco} · ${state.analysis.opening.name}` : "Displayed position",
        pieceSet: settings.pieceSet,
      }),
      `${title.replaceAll(" ", "-").toLowerCase()}.png`,
    );
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
    // While a practice answer is owed, jumping to any ply at or past the fault
    // would reveal its classification and engine continuation. Rewind instead.
    if (!state.branch && retro.locked && ply > (retro.current?.promptPly ?? 0)) {
      state.goToPly(retro.current?.promptPly ?? 0);
      return;
    }
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
    // While a practice answer is owed, the next move is the answer: refuse to walk
    // past it, matching Lichess retrospect's preventGoingToNextMove.
    if (!state.branch && retro.locked && state.currentPly >= (retro.current?.promptPly ?? 0)) return;
    if (state.branch) state.stepBranch(1);
    else state.goToPly(state.currentPly + 1);
  }

  function navigateLast() {
    playback.pause();
    if (state.branch) state.stepBranch(state.branch.activePath.length - 1 - state.branch.selectedIndex);
    // Mid-practice the last move is the answer; stay on the prompt position.
    else if (retro.locked) navigateToPly(retro.current?.promptPly ?? 0);
    else state.goToPly(totalPlies);
  }

  const runtime = {
    gameId,
    record,
    notebook,
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
    runDiagnostics,
    runDiagnosticsSummary,
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
    playMove: playBoardMove,
    concealAnswer: state.concealAnswer,
    clearConcealment: state.clearConcealment,
    pausePlayback,
    retro,
    openNotebookPosition: (rootPly: number, line: string[]) => {
      playback.pause();
      state.openNotebookPosition(rootPly, line);
    },
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

  // What a screen reader hears after every move or route change.
  const positionAnnouncement = state.branch
    ? `Analysis variation, ${selectedBranchMove?.san ?? "root"}.`
    : currentMove === null
      ? `Starting position. ${state.game?.initialFen.split(" ")[1] === "b" ? "Black" : "White"} to move.`
      : `${currentMove.moveNumber}${currentMove.color === "white" ? "." : "\u2026"} ${currentMove.san}. ${currentMove.color === "white" ? "Black" : "White"} to move.`;

  // Practice owns the answer; a withheld guided moment borrows the same policy so
  // the board, the exports and the panels cannot disagree about what is visible.
  const concealed = concealedAnswerPly({ concealedPly: state.concealedPly, currentPly: state.currentPly, practiceActive: retro.active }) !== null;
  const presentation = withheldPresentation(retro.presentation, concealed);
  const analysesHidden = presentation.hideAnalysisExports;

  return (
    <ReviewRuntimeProvider value={runtime}>
      <main className="review-shell">
        <LocalDataNotice />
        <div className="review-titlebar">
          <Link className="brand review-home" href="/" aria-label="Open Chess Review home">
            <span className="brand-mark"><BrandMark decorative /></span>
          </Link>
          <div className="review-title"><strong>{record.title}</strong><small>{record.subtitle}</small></div>
          <nav className="review-nav" aria-label="Review sections">
            {primary.map((item) => (
              <Link aria-current={pathname === item.href ? "page" : undefined} className={pathname === item.href ? "active" : ""} href={sectionHref(item.href)} key={item.href}>
                {item.label}{item.label === "Study" && coachRuntime.task?.status === "running" ? <small>Generating…</small> : null}
              </Link>
            ))}
          </nav>
          <div className="review-actions">
            <details className={moreOpen ? "review-more open" : "review-more"}>
              <summary>More</summary>
              <div className="action-menu">
                {more.map((item) => (
                  <Link aria-current={pathname === item.href ? "page" : undefined} className={pathname === item.href ? "active" : ""} href={sectionHref(item.href)} key={item.href}>{item.label}</Link>
                ))}
                <Link href="/history">History</Link>
                <Link href="/training">Training</Link>
                <Link href="/settings">Settings</Link>
              </div>
            </details>
            <details key={`export-${pathname}`}><summary>Export</summary><div className="action-menu">
              {record.kind === "pgn" && <button type="button" disabled={exportBusy} onClick={() => void runExport("Original PGN", () => downloadText(record.originalPgn ?? record.input, "application/x-chess-pgn", `review-${record.id}-original.pgn`))}>Original PGN</button>}
              {record.kind === "pgn" && <button type="button" disabled={exportBusy} onClick={() => {
                void runExport("Copy share link", async () => {
                  const pgn = record.originalPgn ?? record.input;
                  const url = buildShareUrl(pgn, window.location.origin);
                  if (!url) throw new Error("This game is too large to share by link. Use Original PGN to export instead.");
                  // The link is always shown as well as copied: the clipboard API
                  // is unavailable on some browsers and needs a permission on
                  // others, and the visitor still needs a way to take the link.
                  setShareUrl(url);
                  try {
                    await navigator.clipboard.writeText(url);
                  } catch {
                    setShareCopied(false);
                    return;
                  }
                  setShareCopied(true);
                  if (shareCopiedTimer.current !== null) window.clearTimeout(shareCopiedTimer.current);
                  shareCopiedTimer.current = window.setTimeout(() => { shareCopiedTimer.current = null; setShareCopied(false); }, 3000);
                });
              }}>Copy share link</button>}
              {shareCopied && <small role="status">Share link copied to clipboard</small>}
              {shareUrl !== null && <input className="share-link-value" aria-label="Share link" readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />}
              {record.kind === "pgn" && <small className="export-note">Original keeps imported comments and variations. Annotated adds analysis to the mainline. A share link opens the game in the recipient's own browser — nothing is uploaded.</small>}
              {/* Every one of these carries the answer for the position being
                  solved, so they wait until the attempt is finished. */}
              <button type="button" disabled={exportBusy || !state.analysis || analysesHidden} onClick={() => void runExport("Canonical JSON", () => { if (state.analysis) downloadText(exportAnalysisJson(state.analysis), "application/json", reviewFilename(state.analysis, "analysis.json")); })}>Canonical JSON</button>
              <button type="button" disabled={exportBusy || !state.analysis || analysesHidden} onClick={() => void runExport("Annotated PGN", () => { if (state.analysis) downloadText(exportAnnotatedPgn(state.analysis), "application/x-chess-pgn", reviewFilename(state.analysis, "annotated.pgn")); })}>Annotated PGN</button>
              <button type="button" disabled={exportBusy || analysesHidden} onClick={() => void runExport("Position PNG", exportPositionPng)}>Position PNG</button>
              <button type="button" disabled={exportBusy || !state.analysis || analysesHidden} onClick={() => void runExport("Review PNG", exportReviewPng)}>Review PNG</button>
              {analysesHidden
                ? <small role="status">Analysis exports are withheld while you solve this position.</small>
                : exportBusy && <small role="status">Preparing export…</small>}
            </div></details>
          </div>
        </div>

        {exportError && <div className="review-export-error" role="alert"><p className="error">{exportError} Open Export to retry.</p><button type="button" className="text-button" onClick={() => setExportError(null)}>Dismiss export error</button></div>}

        <div
          className={`review-workspace${focusBoard ? " focus-board" : ""}`}
          style={boardGeometry.size === null ? undefined : ({ "--review-board-preference": `${boardGeometry.size}px` } as CSSProperties)}
        >
          <div className="analysis-column">
            <section className="position-workspace" aria-label="Persistent board workspace">
              <div className="board-player-header">
                <PlayerStrip player={orderedPlayers.top} />
                <div className="board-toolbar">
                <BoardControls
                  menuRef={boardControlsRef}
                  geometry={boardGeometry}
                  onShowShortcuts={openShortcutHelp}
                  soundEnabled={soundRuntime.soundEnabled}
                  onToggleSound={soundRuntime.toggleMuted}
                  focusBoard={focusBoard}
                  onToggleFocus={toggleFocusBoard}
                  moveEntry={<MoveEntry compact />}
                />
                {focusBoard && <BoardFocusButton focused={focusBoard} onToggle={toggleFocusBoard} />}
                <BoardFlipButton onFlip={flipBoard} />
                </div>
              </div>
              <div className="board-stage">
                <EvaluationBar
                  mode={humanRuntime.mode}
                  stockfish={displayedScore}
                  maia={humanRuntime.positionAnalysis}
                  orientation={state.orientation}
                  valuesHidden={!presentation.showEvalValues}
                />
                <div className="board-wrap" ref={boardGeometry.boardRef}>
                  <Chessboard options={{
                    position: state.positionFen,
                    pieces,
                    allowDragging: true,
                    allowDrawingArrows: !retro.locked,
                    arrows: pendingPromotion
                      ? []
                      : retro.presentation.showFaultArrow && retro.current
                        ? [faultArrow(retro.current.faultUci)].flatMap((arrow) => arrow ? [arrow] : [])
                        : boardDisplay.boardArrows && presentation.showEngineArrows ? boardArrows : [],
                    arrowOptions: { ...defaultArrowOptions, arrowWidthDenominator: 9, opacity: .76 },
                    boardOrientation: state.orientation,
                    showNotation: boardDisplay.boardCoordinates === "inside",
                    animationDurationInMs: PIECE_ANIMATION_MS[boardDisplay.pieceAnimation],
                    squareStyles: boardSquareStyles,
                    // Name each square for assistive technology. The renderer replaces
                    // the library's own square content, so it reapplies the highlight
                    // styles the library would otherwise have drawn.
                    // A group, not an image: the square's content holds the
                    // library's draggable piece button, and role="img" would make
                    // that button presentational. The group names the square; the
                    // piece renderers name the piece inside it.
                    squareRenderer: ({ square, children }) => (
                      <div
                        style={{ width: "100%", height: "100%", ...(boardSquareStyles[square] ?? {}) }}
                        role="group"
                        aria-label={boardSquareDescription(square)}
                      >
                        {children}
                      </div>
                    ),
                    canDragPiece: ({ piece }) => !pendingPromotion && !retro.evaluating && retro.status !== "rejected" && retro.status !== "rewinding" && pieceMatchesTurn(piece.pieceType, state.positionFen),
                    onPieceDrag: ({ piece, square }) => {
                      if (square && pieceMatchesTurn(piece.pieceType, state.positionFen)) setSelectedSquare(square);
                    },
                    onPieceDragCancel: () => setSelectedSquare(null),
                    onPieceDrop: ({ sourceSquare, targetSquare }) => {
                      setSelectedSquare(null);
                      if (pendingPromotion || !targetSquare) return false;
                      playback.pause();
                      return playBoardMove(sourceSquare, targetSquare);
                    },
                    onSquareClick: ({ piece, square }) => {
                      if (pendingPromotion || retro.evaluating || retro.status === "rejected" || retro.status === "rewinding") return;
                      if (selectedSquare) {
                        const destination = legalDestinations.find((move) => move.to === square);
                        if (destination) {
                          playback.pause();
                          playBoardMove(selectedSquare, square);
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
                    lightSquareStyle: WINDOWLIGHT_BOARD_APPEARANCE.lightSquareStyle,
                    darkSquareStyle: WINDOWLIGHT_BOARD_APPEARANCE.darkSquareStyle,
                    lightSquareNotationStyle: WINDOWLIGHT_BOARD_APPEARANCE.lightSquareNotationStyle,
                    darkSquareNotationStyle: WINDOWLIGHT_BOARD_APPEARANCE.darkSquareNotationStyle,
                    boardStyle: WINDOWLIGHT_BOARD_APPEARANCE.boardStyle,
                  }} />
                  {pendingPromotion && (
                    <div className="promotion-chooser" role="dialog" aria-label="Choose promotion piece">
                      <div className="promotion-pieces">
                        {([
                          ["q", "Queen"],
                          ["r", "Rook"],
                          ["b", "Bishop"],
                          ["n", "Knight"],
                        ] as const).map(([piece, label]) => {
                          const PromotionPiece = pieces[`${state.positionFen.split(" ")[1] === "b" ? "b" : "w"}${piece.toUpperCase()}`];
                          return (
                            <button
                              type="button"
                              key={piece}
                              autoFocus={piece === "q"}
                              onClick={() => {
                                playback.pause();
                                playBoardMove(pendingPromotion.from, pendingPromotion.to, piece);
                              }}
                            >
                              <span className="promotion-piece" aria-hidden="true">{PromotionPiece && <PromotionPiece />}</span>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <button type="button" className="promotion-cancel" onClick={() => setPendingPromotion(null)}>Cancel</button>
                    </div>
                  )}
                  {!pendingPromotion && boardDisplay.boardQualityBadge && presentation.showMoveBadge && (state.branch && selectedBranchMove && selectedBranchQuality?.state === "complete"
                    ? <BoardQualityBadge square={selectedBranchMove.uci.slice(2, 4)} orientation={state.orientation} classification={selectedBranchQuality.classification} />
                    : currentAnalysis && !state.branch
                      ? <BoardQualityBadge square={currentAnalysis.uci.slice(2, 4)} orientation={state.orientation} classification={currentAnalysis.classification} />
                      : null)}
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
                {state.branch && <p className="branch-session-note">Temporary variation · not saved automatically. <Link href={trainingId ? `${root}/notebook?${new URLSearchParams({ training: trainingId, position: query.get("position") ?? "", ply: String(state.currentPly) })}` : `${root}/notebook`}>Save this position in Notebook →</Link></p>}
                <MoveTransport
                  isPlaying={playback.isPlaying}
                  inVariation={state.branch !== null}
                  playDisabled={state.branch !== null || totalPlies === 0 || retro.locked}
                  atStart={state.branch ? state.branch.selectedIndex === 0 : state.currentPly === 0}
                  atEnd={state.branch ? state.branch.selectedIndex === state.branch.activePath.length - 1 : state.currentPly === totalPlies}
                  onFirst={navigateFirst}
                  onPrevious={navigatePrevious}
                  onTogglePlayback={playback.toggle}
                  onNext={navigateNext}
                  onLast={navigateLast}
                />
                {/* The board's squares are not focusable and carry no names, so the
                    workspace states what the board holds: FEN on demand, plus a polite
                    announcement after every move. Operating the board is typed-move
                    entry in Board settings, the transport, and the named move/candidate buttons. */}
                <p className="sr-only">{`Board position: ${state.positionFen}`}</p>
                <p className="sr-only" role="status" aria-live="polite">{positionAnnouncement}</p>
              </div>
            </section>

          </div>

          <aside className={`context-panel${pathname === `${root}/moves` ? " moves-context" : ""}${trainingId ? " training-context" : ""}`}>
            {trainingId && <TrainingSession taskId={trainingId} positionKey={query.get("position")} record={record} />}
            <ReviewSessionProvider gameId={gameId} analysis={state.analysis}>{children}</ReviewSessionProvider>
          </aside>
        </div>
        {shortcutHelpOpen && <ShortcutHelp onClose={() => setShortcutHelpOpen(false)} />}
      </main>
    </ReviewRuntimeProvider>
  );
}
