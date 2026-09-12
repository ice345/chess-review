"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CLASSIFICATION_MULTI_PV } from "@chess-review/analysis";
import type { NormalizedGame } from "@chess-review/chess-core";
import type { GameAnalysisV2, GameDivision, OpeningInfo, StockfishMoveAnalysis } from "@chess-review/shared";
import {
  BrowserStockfish,
  BrowserStockfishPool,
  type GameReviewProgress,
} from "@chess-review/stockfish";
import type { ReviewRunState } from "../components/review-runtime";
import { getCachedAnalysis, putCachedAnalysis } from "../lib/analysis-cache";
import { analysisScheduler } from "../lib/analysis-scheduler";
import type { AppSettings } from "../lib/app-settings";
import { selectedBranchMoves } from "../lib/analysis-branch";
import { analyzeObjectiveGame } from "../lib/objective-game-analysis";
import { markSyncedGameAnalyzed } from "../lib/platform-library";
import { withReviewRun } from "../lib/review-runs";
import { getReviewRecord } from "../lib/review-library";
import { useReviewStore } from "../store/review-store";

function positionSearchHistory(review: ReturnType<typeof useReviewStore.getState>) {
  const game = review.game;
  if (!game) return {};
  const prefix = game.plies.slice(0, review.branch ? review.branch.rootPly : review.currentPly).map((ply) => ply.uci);
  // A stored engine PV may extend beyond the currently selected node. Only
  // the selected prefix is real played history for this search position.
  const branch = review.branch ? selectedBranchMoves(review.branch).map((move) => move.uci) : [];
  return { startFen: game.initialFen, moves: [...prefix, ...branch] };
}

type ReviewAnalysisSettings = Pick<
  AppSettings,
  "reviewDepth" | "reviewMultiPv" | "continuationLines" | "continuationLength"
>;

export function useReviewAnalysis({
  gameId,
  positionFen,
  currentPly,
  settings,
}: {
  gameId: string;
  positionFen: string;
  currentPly: number;
  settings: ReviewAnalysisSettings;
}) {
  const [reviewDepth, setReviewDepth] = useState<10 | 12 | 15>(settings.reviewDepth);
  const [reviewMultiPv, setReviewMultiPv] = useState<1 | 2 | 3 | 4 | 5>(settings.reviewMultiPv);
  const continuationLines = settings.continuationLines;
  const continuationLength = settings.continuationLength;
  const [reviewState, setReviewState] = useState<ReviewRunState>("idle");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewProgress, setReviewProgress] = useState<GameReviewProgress | null>(null);
  const [engineOutput, setEngineOutput] = useState<{ fen: string; result: StockfishMoveAnalysis } | null>(null);
  const [engineState, setEngineState] = useState<"idle" | "running" | "error">("idle");
  const [engineError, setEngineError] = useState<string | null>(null);
  const [continuationOutput, setContinuationOutput] = useState<{ fen: string; result: StockfishMoveAnalysis } | null>(null);
  const [continuationState, setContinuationState] = useState<"idle" | "running" | "error">("idle");
  const [continuationError, setContinuationError] = useState<string | null>(null);
  const engine = useRef<BrowserStockfish | null>(null);
  const continuationEngine = useRef<BrowserStockfish | null>(null);
  const reviewPool = useRef<BrowserStockfishPool | null>(null);
  const reviewAbort = useRef<AbortController | null>(null);
  const engineAbort = useRef<AbortController | null>(null);
  const continuationAbort = useRef<AbortController | null>(null);
  const engineResult = engineOutput?.fen === positionFen ? engineOutput.result : null;
  const continuationResult = continuationOutput?.fen === positionFen ? continuationOutput.result : null;

  const runFullGame = useCallback(async (
    game: NormalizedGame,
    division: GameDivision,
    opening: OpeningInfo | null,
    depth: number,
  ) => {
    if (reviewAbort.current) return;
    const cacheOptions = { depth, multiPv: CLASSIFICATION_MULTI_PV };
    setReviewState("running");
    setReviewError(null);
    setReviewProgress(null);
    const controller = new AbortController();
    reviewAbort.current = controller;
    try {
      await withReviewRun(gameId, depth, async (signal, report) => {
        const markCurrent = async (analysis: GameAnalysisV2) => {
          const record = await getReviewRecord(gameId);
          if (!record?.external) return;
          await markSyncedGameAnalyzed(
            `${record.external.provider}:${record.external.externalGameId}`,
            record.id,
            { algorithmVersion: analysis.algorithmVersion, depth: analysis.engine.depth },
          );
        };
        const cached = await getCachedAnalysis(game, cacheOptions);
        signal.throwIfAborted();
        if (cached) {
          useReviewStore.getState().setAnalysis(cached);
          await markCurrent(cached);
          setReviewState("cached");
          return;
        }
        useReviewStore.getState().setAnalysis(null);
        // The pool sizes itself from the visitor's device; the shared scheduler
        // still caps concurrent analysis jobs and prioritizes current-board work.
        const pool = new BrowserStockfishPool();
        reviewPool.current = pool;
        const analysis = await analysisScheduler.run(
          "background-game",
          () => analyzeObjectiveGame(game, pool, {
            depth,
            division,
            opening,
            signal,
            onProgress: (progress) => { setReviewProgress(progress); report(progress); },
          }),
          signal,
        );
        await putCachedAnalysis(game, cacheOptions, analysis);
        await markCurrent(analysis);
        signal.throwIfAborted();
        useReviewStore.getState().setAnalysis(analysis);
      }, controller.signal);
      setReviewState((state) => state === "cached" ? "cached" : "complete");
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
  }, [gameId]);

  useEffect(() => {
    engine.current = new BrowserStockfish();
    continuationEngine.current = new BrowserStockfish();
    return () => {
      engine.current?.terminate();
      continuationEngine.current?.terminate();
      engineAbort.current?.abort();
      continuationAbort.current?.abort();
      reviewAbort.current?.abort();
      reviewPool.current?.terminate();
    };
  }, []);

  useEffect(() => {
    engineAbort.current?.abort();
    setEngineOutput(null);
    setEngineState("idle");
    setEngineError(null);
  }, [positionFen]);

  useEffect(() => {
    continuationAbort.current?.abort();
    setContinuationOutput(null);
    setContinuationState("idle");
    setContinuationError(null);
  }, [currentPly, gameId, positionFen]);

  const analyzeFullGame = useCallback(async () => {
    const review = useReviewStore.getState();
    if (!review.game || !review.division) return;
    await runFullGame(review.game, review.division, review.opening, reviewDepth);
  }, [reviewDepth, runFullGame]);

  const cancelFullGame = useCallback(() => {
    reviewAbort.current?.abort();
    reviewPool.current?.terminate();
  }, []);

  const analyzePosition = useCallback(async () => {
    if (!engine.current) return;
    if (engineAbort.current && !engineAbort.current.signal.aborted) return;
    const controller = new AbortController();
    engineAbort.current = controller;
    const review = useReviewStore.getState();
    const fen = review.positionFen;
    const priority = review.branch ? "interactive-variation" : "interactive-position";
    setEngineState("running");
    setEngineError(null);
    try {
      const result = await analysisScheduler.run(
        priority,
        () => engine.current!.search(fen, {
          depth: reviewDepth,
          multiPv: reviewMultiPv,
          signal: controller.signal,
          ...positionSearchHistory(review),
        }),
        controller.signal,
      );
      if (engineAbort.current !== controller) return;
      if (useReviewStore.getState().positionFen === fen) setEngineOutput({ fen, result });
      setEngineState("idle");
    } catch (error) {
      if (controller.signal.aborted || engineAbort.current !== controller || (error instanceof Error && error.name === "AbortError")) return;
      else {
        setEngineState("error");
        setEngineError(error instanceof Error ? error.message : "Stockfish analysis failed.");
      }
    } finally {
      if (engineAbort.current === controller) engineAbort.current = null;
    }
  }, [reviewDepth, reviewMultiPv]);

  const analyzeContinuations = useCallback(async () => {
    if (!continuationEngine.current) return;
    if (continuationAbort.current && !continuationAbort.current.signal.aborted) return;
    const controller = new AbortController();
    continuationAbort.current = controller;
    const review = useReviewStore.getState();
    const fen = review.positionFen;
    const priority = review.branch ? "interactive-variation" : "interactive-position";
    setContinuationState("running");
    setContinuationError(null);
    try {
      const result = await analysisScheduler.run(
        priority,
        () => continuationEngine.current!.search(fen, {
          depth: reviewDepth,
          multiPv: continuationLines,
          signal: controller.signal,
          ...positionSearchHistory(review),
        }),
        controller.signal,
      );
      if (continuationAbort.current !== controller) return;
      if (useReviewStore.getState().positionFen === fen) setContinuationOutput({ fen, result });
      setContinuationState("idle");
    } catch (error) {
      if (controller.signal.aborted || continuationAbort.current !== controller || (error instanceof Error && error.name === "AbortError")) return;
      else {
        setContinuationState("error");
        setContinuationError(error instanceof Error ? error.message : "Continuation analysis failed.");
      }
    } finally {
      if (continuationAbort.current === controller) continuationAbort.current = null;
    }
  }, [continuationLines, reviewDepth]);

  const reportContinuationError = useCallback((error: unknown) => {
    setContinuationState("error");
    setContinuationError(error instanceof Error ? error.message : "Engine line could not be validated.");
  }, []);

  const persistEnrichedAnalysis = useCallback((analysis: GameAnalysisV2 | null) => {
    const game = useReviewStore.getState().game;
    if (!analysis || !game) return;
    void putCachedAnalysis(game, {
      depth: analysis.engine.depth,
      multiPv: analysis.engine.multiPv,
    }, analysis).catch((error) => setReviewError(error instanceof Error ? error.message : "Unable to save analysis updates."));
  }, []);

  return {
    reviewDepth,
    setReviewDepth,
    reviewMultiPv,
    setReviewMultiPv,
    continuationLines,
    continuationLength,
    reviewState,
    setReviewState,
    reviewError,
    reviewProgress,
    engineResult,
    engineState,
    engineError,
    continuationResult,
    continuationState,
    continuationError,
    runFullGame,
    analyzeFullGame,
    cancelFullGame,
    analyzePosition,
    analyzeContinuations,
    reportContinuationError,
    persistEnrichedAnalysis,
  };
}
