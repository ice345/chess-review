"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildGameAnalysis } from "@chess-review/analysis";
import type { NormalizedGame } from "@chess-review/chess-core";
import type { GameAnalysisV1, GameDivision, OpeningInfo, StockfishMoveAnalysis } from "@chess-review/shared";
import {
  BrowserStockfish,
  BrowserStockfishPool,
  STOCKFISH_VERSION,
  type GameReviewProgress,
} from "@chess-review/stockfish";
import type { ReviewRunState } from "../components/review-runtime";
import { getCachedAnalysis, putCachedAnalysis } from "../lib/analysis-cache";
import { analysisScheduler } from "../lib/analysis-scheduler";
import type { AppSettings } from "../lib/app-settings";
import { useReviewStore } from "../store/review-store";

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
      // One background worker leaves the scheduler's second slot available for
      // the current board or branch, instead of letting a game pool consume all
      // browser analysis capacity.
      const pool = new BrowserStockfishPool(1);
      reviewPool.current = pool;
      const engineFacts = await analysisScheduler.run(
        "background-game",
        () => pool.analyzeGame(game, {
          ...cacheOptions,
          signal: controller.signal,
          onProgress: setReviewProgress,
        }),
        controller.signal,
      );
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
    await runFullGame(review.game, review.division, review.opening, reviewDepth, reviewMultiPv);
  }, [reviewDepth, reviewMultiPv, runFullGame]);

  const cancelFullGame = useCallback(() => {
    reviewAbort.current?.abort();
    reviewPool.current?.terminate();
  }, []);

  const analyzePosition = useCallback(async () => {
    if (!engine.current) return;
    engineAbort.current?.abort();
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
        }),
        controller.signal,
      );
      if (useReviewStore.getState().positionFen === fen) setEngineOutput({ fen, result });
      setEngineState("idle");
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) setEngineState("idle");
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
    continuationAbort.current?.abort();
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
        }),
        controller.signal,
      );
      if (useReviewStore.getState().positionFen === fen) setContinuationOutput({ fen, result });
      setContinuationState("idle");
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) setContinuationState("idle");
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

  const persistEnrichedAnalysis = useCallback((analysis: GameAnalysisV1 | null) => {
    const game = useReviewStore.getState().game;
    if (!analysis || !game) return;
    void putCachedAnalysis(game, {
      depth: analysis.engine.depth,
      multiPv: analysis.engine.multiPv,
    }, analysis).catch(() => undefined);
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
