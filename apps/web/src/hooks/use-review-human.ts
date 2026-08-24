"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeMaiaMove, type MaiaMovesResponse } from "../lib/local-ai";
import { savePreferredHumanTargetElo } from "../lib/app-settings";
import type { AnalysisLens } from "../lib/board-analysis-arrows";
import type { MaiaServiceState } from "../lib/human-lens-state";
import { useLocalAiHealth } from "../lib/use-local-ai-health";

export function useReviewHuman({
  positionFen,
  playedMove,
  initialTargetElo,
}: {
  positionFen: string;
  playedMove?: string;
  initialTargetElo: number;
}) {
  const localAi = useLocalAiHealth();
  const [lens, setLens] = useState<AnalysisLens>("objective");
  const [targetElo, setTargetEloState] = useState(initialTargetElo);
  const [output, setOutput] = useState<{ fen: string; targetElo: number; result: MaiaMovesResponse } | null>(null);
  const [requestState, setRequestState] = useState<"idle" | "running" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const serviceState: MaiaServiceState = localAi.state === "checking"
    ? "checking"
    : localAi.health?.maia ?? "offline";
  const result = output?.fen === positionFen && output.targetElo === targetElo ? output.result : null;

  useEffect(() => {
    generation.current += 1;
    setOutput(null);
    setRequestState("idle");
    setError(null);
  }, [positionFen, targetElo]);

  const setTargetElo = useCallback((value: number) => {
    const bounded = Math.max(400, Math.min(3000, Math.round(value)));
    setTargetEloState(bounded);
    savePreferredHumanTargetElo(bounded);
  }, []);

  const analyze = useCallback(async () => {
    const currentHealth = localAi.health ?? await localAi.refresh();
    if (currentHealth?.maia !== "available") {
      setRequestState("error");
      setError(currentHealth?.maia === "not-installed"
        ? "The local runtime is online, but Maia-3 is not installed. Browser Stockfish remains available."
        : "Maia is unavailable. Browser Stockfish review remains available.");
      return;
    }
    const requestGeneration = ++generation.current;
    const requestFen = positionFen;
    const requestTargetElo = targetElo;
    setRequestState("running");
    setError(null);
    try {
      const response = await analyzeMaiaMove({
        fen: requestFen,
        targetElo: requestTargetElo,
        selfElo: requestTargetElo,
        opponentElo: requestTargetElo,
        ...(playedMove === undefined ? {} : { playedMove }),
        multiPv: 5,
        model: "maia3-5m",
      });
      if (generation.current !== requestGeneration) return;
      setOutput({ fen: requestFen, targetElo: requestTargetElo, result: response });
      setRequestState("idle");
    } catch (requestError) {
      if (generation.current !== requestGeneration) return;
      setRequestState("error");
      setError(requestError instanceof Error ? requestError.message : "Maia analysis failed.");
    }
  }, [localAi, playedMove, positionFen, targetElo]);

  useEffect(() => {
    if (lens !== "human" || serviceState !== "available" || result || requestState !== "idle") return;
    void analyze();
  }, [analyze, lens, requestState, result, serviceState]);

  return {
    lens,
    setLens,
    targetElo,
    setTargetElo,
    result,
    requestState,
    error,
    serviceState,
    analyze,
    refreshService: localAi.refresh,
  };
}
