"use client";

import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type {
  CoachLanguage,
  GameAnalysisV1,
  HumanAnalysis,
  MaiaModel,
  MaiaMoveReview,
  MaiaPositionAnalysis,
  StockfishMoveAnalysis,
} from "@chess-review/shared";
import type { GameReviewProgress } from "@chess-review/stockfish";
import type { ReviewRecord } from "../lib/review-library";
import type { LocalAiHealth, MaiaModelState } from "../lib/local-ai";
import type { CoachRequestProvider } from "../lib/local-ai";
import type {
  AnalysisMode,
  HumanCandidateIdentity,
  StockfishCandidateIdentity,
} from "../lib/board-analysis-arrows";
import type { MaiaServiceState } from "../lib/human-lens-state";
import type { LocalAiConnectionState } from "../lib/use-local-ai-health";
import type { ReviewCoachTask } from "../hooks/use-review-coach";

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
  analysisMode: AnalysisMode;
  setAnalysisMode: Dispatch<SetStateAction<AnalysisMode>>;
  humanTargetElo: number;
  setHumanTargetElo: (value: number) => void;
  humanModel: MaiaModel;
  setHumanModel: (value: MaiaModel) => void;
  humanModelState: MaiaModelState;
  humanModelSetupState: "idle" | "running" | "error";
  humanMoveReview: MaiaMoveReview | null;
  currentHuman: HumanAnalysis | null;
  humanPositionResult: MaiaPositionAnalysis | null;
  humanPositionState: "idle" | "running" | "error";
  humanPositionError: string | null;
  humanServiceState: MaiaServiceState;
  coachProvider: CoachRequestProvider;
  coachLanguage: CoachLanguage;
  coachModel: string;
  coachServiceState: LocalAiConnectionState;
  coachHealth: LocalAiHealth | null;
  coachTask: ReviewCoachTask | null;
  coachNotice: string | null;
  analyzeFullGame: () => Promise<void>;
  cancelFullGame: () => void;
  analyzePosition: () => Promise<void>;
  analyzeContinuations: () => Promise<void>;
  analyzeHumanPosition: () => Promise<void>;
  setupHumanModel: () => Promise<void>;
  refreshHumanService: () => Promise<LocalAiHealth | null>;
  generateMoveCoach: (ply: number) => Promise<void>;
  generateGameCoach: () => Promise<void>;
  retryBranchMoveQuality: () => void;
  navigateToPly: (ply: number) => void;
  playContinuation: (identity: StockfishCandidateIdentity, result?: StockfishMoveAnalysis | null) => void;
  playHumanCandidate: (identity: HumanCandidateIdentity) => void;
  persistEnrichedAnalysis: (analysis: GameAnalysisV1 | null) => void;
}

const ReviewRuntimeContext = createContext<ReviewRuntimeValue | null>(null);

export const ReviewRuntimeProvider = ReviewRuntimeContext.Provider;

export function useReviewRuntime(): ReviewRuntimeValue {
  const value = useContext(ReviewRuntimeContext);
  if (!value) throw new Error("Review route must render inside the persistent review layout.");
  return value;
}
