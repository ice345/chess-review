"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Chessboard } from "react-chessboard";
import { buildGameAnalysis } from "@chess-review/analysis";
import { replayUciLine, type NormalizedGame } from "@chess-review/chess-core";
import type { GameAnalysisV1, GameDivision, OpeningInfo, StockfishMoveAnalysis } from "@chess-review/shared";
import { BrowserStockfish, BrowserStockfishPool, STOCKFISH_VERSION, type GameReviewProgress } from "@chess-review/stockfish";
import { BoardQualityBadge, EvaluationGraph, QualityIcon, QUALITY_META } from "@chess-review/ui";
import { AppHeader } from "./app-header";
import { ReviewRuntimeProvider, type ReviewRunState } from "./review-runtime";
import { getCachedAnalysis, putCachedAnalysis } from "../lib/analysis-cache";
import { loadAppSettings } from "../lib/app-settings";
import { downloadBlob, renderGameReviewCard, renderPositionCard, reviewFilename } from "../lib/png-export";
import { formatEngineScore } from "../lib/review-format";
import { getReviewRecord, saveReviewRecord, type ReviewRecord } from "../lib/review-library";
import { exportAnalysisJson, exportAnnotatedPgn } from "@chess-review/shared";
import { useReviewStore } from "../store/review-store";

function evaluationShare(value: StockfishMoveAnalysis | GameAnalysisV1["moves"][number]["evaluationAfter"] | null): number {
  if (!value) return 50;
  const score = "score" in value ? value.score : value;
  if (score.kind === "mate") return score.mateIn > 0 ? 100 : 0;
  return 100 / (1 + Math.exp(-0.004 * score.cp));
}

export function ReviewShell({ children }: { children: ReactNode }) {
  const params = useParams<{ gameId: string }>();
  const pathname = usePathname();
  const gameId = params.gameId;
  const state = useReviewStore();
  const [record, setRecord] = useState<ReviewRecord | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const settings = useMemo(() => loadAppSettings(), []);
  const [reviewDepth, setReviewDepth] = useState<10 | 12 | 15>(settings.reviewDepth);
  const [reviewMultiPv, setReviewMultiPv] = useState<1 | 2 | 3 | 4 | 5>(settings.reviewMultiPv);
  const [continuationLines, setContinuationLines] = useState<1 | 2 | 3 | 4 | 5>(settings.continuationLines);
  const [continuationLength, setContinuationLength] = useState<6 | 8 | 10 | 12 | 16>(settings.continuationLength);
  const [reviewState, setReviewState] = useState<ReviewRunState>("idle");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewProgress, setReviewProgress] = useState<GameReviewProgress | null>(null);
  const [engineResult, setEngineResult] = useState<StockfishMoveAnalysis | null>(null);
  const [engineState, setEngineState] = useState<"idle" | "running" | "error">("idle");
  const [engineError, setEngineError] = useState<string | null>(null);
  const [continuationResult, setContinuationResult] = useState<StockfishMoveAnalysis | null>(null);
  const [continuationState, setContinuationState] = useState<"idle" | "running" | "error">("idle");
  const [continuationError, setContinuationError] = useState<string | null>(null);
  const engine = useRef<BrowserStockfish | null>(null);
  const continuationEngine = useRef<BrowserStockfish | null>(null);
  const reviewPool = useRef<BrowserStockfishPool | null>(null);
  const reviewAbort = useRef<AbortController | null>(null);

  const runFullGame = useCallback(async (
    game: NormalizedGame,
    division: GameDivision,
    opening: OpeningInfo | null,
    depth: number,
    multiPv: number,
  ) => {
    if (reviewAbort.current) return;
    const cacheOptions = { depth, multiPv };
    setReviewState("running");
    setReviewError(null);
    setReviewProgress(null);
    const controller = new AbortController();
    reviewAbort.current = controller;
    try {
      const cached = await getCachedAnalysis(game, cacheOptions).catch(() => null);
      if (controller.signal.aborted) return;
      if (cached) {
        useReviewStore.getState().setAnalysis(cached);
        setReviewState("cached");
        return;
      }
      useReviewStore.getState().setAnalysis(null);
      const pool = new BrowserStockfishPool();
      reviewPool.current = pool;
      const engineFacts = await pool.analyzeGame(game, {
        ...cacheOptions,
        signal: controller.signal,
        onProgress: setReviewProgress,
      });
      const analysis = buildGameAnalysis({
        game,
        ...engineFacts,
        ...(opening === null ? {} : { opening }),
        division,
        stockfishVersion: STOCKFISH_VERSION,
        ...cacheOptions,
        createdAt: new Date().toISOString(),
      });
      await putCachedAnalysis(game, cacheOptions, analysis).catch(() => undefined);
      if (controller.signal.aborted) return;
      useReviewStore.getState().setAnalysis(analysis);
      setReviewState("complete");
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        setReviewState("idle");
      } else {
        setReviewState("error");
        setReviewError(error instanceof Error ? error.message : "Full-game analysis failed.");
      }
    } finally {
      reviewPool.current?.terminate();
      reviewPool.current = null;
      reviewAbort.current = null;
    }
  }, []);

  useEffect(() => {
    engine.current = new BrowserStockfish();
    continuationEngine.current = new BrowserStockfish();
    return () => {
      engine.current?.terminate();
      continuationEngine.current?.terminate();
      reviewAbort.current?.abort();
      reviewPool.current?.terminate();
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    setLoadError(null);
    void getReviewRecord(gameId).then(async (loaded) => {
      if (!active) return;
      if (!loaded) {
        setLoadState("missing");
        return;
      }
      setRecord(loaded);
      useReviewStore.getState().setOrientation(loaded.orientationOverride ?? loaded.preferredOrientation ?? "white");
      if (loaded.kind === "fen") {
        useReviewStore.getState().loadFen(loaded.input);
        setReviewState("idle");
      } else {
        useReviewStore.getState().loadPgn(loaded.input);
        const review = useReviewStore.getState();
        if (!review.game || !review.division) throw new Error(review.error ?? "Unable to normalize the stored PGN.");
        const shouldAnalyze = window.sessionStorage.getItem(`open-chess-review:auto:${gameId}`) === "1";
        window.sessionStorage.removeItem(`open-chess-review:auto:${gameId}`);
        const cached = await getCachedAnalysis(review.game, {
          depth: settings.reviewDepth,
          multiPv: settings.reviewMultiPv,
        }).catch(() => null);
        if (!active) return;
        if (cached) {
          review.setAnalysis(cached);
          setReviewState("cached");
        } else if (shouldAnalyze) {
          setLoadState("ready");
          void runFullGame(review.game, review.division, review.opening, settings.reviewDepth, settings.reviewMultiPv);
          void saveReviewRecord(loaded).catch(() => undefined);
          return;
        }
      }
      if (!active) return;
      setLoadState("ready");
      void saveReviewRecord(loaded).catch(() => undefined);
    }).catch((error) => {
      if (!active) return;
      setLoadError(error instanceof Error ? error.message : "Unable to load this review.");
      setLoadState("error");
    });
    return () => { active = false; };
  }, [gameId, runFullGame, settings.reviewDepth, settings.reviewMultiPv]);

  useEffect(() => {
    setEngineResult(null);
    setEngineState("idle");
    setEngineError(null);
  }, [state.positionFen]);

  useEffect(() => {
    setContinuationResult(null);
    setContinuationState("idle");
    setContinuationError(null);
  }, [state.currentPly, gameId]);

  useEffect(() => {
    function navigate(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      const review = useReviewStore.getState();
      if (event.key === "Escape" && review.variation) review.returnToGame();
      if (event.key === "ArrowLeft") {
        if (review.variation) review.stepVariation(-1);
        else review.goToPly(review.currentPly - 1);
      }
      if (event.key === "ArrowRight") {
        if (review.variation) review.stepVariation(1);
        else review.goToPly(review.currentPly + 1);
      }
    }
    window.addEventListener("keydown", navigate);
    return () => window.removeEventListener("keydown", navigate);
  }, []);

  const analyzeFullGame = useCallback(async () => {
    const review = useReviewStore.getState();
    if (!review.game || !review.division) return;
    await runFullGame(review.game, review.division, review.opening, reviewDepth, reviewMultiPv);
  }, [reviewDepth, reviewMultiPv, runFullGame]);

  const cancelFullGame = useCallback(() => {
    reviewAbort.current?.abort();
    reviewPool.current?.terminate();
  }, []);

  const analyzePosition = useCallback(async () => {
    if (!engine.current) return;
    setEngineState("running");
    setEngineError(null);
    try {
      setEngineResult(await engine.current.search(useReviewStore.getState().positionFen, { depth: reviewDepth, multiPv: reviewMultiPv }));
      setEngineState("idle");
    } catch (error) {
      setEngineState("error");
      setEngineError(error instanceof Error ? error.message : "Stockfish analysis failed.");
    }
  }, [reviewDepth, reviewMultiPv]);

  const analyzeContinuations = useCallback(async () => {
    if (!continuationEngine.current) return;
    const review = useReviewStore.getState();
    const fen = review.variation?.rootFen ?? review.positionFen;
    setContinuationState("running");
    setContinuationError(null);
    try {
      setContinuationResult(await continuationEngine.current.search(fen, {
        depth: reviewDepth,
        multiPv: continuationLines,
      }));
      setContinuationState("idle");
    } catch (error) {
      setContinuationState("error");
      setContinuationError(error instanceof Error ? error.message : "Continuation analysis failed.");
    }
  }, [continuationLines, reviewDepth]);

  const persistEnrichedAnalysis = useCallback((analysis: GameAnalysisV1 | null) => {
    const game = useReviewStore.getState().game;
    if (!analysis || !game) return;
    void putCachedAnalysis(game, { depth: analysis.engine.depth, multiPv: analysis.engine.multiPv }, analysis).catch(() => undefined);
  }, []);

  if (loadState !== "ready" || !record) {
    return (
      <main className="review-loading">
        <AppHeader compact />
        <section>
          <span className="brand-mark">CR</span>
          <h1>{loadState === "missing" ? "Review not found" : loadState === "error" ? "Unable to open review" : "Preparing workspace"}</h1>
          <p>{loadError ?? (loadState === "missing" ? "This browser has no record for that review ID." : "Loading the persisted game and analysis cache…")}</p>
          {loadState !== "loading" && <Link href="/">Return home →</Link>}
        </section>
      </main>
    );
  }

  const currentMove = state.currentPly === 0 ? null : state.game?.plies[state.currentPly - 1] ?? null;
  const currentAnalysis = state.currentPly === 0 ? null : state.analysis?.moves[state.currentPly - 1] ?? null;
  const positionResult = state.analysis?.moves[state.currentPly]?.stockfish ?? null;
  const displayedResult = engineResult ?? positionResult;
  const displayedScore = displayedResult ?? currentAnalysis?.evaluationAfter ?? state.analysis?.moves[0]?.evaluationBefore ?? null;
  const share = evaluationShare(displayedScore);
  const root = `/review/${gameId}`;
  const primary = [
    { href: root, label: "Review" },
    { href: `${root}/moves`, label: "Moves" },
    { href: `${root}/human`, label: "Human" },
    { href: `${root}/coach`, label: "Coach" },
  ];

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
    setContinuationLines,
    continuationLength,
    setContinuationLength,
    continuationResult,
    continuationState,
    continuationError,
    analyzeFullGame,
    cancelFullGame,
    analyzePosition,
    analyzeContinuations,
    playContinuation: (rank: number, result: StockfishMoveAnalysis | null = continuationResult ?? positionResult) => {
      const line = result?.lines.find((candidate) => candidate.rank === rank);
      if (!line) return;
      const rootFen = state.variation?.rootFen ?? state.positionFen;
      try {
        state.startVariation(rank, replayUciLine(rootFen, line.pv));
      } catch (error) {
        setContinuationState("error");
        setContinuationError(error instanceof Error ? error.message : "Engine line could not be validated.");
      }
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
            {primary.map((item) => <Link aria-current={pathname === item.href ? "page" : undefined} className={pathname === item.href ? "active" : ""} href={item.href} key={item.href}>{item.label}</Link>)}
          </nav>
          <div className="review-actions">
            <details key={`export-${pathname}`}><summary>Export</summary><div className="action-menu">
              <button disabled={!state.analysis} onClick={() => state.analysis && downloadText(exportAnalysisJson(state.analysis), "application/json", reviewFilename(state.analysis, "analysis.json"))}>Canonical JSON</button>
              <button disabled={!state.analysis} onClick={() => state.analysis && downloadText(exportAnnotatedPgn(state.analysis), "application/x-chess-pgn", reviewFilename(state.analysis, "annotated.pgn"))}>Annotated PGN</button>
              <button disabled={!currentAnalysis} onClick={() => void exportPositionPng()}>Position PNG</button>
              <button disabled={!state.analysis} onClick={() => void exportReviewPng()}>Review PNG</button>
            </div></details>
            <details key={`more-${pathname}`}><summary>More</summary><div className="action-menu"><Link href={`${root}/engine`}>Engine Lab</Link><Link href="/settings">Settings</Link></div></details>
          </div>
        </div>

        <div className="review-workspace">
          <section className="position-workspace" aria-label="Persistent board workspace">
            <div className="board-toolbar">
              <span>{state.orientation === "white" ? "White" : "Black"} perspective</span>
              <button className="text-button" aria-label="Flip board" onClick={flipBoard}>Flip board ↕</button>
            </div>
            <div className="board-stage">
              <div className="eval-bar" aria-label={`White evaluation share ${Math.round(share)} percent`}><div className="eval-black" style={{ height: `${100 - share}%` }} /><span>{formatEngineScore(displayedScore)}</span></div>
              <div className="board-wrap">
                <Chessboard options={{ position: state.positionFen, allowDragging: false, boardOrientation: state.orientation, animationDurationInMs: 160, lightSquareStyle: { backgroundColor: "#f2e5cf" }, darkSquareStyle: { backgroundColor: "#91aeb6" }, lightSquareNotationStyle: { color: "#6d8290" }, darkSquareNotationStyle: { color: "#f4eadb" }, boardStyle: { borderRadius: "5px", boxShadow: "0 20px 54px rgba(60, 74, 84, .16)" } }} />
                {currentAnalysis && !state.variation && <BoardQualityBadge square={currentAnalysis.uci.slice(2, 4)} orientation={state.orientation} classification={currentAnalysis.classification} />}
              </div>
            </div>

            <div className="move-dock">
              <div className="move-navigation" aria-label="Move navigation">
                <button aria-label={state.variation ? "Variation start" : "Starting position"} onClick={() => state.variation ? state.stepVariation(-state.variation.cursor) : state.goToPly(0)} disabled={state.variation ? state.variation.cursor === 0 : !state.game}>⏮</button>
                <button aria-label="Previous move" onClick={() => state.variation ? state.stepVariation(-1) : state.goToPly(state.currentPly - 1)} disabled={state.variation ? state.variation.cursor === 0 : !state.game || state.currentPly === 0}>←</button>
                <div><strong>{state.variation ? `Line #${state.variation.rank} · ${state.variation.cursor === 0 ? "root" : state.variation.moves[state.variation.cursor - 1]?.san ?? "variation"}` : currentMove ? `${currentMove.moveNumber}${currentMove.color === "white" ? "." : "…"} ${currentMove.san}` : "Starting position"}</strong><span>{state.variation ? `${state.variation.cursor} / ${state.variation.moves.length} · temporary` : `${state.currentPly} / ${state.game?.plies.length ?? 0} ply`}</span></div>
                <button aria-label="Next move" onClick={() => state.variation ? state.stepVariation(1) : state.goToPly(state.currentPly + 1)} disabled={state.variation ? state.variation.cursor === state.variation.moves.length : !state.game || state.currentPly === state.game.plies.length}>→</button>
                <button aria-label={state.variation ? "Variation end" : "Final position"} onClick={() => state.variation ? state.stepVariation(state.variation.moves.length - state.variation.cursor) : state.goToPly(state.game?.plies.length ?? 0)} disabled={state.variation ? state.variation.cursor === state.variation.moves.length : !state.game}>⏭</button>
              </div>
              {state.variation ? <button className="return-to-game" onClick={state.returnToGame}>Return to game <kbd>Esc</kbd></button> : currentAnalysis && <div className="current-verdict"><QualityIcon classification={currentAnalysis.classification} size={31} /><span><strong>{QUALITY_META[currentAnalysis.classification].label}</strong><small>Accuracy {currentAnalysis.accuracy.toFixed(1)} · Win% loss {currentAnalysis.classificationReason.winPercentLoss.toFixed(1)}</small></span><details><summary>Why?</summary><div><span>Rule · {currentAnalysis.classificationReason.precedenceRule.replaceAll("-", " ")}</span>{currentAnalysis.classificationReason.centipawnLoss !== undefined && <span>Loss · {currentAnalysis.classificationReason.centipawnLoss} cp</span>}{currentAnalysis.classificationReason.secondBestGapCp !== undefined && <span>Top-two gap · {currentAnalysis.classificationReason.secondBestGapCp} cp</span>}</div></details></div>}
            </div>
          </section>

          <aside className="context-panel">{children}</aside>
        </div>
        {state.analysis && <section className="timeline-panel"><div><span className="kicker">The whole game</span><strong>Evaluation timeline</strong><small>Hover for details · click to return to a move</small></div><EvaluationGraph analysis={state.analysis} currentPly={state.currentPly} onSelectPly={state.goToPly} /></section>}
      </main>
    </ReviewRuntimeProvider>
  );
}
