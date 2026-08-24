"use client";

import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { GameAnalysisV1, StockfishMoveAnalysis } from "@chess-review/shared";
import type { GameReviewProgress } from "@chess-review/stockfish";
import type { ReviewRecord } from "../lib/review-library";
import type { LocalAiHealth, MaiaMovesResponse } from "../lib/local-ai";
import type { AnalysisLens } from "../lib/board-analysis-arrows";
import type { MaiaServiceState } from "../lib/human-lens-state";

export type ReviewRunState = "idle" | "running" | "complete" | "cached" | "error";

export interface ReviewRuntimeValue {
  gameId: string;
  record: ReviewRecord;
  reviewState: ReviewRunState;
  reviewError: string | null;
  reviewProgress: GameReviewProgress | null;
  reviewDepth: 10 | 12 | 15;
  setReviewDepth: Dispatch<SetStateAction<10 | 12 | 15>>;
  reviewMultiPv: 1 | 2 | 3 | 4 | 5;
  setReviewMultiPv: Dispatch<SetStateAction<1 | 2 | 3 | 4 | 5>>;
  engineResult: StockfishMoveAnalysis | null;
  engineState: "idle" | "running" | "error";
  engineError: string | null;
  continuationLines: 1 | 2 | 3 | 4 | 5;
  continuationLength: 6 | 8 | 10 | 12 | 16;
  continuationResult: StockfishMoveAnalysis | null;
  continuationState: "idle" | "running" | "error";
  continuationError: string | null;
  analysisLens: AnalysisLens;
  setAnalysisLens: Dispatch<SetStateAction<AnalysisLens>>;
  humanTargetElo: number;
  setHumanTargetElo: (value: number) => void;
  humanPositionResult: MaiaMovesResponse | null;
  humanPositionState: "idle" | "running" | "error";
  humanPositionError: string | null;
  humanServiceState: MaiaServiceState;
  humanPlayedMove: string | undefined;
  analyzeFullGame: () => Promise<void>;
  cancelFullGame: () => void;
  analyzePosition: () => Promise<void>;
  analyzeContinuations: () => Promise<void>;
  analyzeHumanPosition: () => Promise<void>;
  refreshHumanService: () => Promise<LocalAiHealth | null>;
  navigateToPly: (ply: number) => void;
  playContinuation: (rank: number, result?: StockfishMoveAnalysis | null) => void;
  playHumanCandidate: (uci: string, probability: number) => void;
  persistEnrichedAnalysis: (analysis: GameAnalysisV1 | null) => void;
}

const ReviewRuntimeContext = createContext<ReviewRuntimeValue | null>(null);

export const ReviewRuntimeProvider = ReviewRuntimeContext.Provider;

export function useReviewRuntime(): ReviewRuntimeValue {
  const value = useContext(ReviewRuntimeContext);
  if (!value) throw new Error("Review route must render inside the persistent review layout.");
  return value;
}
