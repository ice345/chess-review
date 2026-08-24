"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { NormalizedGame } from "@chess-review/chess-core";
import type { GameDivision, OpeningInfo } from "@chess-review/shared";
import type { ReviewRunState } from "../components/review-runtime";
import { getCachedAnalysis } from "../lib/analysis-cache";
import type { AppSettings } from "../lib/app-settings";
import { getReviewRecord, saveReviewRecord, type ReviewRecord } from "../lib/review-library";
import { useReviewStore } from "../store/review-store";

type RunFullGame = (
  game: NormalizedGame,
  division: GameDivision,
  opening: OpeningInfo | null,
  depth: number,
  multiPv: number,
) => Promise<void>;

export function useReviewRecord({
  gameId,
  settings,
  runFullGame,
  setReviewState,
}: {
  gameId: string;
  settings: Pick<AppSettings, "reviewDepth" | "reviewMultiPv">;
  runFullGame: RunFullGame;
  setReviewState: Dispatch<SetStateAction<ReviewRunState>>;
}) {
  const [record, setRecord] = useState<ReviewRecord | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    setLoadError(null);
    void getReviewRecord(gameId).then(async (loaded) => {
      if (!active) return;
      if (!loaded) {
        setRecord(null);
        setLoadState("missing");
        return;
      }
      setRecord(loaded);
      useReviewStore.getState().setOrientation(
        loaded.orientationOverride ?? loaded.preferredOrientation ?? "white",
      );
      if (loaded.kind === "fen") {
        useReviewStore.getState().loadFen(loaded.input);
        setReviewState("idle");
      } else {
        useReviewStore.getState().loadPgn(loaded.input);
        const review = useReviewStore.getState();
        if (!review.game || !review.division) {
          throw new Error(review.error ?? "Unable to normalize the stored PGN.");
        }
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
          void runFullGame(
            review.game,
            review.division,
            review.opening,
            settings.reviewDepth,
            settings.reviewMultiPv,
          );
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
  }, [gameId, runFullGame, setReviewState, settings]);

  return { record, setRecord, loadState, loadError };
}
