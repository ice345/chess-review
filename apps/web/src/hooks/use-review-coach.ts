"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildDeterministicGameCoach, buildDeterministicMoveCoach, buildGameCoachFacts, buildMoveCoachFacts, } from "@chess-review/analysis";
import type { GameAnalysisV2 } from "@chess-review/shared";
import type { AppSettings } from "../lib/app-settings";
import { explainCoachMove, summarizeCoachGame, type CoachRequestProvider, type LocalAiHealth, } from "../lib/local-ai";
import type { LocalAiConnectionState, LocalAiHealthRuntime } from "../lib/use-local-ai-health";
import { useReviewStore } from "../store/review-store";

type CoachSettings = Pick<AppSettings, "coachProvider" | "coachLanguage" | "coachModel">;
export interface ReviewCoachTask {
  kind: "move" | "game";
  status: "running" | "complete" | "fallback" | "stale";
  ply?: number;
}

export function coachProviderReady(health: LocalAiHealth | null, provider: CoachRequestProvider, model: string): boolean {
  if (!health)
    return false;
  return provider === "ollama"
    ? health.coach.ollama === "available" && (health.coach.ollamaModels ?? []).includes(model || health.coach.configuredModel)
    : health.coach.openaiCompatible === "configured";
}

export function coachServiceText(state: LocalAiConnectionState, health: LocalAiHealth | null, provider: CoachRequestProvider, model: string): string {
  if (state === "not-provided")
    return "Browser Core summaries use existing analysis facts on this device. Generative coaching is not provided by this website. See Help for Enhanced Local.";
  if (state === "not-configured")
    return "Local enhancements are not configured correctly. Grounded browser summaries remain available. See Help for local setup.";
  if (state === "checking")
    return "Checking the optional coach service…";
  if (state === "offline")
    return "Local coach is unreachable. Grounded browser summaries remain available; see Help for local setup.";
  if (provider === "ollama") {
    if (health?.coach.ollama === "available" && !(health.coach.ollamaModels ?? []).includes(model || health.coach.configuredModel)) {
      return `${model || health.coach.configuredModel} is not installed. Choose an installed model in Settings.`;
    }
    return health?.coach.ollama === "available"
      ? ("Ollama is available. Generation stays on this machine.")
      : ("Ollama is offline; deterministic fallback remains available.");
  }
  return health?.coach.openaiCompatible === "configured"
    ? ("OpenAI-compatible Responses provider is configured server-side.")
    : ("OpenAI-compatible provider is not configured; deterministic fallback remains available.");
}

function sameMoveFacts(analysis: GameAnalysisV2 | null, ply: number, serializedFacts: string): boolean {
  if (!analysis)
    return false;
  try {
    return JSON.stringify(buildMoveCoachFacts(analysis, ply)) === serializedFacts;
  }
  catch {
    return false;
  }
}

function sameGameFacts(analysis: GameAnalysisV2 | null, serializedFacts: string): boolean {
  return analysis ? JSON.stringify(buildGameCoachFacts(analysis)) === serializedFacts : false;
}

export function useReviewCoach(settings: CoachSettings, persistEnrichedAnalysis: (analysis: GameAnalysisV2 | null) => void, localAi: LocalAiHealthRuntime) {
  const [task, setTask] = useState<ReviewCoachTask | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const activeRequest = useRef<{
    kind: "move" | "game";
    controller: AbortController;
  } | null>(null);
  const provider = settings.coachProvider;
  const language = settings.coachLanguage;
  const selectedModel = provider === "ollama" ? settings.coachModel : "";
  useEffect(() => () => activeRequest.current?.controller.abort(), []);
  const generateMove = useCallback(async (ply: number) => {
    if (activeRequest.current)
      return;
    const analysis = useReviewStore.getState().analysis;
    if (!analysis || ply < 1 || ply > analysis.moves.length)
      return;
    const facts = buildMoveCoachFacts(analysis, ply);
    const serializedFacts = JSON.stringify(facts);
    const controller = new AbortController();
    activeRequest.current = { kind: "move", controller };
    setTask({ kind: "move", status: "running", ply });
    setNotice(null);
    let status: ReviewCoachTask["status"] = "complete";
    try {
      const currentHealth = localAi.health ?? await localAi.refresh(controller.signal);
      if (controller.signal.aborted)
        return;
      if (!coachProviderReady(currentHealth, provider, selectedModel)) {
        const connectionState: LocalAiConnectionState = currentHealth ? "online" : localAi.state;
        throw new Error(coachServiceText(connectionState, currentHealth, provider, selectedModel));
      }
      const result = await explainCoachMove(facts, {
        provider,
        ...(selectedModel.trim() === "" ? {} : { model: selectedModel }),
        language,
      }, controller.signal);
      if (controller.signal.aborted)
        return;
      const current = useReviewStore.getState().analysis;
      if (!sameMoveFacts(current, ply, serializedFacts)) {
        status = "stale";
        setNotice("Analysis facts changed, so the stale explanation was not saved.");
        return;
      }
      persistEnrichedAnalysis(useReviewStore.getState().setMoveCoach(ply, result));
    }
    catch (error) {
      if (controller.signal.aborted)
        return;
      const reason = error instanceof Error ? error.message : "Coach provider unavailable.";
      const current = useReviewStore.getState().analysis;
      if (!sameMoveFacts(current, ply, serializedFacts)) {
        status = "stale";
        setNotice("Analysis facts changed, so the stale explanation was not saved.");
        return;
      }
      status = "fallback";
      persistEnrichedAnalysis(useReviewStore.getState().setMoveCoach(ply, buildDeterministicMoveCoach(facts, language, reason)));
      setNotice(localAi.state === "not-provided" ? "Built on this device from the existing analysis facts." : `Deterministic fallback used: ${reason}`);
    }
    finally {
      if (activeRequest.current?.controller === controller) {
        activeRequest.current = null;
        setTask({ kind: "move", status, ply });
      }
    }
  }, [language, localAi, persistEnrichedAnalysis, provider, selectedModel]);
  const generateGame = useCallback(async () => {
    if (activeRequest.current)
      return;
    const analysis = useReviewStore.getState().analysis;
    if (!analysis)
      return;
    const facts = buildGameCoachFacts(analysis);
    const serializedFacts = JSON.stringify(facts);
    const controller = new AbortController();
    activeRequest.current = { kind: "game", controller };
    setTask({ kind: "game", status: "running" });
    setNotice(null);
    let status: ReviewCoachTask["status"] = "complete";
    try {
      const currentHealth = localAi.health ?? await localAi.refresh(controller.signal);
      if (controller.signal.aborted)
        return;
      if (!coachProviderReady(currentHealth, provider, selectedModel)) {
        const connectionState: LocalAiConnectionState = currentHealth ? "online" : localAi.state;
        throw new Error(coachServiceText(connectionState, currentHealth, provider, selectedModel));
      }
      const result = await summarizeCoachGame(facts, {
        provider,
        ...(selectedModel.trim() === "" ? {} : { model: selectedModel }),
        language,
      }, controller.signal);
      if (controller.signal.aborted)
        return;
      const current = useReviewStore.getState().analysis;
      if (!sameGameFacts(current, serializedFacts)) {
        status = "stale";
        setNotice("Analysis facts changed, so the stale study plan was not saved.");
        return;
      }
      persistEnrichedAnalysis(useReviewStore.getState().setGameCoachSummary(result));
    }
    catch (error) {
      if (controller.signal.aborted)
        return;
      const reason = error instanceof Error ? error.message : "Coach provider unavailable.";
      const current = useReviewStore.getState().analysis;
      if (!sameGameFacts(current, serializedFacts)) {
        status = "stale";
        setNotice("Analysis facts changed, so the stale study plan was not saved.");
        return;
      }
      status = "fallback";
      persistEnrichedAnalysis(useReviewStore.getState().setGameCoachSummary(buildDeterministicGameCoach(facts, language, reason)));
      setNotice(localAi.state === "not-provided" ? "Built on this device from the existing analysis facts." : `Deterministic fallback used: ${reason}`);
    }
    finally {
      if (activeRequest.current?.controller === controller) {
        activeRequest.current = null;
        setTask({ kind: "game", status });
      }
    }
  }, [language, localAi, persistEnrichedAnalysis, provider, selectedModel]);
  return {
    provider,
    language,
    selectedModel,
    serviceState: localAi.state,
    health: localAi.health,
    task,
    notice,
    generateMove,
    generateGame,
  };
}
