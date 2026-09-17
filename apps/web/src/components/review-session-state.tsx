"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { GameAnalysisV2 } from "@chess-review/shared";
import { useReviewStore } from "../store/review-store";
import { useReviewRuntime } from "./review-runtime";
import { concealedAnswerPly } from "../lib/practice-presentation";
import {
  deserializeReviewSession,
  emptyReviewSessionProgress,
  markMomentSeen,
  reviewSessionCounts,
  reviewSessionKey,
  serializeReviewSession,
  type ReviewSessionCounts,
  type ReviewSessionProgress,
} from "../lib/review-session";

/**
 * The guided review's own progress, owned by the persistent review layout rather
 * than by the panel that renders it.
 *
 * Review, Moves and Study are nested routes of one layout, so keeping the
 * session here means moving between them cannot reset what the visitor has
 * already looked at. Progress is stored per game *and* per objective record
 * identity: a re-analysis writes a new key, so a previous completion is never
 * granted to a different set of key moments.
 */
export interface ReviewSessionValue {
  progress: ReviewSessionProgress;
  /** Counted against the analysis on screen right now. */
  counts: ReviewSessionCounts;
  markSeen: (ply: number) => void;
}

const ReviewSessionContext = createContext<ReviewSessionValue | null>(null);

function readStoredSession(key: string): ReviewSessionProgress | null {
  try {
    return deserializeReviewSession(window.sessionStorage.getItem(key));
  } catch {
    return null;
  }
}

export function ReviewSessionProvider({ gameId, analysis, children }: { gameId: string; analysis: GameAnalysisV2 | null; children: ReactNode }) {
  const currentPly = useReviewStore((store) => store.currentPly);
  const [progress, setProgress] = useState<ReviewSessionProgress>(emptyReviewSessionProgress);
  // The write effect must not run before the read effect has landed, or a fresh
  // mount would store an empty session over the one it is about to restore.
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const key = analysis === null ? null : reviewSessionKey(gameId, analysis);

  // A new game or a new objective record starts its own session.
  useEffect(() => {
    setProgress(key === null ? emptyReviewSessionProgress() : readStoredSession(key) ?? emptyReviewSessionProgress());
    setHydratedKey(key);
  }, [key]);

  useEffect(() => {
    if (key === null || hydratedKey !== key) return;
    try {
      window.sessionStorage.setItem(key, serializeReviewSession(progress));
    } catch {
      // Storage being unavailable only costs refresh persistence, never the session.
    }
  }, [key, hydratedKey, progress]);

  const markSeen = useCallback((ply: number) => {
    setProgress((current) => markMomentSeen(current, ply));
  }, []);

  const counts = useMemo(
    () => reviewSessionCounts(progress, analysis?.criticalMoments ?? []),
    [progress, analysis],
  );

  const value = useMemo<ReviewSessionValue>(() => ({ progress, counts, markSeen }), [progress, counts, markSeen]);

  // Any route where the board lands on a key moment counts as viewing it: Review,
  // Moves and Study share one board, and the session must survive the navigation
  // between them. Practice outcomes are counted separately.
  useEffect(() => {
    if (analysis === null) return;
    if (!analysis.criticalMoments.some((moment) => moment.ply === currentPly)) return;
    markSeen(currentPly);
  }, [analysis, currentPly, markSeen]);

  return <ReviewSessionContext.Provider value={value}>{children}</ReviewSessionContext.Provider>;
}

export function useReviewSession(): ReviewSessionValue {
  const value = useContext(ReviewSessionContext);
  if (!value) throw new Error("The guided review session lives in the persistent review layout.");
  return value;
}

/**
 * The ply whose analysis must stay hidden right now: the practice fault while a
 * session runs, or a guided moment the visitor has not answered yet. One hook, so
 * the board, the move list and the overview cannot disagree about what is visible.
 */
export function useWithheldPly(): number | null {
  const { retro } = useReviewRuntime();
  const currentPly = useReviewStore((store) => store.currentPly);
  const concealedPly = useReviewStore((store) => store.concealedPly);
  return retro.hiddenPly ?? concealedAnswerPly({ concealedPly, currentPly, practiceActive: retro.active });
}
