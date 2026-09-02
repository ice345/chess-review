"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { matchesHumanAnalysisIdentity } from "@chess-review/analysis";
import type { HumanAnalysis, MaiaModel, MaiaMoveReview, MaiaPositionAnalysis } from "@chess-review/shared";
import {
  analyzeMaiaPosition,
  downloadMaiaModel,
  reviewMaiaMove,
  type MaiaModelState,
} from "../lib/local-ai";
import { savePreferredHumanModel, savePreferredHumanTargetElo } from "../lib/app-settings";
import type { AnalysisMode } from "../lib/board-analysis-arrows";
import type { MaiaServiceState } from "../lib/human-lens-state";
import type { LocalAiHealthRuntime } from "../lib/use-local-ai-health";

export interface ReviewedMoveTarget {
  ply: number;
  fenBefore: string;
  uci: string;
}

interface MoveOutput {
  ply: number;
  fenBefore: string;
  uci: string;
  targetElo: number;
  model: MaiaModel;
  result: MaiaMoveReview;
}

interface PositionOutput {
  fen: string;
  targetElo: number;
  model: MaiaModel;
  result: MaiaPositionAnalysis;
}

export function useReviewHuman({
  localAi,
  positionFen,
  reviewedMove,
  persistedHuman,
  moveStockfishCandidateMoves,
  positionStockfishCandidateMoves,
  initialTargetElo,
  initialModel,
}: {
  localAi: LocalAiHealthRuntime;
  positionFen: string;
  reviewedMove: ReviewedMoveTarget | null;
  persistedHuman: HumanAnalysis | undefined;
  moveStockfishCandidateMoves: string[];
  positionStockfishCandidateMoves: string[];
  initialTargetElo: number;
  initialModel: MaiaModel;
}) {
  const [mode, setMode] = useState<AnalysisMode>("stockfish");
  const [targetElo, setTargetEloState] = useState(initialTargetElo);
  const [model, setModelState] = useState<MaiaModel>(initialModel);
  const [moveOutput, setMoveOutput] = useState<MoveOutput | null>(null);
  const [positionOutput, setPositionOutput] = useState<PositionOutput | null>(null);
  const [requestState, setRequestState] = useState<"idle" | "running" | "error">("idle");
  const [setupState, setSetupState] = useState<"idle" | "running" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const setupInFlight = useRef(false);
  const serviceState: MaiaServiceState = localAi.state === "checking"
    ? "checking"
    : localAi.health?.maia ?? "offline";
  const modelState: MaiaModelState = localAi.health?.maiaModels?.[model]
    ?? (serviceState === "available" ? "not-cached" : "unavailable");
  const modelReady = modelState === "active" || modelState === "cached";
  const reviewedMoveComplete = matchesHumanAnalysisIdentity(persistedHuman, model, targetElo);
  const moveReview = moveOutput
    && reviewedMove
    && moveOutput.ply === reviewedMove.ply
    && moveOutput.fenBefore === reviewedMove.fenBefore
    && moveOutput.uci === reviewedMove.uci
    && moveOutput.targetElo === targetElo
    && moveOutput.model === model
    ? moveOutput.result
    : null;
  const positionAnalysis = positionOutput?.fen === positionFen
    && positionOutput.targetElo === targetElo
    && positionOutput.model === model
    ? positionOutput.result
    : null;

  useEffect(() => {
    generation.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;
    setMoveOutput(null);
    setPositionOutput(null);
    setRequestState("idle");
    setError(null);
  }, [model, positionFen, reviewedMove?.fenBefore, reviewedMove?.ply, reviewedMove?.uci, targetElo]);

  const setTargetElo = useCallback((value: number) => {
    const bounded = Math.max(400, Math.min(3000, Math.round(value)));
    setTargetEloState(bounded);
    savePreferredHumanTargetElo(bounded);
  }, []);

  const setModel = useCallback((value: MaiaModel) => {
    setModelState(value);
    savePreferredHumanModel(value);
  }, []);

  const analyze = useCallback(async () => {
    if (activeRequest.current) return;
    const requestGeneration = ++generation.current;
    const controller = new AbortController();
    activeRequest.current = controller;
    const requestFen = positionFen;
    const requestTargetElo = targetElo;
    const requestModel = model;
    const requestMove = reviewedMove;
    setRequestState("running");
    setError(null);
    try {
      const currentHealth = localAi.health ?? await localAi.refresh();
      if (controller.signal.aborted || generation.current !== requestGeneration) return;
      const currentModelState = currentHealth?.maiaModels?.[requestModel];
      if (currentHealth?.maia !== "available") {
        setRequestState("error");
        setError(currentHealth?.maia === "not-installed"
          ? "The local runtime is online, but Maia-3 is not installed. Browser Stockfish remains available."
          : "Maia is unavailable. Browser Stockfish review remains available.");
        return;
      }
      if (currentModelState !== "active" && currentModelState !== "cached") {
        setRequestState("error");
        setError(requestModel + " is not cached. Download it explicitly before analysis.");
        return;
      }

      if (requestMove && !reviewedMoveComplete) {
        const response = await reviewMaiaMove({
          fenBefore: requestMove.fenBefore,
          playedMove: requestMove.uci,
          targetElo: requestTargetElo,
          selfElo: requestTargetElo,
          opponentElo: requestTargetElo,
          candidateMoves: moveStockfishCandidateMoves,
          multiPv: 5,
          model: requestModel,
        }, controller.signal);
        if (generation.current !== requestGeneration) return;
        setMoveOutput({
          ply: requestMove.ply,
          fenBefore: requestMove.fenBefore,
          uci: requestMove.uci,
          targetElo: requestTargetElo,
          model: requestModel,
          result: response,
        });
      }

      const response = await analyzeMaiaPosition({
        fen: requestFen,
        targetElo: requestTargetElo,
        selfElo: requestTargetElo,
        opponentElo: requestTargetElo,
        candidateMoves: positionStockfishCandidateMoves,
        multiPv: 5,
        model: requestModel,
      }, controller.signal);
      if (generation.current !== requestGeneration) return;
      setPositionOutput({
        fen: requestFen,
        targetElo: requestTargetElo,
        model: requestModel,
        result: response,
      });
      setRequestState("idle");
    } catch (requestError) {
      if (controller.signal.aborted || generation.current !== requestGeneration) return;
      setRequestState("error");
      setError(requestError instanceof Error ? requestError.message : "Maia analysis failed.");
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }, [localAi, model, moveStockfishCandidateMoves, positionFen, positionStockfishCandidateMoves, reviewedMove, reviewedMoveComplete, targetElo]);

  const setupModel = useCallback(async () => {
    if (setupInFlight.current) return;
    setupInFlight.current = true;
    const requestedModel = model;
    setSetupState("running");
    setError(null);
    try {
      await downloadMaiaModel(requestedModel);
      await localAi.refresh();
      setSetupState("idle");
    } catch (setupError) {
      setSetupState("error");
      setError(setupError instanceof Error ? setupError.message : "Unable to download " + requestedModel + ".");
    } finally {
      setupInFlight.current = false;
    }
  }, [localAi, model]);

  useEffect(() => {
    if (mode === "stockfish" || serviceState !== "available" || !modelReady) return;
    const hasMove = reviewedMove === null || reviewedMoveComplete || moveReview !== null;
    if ((positionAnalysis && hasMove) || requestState !== "idle") return;
    void analyze();
  }, [analyze, mode, modelReady, moveReview, positionAnalysis, requestState, reviewedMove, reviewedMoveComplete, serviceState]);

  return {
    mode,
    setMode,
    targetElo,
    setTargetElo,
    model,
    setModel,
    modelState,
    modelReady,
    moveReview,
    positionAnalysis,
    requestState,
    setupState,
    error,
    serviceState,
    analyze,
    setupModel,
    refreshService: localAi.refresh,
  };
}
