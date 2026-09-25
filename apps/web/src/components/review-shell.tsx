"use client";

import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { replayUciLine } from "@chess-review/chess-core";
import { buildHumanAnalysis, matchesHumanAnalysisIdentity } from "@chess-review/analysis";
import { formatMoveNotation, type StockfishMoveAnalysis, type UiLanguage } from "@chess-review/shared";
import { useUiLanguage } from "../hooks/use-ui-language";
import { TrainingSession } from "./training-session";
import { ReviewRuntimeProvider } from "./review-runtime";
import { ReviewSessionProvider } from "./review-session-state";
import { ReviewBoardSurface } from "./review/review-board-surface";
import { ReviewContextAside, ReviewLoadingChrome, ReviewTitlebar, ReviewWorkbenchHead } from "./review/review-chrome";
import { ReviewExportErrorBanner, ReviewExportProvider } from "./review/review-export-menu";
import { ShortcutHelp } from "./review/shortcut-help";
import { useBoardGeometryPreference } from "../hooks/use-board-geometry-preference";
import { useDismissibleDetails } from "../hooks/use-dismissible-details";
import { useBoardDisplaySettings } from "../hooks/use-board-display-settings";
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
import { loadAppSettings } from "../lib/app-settings";
import { useLocalAiHealth } from "../lib/use-local-ai-health";
import {
  analysisModeArrows,
  matchingHumanCandidate,
  matchingStockfishCandidate,
  type HumanCandidateIdentity,
  type StockfishCandidateIdentity,
} from "../lib/board-analysis-arrows";
import { concealedAnswerPly, withheldPresentation } from "../lib/practice-presentation";
import { criticalMomentPlies, keyMomentPosition } from "../lib/critical-moment-navigation";
import { moveEvidenceSentence } from "../lib/move-evidence-copy";
import { displayedMoveQualityLabel } from "../lib/move-quality-label";
import { selectedBranchNode } from "../lib/analysis-branch";
import { orderPlayersForBoard } from "../lib/player-identity";
import { saveReviewRecord, type ReviewRecord } from "../lib/review-library";
import { useReviewStore } from "../store/review-store";

type ShellCopy = {
  stepStart: string;
  stepEnd: string;
  stepKeyMoment: (index: number) => string;
  navReview: string;
  navMoves: string;
  navStudy: string;
  navAnalysis: string;
  navNotebook: string;
  variationRoot: string;
  variationAnnouncement: (san: string) => string;
  startingAnnouncement: (side: string) => string;
  moveAnnouncement: (moveNumber: string, san: string, side: string) => string;
  kickerStart: string;
  kickerKeyMoment: (index: number, total: number) => string;
  kickerMove: (moveNumber: number) => string;
  displayWalkThrough: string;
  displayPractice: string;
  ledeMoments: (count: number) => string;
  ledeEachMove: string;
  sideWhite: string;
  sideBlack: string;
};

/* The review desk's own wording. The side names are here rather than only in the
   Coach because the shell announces them to a screen reader after every move. */
const COPY: Record<UiLanguage, ShellCopy> = {
  en: {
    stepStart: "Start",
    stepEnd: "End",
    stepKeyMoment: (index) => `Key moment ${index}`,
    navReview: "Review",
    navMoves: "Moves",
    navStudy: "Study",
    navAnalysis: "Analysis",
    navNotebook: "Notebook",
    variationRoot: "root",
    variationAnnouncement: (san) => `Analysis variation, ${san}.`,
    startingAnnouncement: (side) => `Starting position. ${side} to move.`,
    moveAnnouncement: (moveNumber, san, side) => `${moveNumber} ${san}. ${side} to move.`,
    kickerStart: "Start",
    kickerKeyMoment: (index, total) => `Key moment ${index} of ${total}`,
    kickerMove: (moveNumber) => `Move ${moveNumber}`,
    displayWalkThrough: "Walk through this game.",
    displayPractice: "Practice this position",
    ledeMoments: (count) => `${count} ${count === 1 ? "moment carries" : "moments carry"} what changed in this game.`,
    ledeEachMove: "Each move, then the evidence for the one on the board.",
    sideWhite: "White",
    sideBlack: "Black",
  },
  "zh-CN": {
    stepStart: "开始",
    stepEnd: "结束",
    stepKeyMoment: (index) => `关键节点 ${index}`,
    navReview: "复盘",
    navMoves: "着法",
    navStudy: "学习",
    navAnalysis: "分析",
    navNotebook: "笔记",
    variationRoot: "起点",
    variationAnnouncement: (san) => `变例，${san}。`,
    startingAnnouncement: (side) => `起始局面。轮到${side}走。`,
    moveAnnouncement: (moveNumber, san, side) => `${moveNumber} ${san}。轮到${side}走。`,
    kickerStart: "开始",
    kickerKeyMoment: (index, total) => `关键节点 ${index} / ${total}`,
    kickerMove: (moveNumber) => `第 ${moveNumber} 步`,
    displayWalkThrough: "逐步走过这盘棋。",
    displayPractice: "练习这个局面",
    ledeMoments: (count) => `这盘棋有 ${count} 个关键节点，记录着局势的变化。`,
    ledeEachMove: "每一步，然后是棋盘上这一步的依据。",
    sideWhite: "白方",
    sideBlack: "黑方",
  },
};

function reviewStepTrail(
  currentPly: number,
  totalPlies: number,
  keyPlies: readonly number[],
  copy: ShellCopy,
): { label: string; current: boolean }[] {
  const keyIndex = keyPlies.indexOf(currentPly);
  let currentId: string;
  if (currentPly === 0) currentId = "start";
  else if (keyIndex !== -1) currentId = `k${keyIndex}`;
  else if (totalPlies > 0 && currentPly >= totalPlies) currentId = "end";
  else {
    currentId = "start";
    for (let i = 0; i < keyPlies.length; i++) {
      if (keyPlies[i]! <= currentPly) currentId = `k${i}`;
    }
  }
  return [
    { label: copy.stepStart, current: currentId === "start" },
    ...keyPlies.map((_, index) => ({ label: copy.stepKeyMoment(index + 1), current: currentId === `k${index}` })),
    { label: copy.stepEnd, current: currentId === "end" },
  ];
}

export function ReviewShell({ children }: { children: ReactNode }) {
  const params = useParams<{ gameId: string }>();
  const pathname = usePathname();
  const language = useUiLanguage();
  const copy = COPY[language];
  const search = useSearchParams().toString();
  const query = new URLSearchParams(search);
  const trainingId = query.get("training");
  const gameId = params.gameId;
  const review = useReviewStore(useShallow((store) => ({
    game: store.game,
    analysis: store.analysis,
    currentPly: store.currentPly,
    positionFen: store.positionFen,
    orientation: store.orientation,
    branch: store.branch,
    concealedPly: store.concealedPly,
    goToPly: store.goToPly,
    concealAnswer: store.concealAnswer,
    clearConcealment: store.clearConcealment,
    setOrientation: store.setOrientation,
    playAnalysisMove: store.playAnalysisMove,
    startEngineLine: store.startEngineLine,
    playHumanCandidate: store.playHumanCandidate,
    stepBranch: store.stepBranch,
    returnToGame: store.returnToGame,
    openNotebookPosition: store.openNotebookPosition,
  })));
  const settings = useMemo(() => loadAppSettings(), []);
  const pieces = useBoardPieces();
  // Review's Maia and Coach surfaces share one capability poller. This keeps
  // route transitions and health updates from creating duplicate /health
  // requests and intervals.
  const localAi = useLocalAiHealth();
  const soundRuntime = useChessSounds({
    game: review.game,
    currentPly: review.currentPly,
    branch: review.branch,
  });
  const analysisRuntime = useReviewAnalysis({
    gameId,
    positionFen: review.positionFen,
    currentPly: review.currentPly,
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
  const players = usePlayerIdentities(record, review.game);
  const notebook = useReviewNotebook(loadState === "ready" ? record : null);
  const orderedPlayers = orderPlayersForBoard(players, review.orientation);
  const totalPlies = review.game?.plies.length ?? 0;
  const playback = useReviewPlayback({
    currentPly: review.currentPly,
    totalPlies,
    inVariation: review.branch !== null,
    goToPly: review.goToPly,
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
  const retro = useRetrospect({ analysis: review.analysis, goToPly: review.goToPly, playUci: playUciOnBoard });
  const branchPositionFen = review.branch ? review.positionFen : null;
  const canonicalPositionResult = review.branch ? null : review.analysis?.moves[review.currentPly]?.stockfish ?? null;
  const candidateResult = continuationResult ?? canonicalPositionResult;
  // While practising, the board holds the position BEFORE the fault — and after
  // a correct answer it holds a variation rooted there. The human request, the
  // built facts and the ply they are stored against must stay on the fault
  // itself for the whole session, including while that variation exists.
  // Keying off the board-derived move would file the facts under the wrong ply
  // (or drop them the moment playAnalysisMove sets a branch).
  const reviewedAnalysis = retro.active && retro.current !== null
    ? review.analysis?.moves[retro.current.faultPly - 1] ?? null
    : review.branch || review.currentPly === 0
      ? null
      : review.analysis?.moves[review.currentPly - 1] ?? null;
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
    positionFen: review.positionFen,
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
  // Board owns selection/promotion/practice I/O; shell only bridges playMove +
  // suspends shortcuts while the promotion chooser is open.
  const playMoveRef = useRef<(from: string, to: string, promotion?: "q" | "r" | "b" | "n") => boolean>(() => false);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const onPlayMoveReady = useCallback((playMove: typeof playMoveRef.current) => {
    playMoveRef.current = playMove;
  }, []);
  const playBoardMove = useCallback((from: string, to: string, promotion?: "q" | "r" | "b" | "n") => (
    playMoveRef.current(from, to, promotion)
  ), []);
  const requestedPlyApplied = useRef<string | null>(null);

  useEffect(() => {
    if (loadState !== "ready" || !review.game) return;
    const identity = `${gameId}:${search}`;
    if (requestedPlyApplied.current === identity) return;
    requestedPlyApplied.current = identity;
    const rawPly = new URLSearchParams(search).get("ply");
    // Removing a deep-link query during section navigation must not reset the
    // persistent board or discard an exploratory line (Number(null) is zero).
    if (rawPly === null || !/^\d+$/.test(rawPly)) return;
    const requested = Number(rawPly);
    if (Number.isInteger(requested) && requested >= 0) review.goToPly(requested);
  }, [gameId, loadState, search, review.game, review.goToPly]);

  useEffect(() => {
    if (!review.analysis) return;
    const before = review.analysis;
    const updated = useReviewStore.getState().invalidateHumanAnalysis(humanRuntime.model, humanRuntime.targetElo);
    if (updated && updated !== before) persistEnrichedAnalysis(updated);
  }, [humanRuntime.model, humanRuntime.targetElo, persistEnrichedAnalysis, review.analysis]);

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
    if (retro.active || review.currentPly === 0 || review.concealedPly === review.currentPly) return;
    retro.noteAnswerExposed(review.currentPly);
  }, [retro.active, retro.noteAnswerExposed, review.concealedPly, review.currentPly]);

  // Promotion Escape is owned by ReviewBoardSurface; shortcuts stay
  // suspended while the chooser is open (see useReviewKeyboardShortcuts below).

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
    return <ReviewLoadingChrome loadState={loadState} loadError={loadError} />;
  }

  const currentMove = review.currentPly === 0 ? null : review.game?.plies[review.currentPly - 1] ?? null;
  const currentAnalysis = review.currentPly === 0 ? null : review.analysis?.moves[review.currentPly - 1] ?? null;
  const selectedBranch = review.branch ? selectedBranchNode(review.branch) : null;
  const selectedBranchQuality = selectedBranch?.moveQuality;
  const positionResult = canonicalPositionResult;
  const displayedResult = engineResult ?? continuationResult ?? positionResult;
  const displayedScore = displayedResult?.score
    ?? currentAnalysis?.evaluationAfter
    ?? review.analysis?.moves[0]?.evaluationBefore
    ?? null;
  // Guided review and free exploration are the product's two working modes, so
  // both are reachable from the titlebar. Analysis is the existing Engine Lab
  // route (engine, explorer, tablebase) under the name that says what it is for;
  // burying it under More left the free half of the product looking like a
  // utility beside History and Settings.
  const primary = [
    { href: root, label: copy.navReview },
    { href: `${root}/moves`, label: copy.navMoves },
    { href: `${root}/coach`, label: copy.navStudy },
    { href: `${root}/engine`, label: copy.navAnalysis },
  ];
  const more = [
    { href: `${root}/notebook`, label: copy.navNotebook },
  ];
  const sectionHref = (href: string) => (
    trainingId
      ? `${href}?${new URLSearchParams({ training: trainingId, position: query.get("position") ?? "", ply: String(review.currentPly) })}`
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

  function flipBoard() {
    if (!record) return;
    const orientation: "white" | "black" = review.orientation === "white" ? "black" : "white";
    review.setOrientation(orientation);
    const updated: ReviewRecord = { ...record, orientationOverride: orientation };
    setRecord(updated);
    void saveReviewRecord(updated).catch(() => undefined);
  }

  function navigateToPly(ply: number) {
    playback.pause();
    // While a practice answer is owed, jumping to any ply at or past the fault
    // would reveal its classification and engine continuation. Rewind instead.
    if (!review.branch && retro.locked && ply > (retro.current?.promptPly ?? 0)) {
      review.goToPly(retro.current?.promptPly ?? 0);
      return;
    }
    review.goToPly(ply);
  }

  function navigateFirst() {
    playback.pause();
    if (review.branch) review.stepBranch(-review.branch.selectedIndex);
    else review.goToPly(0);
  }

  function navigatePrevious() {
    playback.pause();
    if (review.branch) review.stepBranch(-1);
    else review.goToPly(review.currentPly - 1);
  }

  function navigateNext() {
    playback.pause();
    // While a practice answer is owed, the next move is the answer: refuse to walk
    // past it, matching Lichess retrospect's preventGoingToNextMove.
    if (!review.branch && retro.locked && review.currentPly >= (retro.current?.promptPly ?? 0)) return;
    if (review.branch) review.stepBranch(1);
    else review.goToPly(review.currentPly + 1);
  }

  function navigateLast() {
    playback.pause();
    if (review.branch) review.stepBranch(review.branch.activePath.length - 1 - review.branch.selectedIndex);
    // Mid-practice the last move is the answer; stay on the prompt position.
    else if (retro.locked) navigateToPly(retro.current?.promptPly ?? 0);
    else review.goToPly(totalPlies);
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
    // The snapshot above deliberately freezes the analysis settings so an in-flight
    // engine request is not disturbed. The language is not one of those: it has to
    // follow the setting, or a language change inside a review would not reach the
    // lesson panel until the route remounted.
    uiLanguage: language,
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
    concealAnswer: review.concealAnswer,
    clearConcealment: review.clearConcealment,
    pausePlayback,
    retro,
    openNotebookPosition: (rootPly: number, line: string[]) => {
      playback.pause();
      review.openNotebookPosition(rootPly, line);
    },
    playContinuation: (identity: StockfishCandidateIdentity, result: StockfishMoveAnalysis | null = candidateResult) => {
      const line = matchingStockfishCandidate(result, identity);
      if (!line) return;
      try {
        playback.pause();
        review.startEngineLine(identity.rank, replayUciLine(identity.fen, line.pv));
      } catch (error) {
        analysisRuntime.reportContinuationError(error);
      }
    },
    playHumanCandidate: (identity: HumanCandidateIdentity) => {
      const candidate = matchingHumanCandidate(humanRuntime.positionAnalysis, identity);
      if (!candidate || review.positionFen !== identity.fen) return;
      playback.pause();
      review.playHumanCandidate(candidate.uci, identity.targetElo, candidate.probability);
    },
    persistEnrichedAnalysis,
  };

  // What a screen reader hears after every move or route change.
  const positionAnnouncement = review.branch
    ? copy.variationAnnouncement(selectedBranchMove?.san ?? copy.variationRoot)
    : currentMove === null
      ? copy.startingAnnouncement(review.game?.initialFen.split(" ")[1] === "b" ? copy.sideBlack : copy.sideWhite)
      : copy.moveAnnouncement(`${currentMove.moveNumber}${currentMove.color === "white" ? "." : "\u2026"}`, currentMove.san, currentMove.color === "white" ? copy.sideBlack : copy.sideWhite);

  // Practice owns the answer; a withheld guided moment borrows the same policy so
  // the board, the exports and the panels cannot disagree about what is visible.
  const concealed = concealedAnswerPly({ concealedPly: review.concealedPly, currentPly: review.currentPly, practiceActive: retro.active }) !== null;
  const presentation = withheldPresentation(retro.presentation, concealed);
  const analysesHidden = presentation.hideAnalysisExports;
  const atStartPly = !review.branch && review.currentPly === 0;
  const keyPlies = review.analysis ? criticalMomentPlies(review.analysis.criticalMoments) : [];
  const keyPos = review.analysis ? keyMomentPosition(review.analysis.criticalMoments, review.currentPly) : null;
  const reviewKickerState = atStartPly
    ? copy.kickerStart
    : keyPos
      ? copy.kickerKeyMoment(keyPos.index, keyPos.total)
      : currentMove
        ? copy.kickerMove(currentMove.moveNumber)
        : copy.kickerStart;
  const reviewDisplay = atStartPly
    ? copy.displayWalkThrough
    : retro.active
      ? copy.displayPractice
      : concealed && keyPos
        ? copy.kickerKeyMoment(keyPos.index, keyPos.total)
        : keyPos && currentAnalysis
          ? formatMoveNotation({ fenBefore: currentAnalysis.fenBefore, color: currentAnalysis.color, san: currentAnalysis.san })
          : currentAnalysis
            ? `${formatMoveNotation({ fenBefore: currentAnalysis.fenBefore, color: currentAnalysis.color, san: currentAnalysis.san })} · ${displayedMoveQualityLabel(currentAnalysis, language)}`
            : currentMove
              ? `${currentMove.moveNumber}${currentMove.color === "white" ? "." : "…"} ${currentMove.san}`
              : copy.displayWalkThrough;
  const reviewLede = atStartPly
    ? keyPlies.length > 0
      ? copy.ledeMoments(keyPlies.length)
      : copy.ledeEachMove
    : retro.active || keyPos || concealed || !currentAnalysis
      ? null
      : moveEvidenceSentence(currentAnalysis, language);

  const sceneMode = retro.active ? "practice" : keyPos ? "moment" : atStartPly ? "start" : "move";

  const reviewSteps = reviewStepTrail(review.currentPly, totalPlies, keyPlies, copy);
  const sideToMove = review.positionFen.split(" ")[1] === "b" ? copy.sideBlack : copy.sideWhite;
  const topAccuracy = review.analysis?.[orderedPlayers.top.color].accuracy;
  const bottomAccuracy = review.analysis?.[orderedPlayers.bottom.color].accuracy;


  return (
    <ReviewRuntimeProvider value={runtime}>
      <ReviewExportProvider record={record}>
      <main className="review-shell" data-mode={sceneMode}>
        <ReviewTitlebar
          record={record}
          pathname={pathname}
          primary={primary}
          more={more}
          moreOpen={moreOpen}
          sectionHref={sectionHref}
          coachRunning={coachRuntime.task?.status === "running"}
          analysesHidden={analysesHidden}
        />
        <ReviewExportErrorBanner />
        <ReviewWorkbenchHead
          retro={retro}
          reviewKickerState={reviewKickerState}
          reviewDisplay={reviewDisplay}
          reviewLede={reviewLede}
          reviewSteps={reviewSteps}
        />

        <div
          className={`review-workspace${focusBoard ? " focus-board" : ""}`}
          style={boardGeometry.size === null ? undefined : ({ "--review-board-preference": `${boardGeometry.size}px` } as CSSProperties)}
        >
          <ReviewBoardSurface
            playAnalysisMove={review.playAnalysisMove}
            onPlayMoveReady={onPlayMoveReady}
            onPendingPromotionChange={setPendingPromotion}
            pieces={pieces}
            positionFen={review.positionFen}
            orientation={review.orientation}
            boardDisplay={boardDisplay}
            boardGeometry={boardGeometry}
            boardArrows={boardArrows}
            presentation={presentation}
            retro={retro}
            analysisMode={humanRuntime.mode}
            displayedScore={displayedScore}
            humanPositionAnalysis={humanRuntime.positionAnalysis}
            orderedPlayers={orderedPlayers}
            topAccuracy={topAccuracy}
            bottomAccuracy={bottomAccuracy}
            sideToMove={sideToMove}
            record={record}
            currentMove={currentMove}
            currentAnalysis={currentAnalysis}
            selectedBranchMove={selectedBranchMove}
            selectedBranchQuality={selectedBranchQuality}
            branch={review.branch}
            totalPlies={totalPlies}
            currentPly={review.currentPly}
            positionAnnouncement={positionAnnouncement}
            playback={playback}
            boardControlsRef={boardControlsRef}
            focusBoard={focusBoard}
            onToggleFocus={toggleFocusBoard}
            onShowShortcuts={openShortcutHelp}
            onFlip={flipBoard}
            soundEnabled={soundRuntime.soundEnabled}
            onToggleSound={soundRuntime.toggleMuted}
            navigateFirst={navigateFirst}
            navigatePrevious={navigatePrevious}
            navigateNext={navigateNext}
            navigateLast={navigateLast}
            onReturnToGame={() => { playback.pause(); review.returnToGame(); }}
            notebookHref={trainingId ? `${root}/notebook?${new URLSearchParams({ training: trainingId, position: query.get("position") ?? "", ply: String(review.currentPly) })}` : `${root}/notebook`}
          />

          <ReviewContextAside root={root} pathname={pathname} trainingId={trainingId}>
            {trainingId && <TrainingSession taskId={trainingId} positionKey={query.get("position")} record={record} />}
            <ReviewSessionProvider gameId={gameId} analysis={review.analysis}>{children}</ReviewSessionProvider>
          </ReviewContextAside>
        </div>
        {shortcutHelpOpen && <ShortcutHelp onClose={() => setShortcutHelpOpen(false)} />}
      </main>
      </ReviewExportProvider>
    </ReviewRuntimeProvider>
  );
}
