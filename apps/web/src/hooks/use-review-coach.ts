"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildDeterministicGameCoach,
  buildDeterministicMoveCoach,
  buildGameCoachFacts,
  buildMoveCoachFacts,
} from "@chess-review/analysis";
import type { GameAnalysisV2 } from "@chess-review/shared";
import type { AppSettings } from "../lib/app-settings";
import {
  explainCoachMove,
  summarizeCoachGame,
  type CoachRequestProvider,
  type LocalAiHealth,
} from "../lib/local-ai";
import type { LocalAiConnectionState, LocalAiHealthRuntime } from "../lib/use-local-ai-health";
import { useReviewStore } from "../store/review-store";

type CoachSettings = Pick<AppSettings, "coachProvider" | "coachLanguage" | "coachModel">;

export interface ReviewCoachTask {
  kind: "move" | "game";
  status: "running" | "complete" | "fallback" | "stale";
  ply?: number;
}

export function coachProviderReady(
  health: LocalAiHealth | null,
  provider: CoachRequestProvider,
  model: string,
): boolean {
  if (!health) return false;
  return provider === "ollama"
    ? health.coach.ollama === "available" && (health.coach.ollamaModels ?? []).includes(model || health.coach.configuredModel)
    : health.coach.openaiCompatible === "configured";
}

export function coachServiceText(
  state: LocalAiConnectionState,
  health: LocalAiHealth | null,
  provider: CoachRequestProvider,
  model: string,
  language: "en" | "zh-CN" = "en",
): string {
  const zh = language === "zh-CN";
  if (state === "checking") return zh ? "正在检查可选讲解服务…" : "Checking the optional coach service…";
  if (state === "offline") return zh ? "讲解服务离线。可用确定性摘要。" : "Coach offline · start pnpm dev for local generation. Grounded summaries remain available.";
  if (provider === "ollama") {
    if (health?.coach.ollama === "available" && !(health.coach.ollamaModels ?? []).includes(model || health.coach.configuredModel)) {
      return zh
        ? `${model || health.coach.configuredModel} 未安装。请在设置中选择已安装模型。`
        : `${model || health.coach.configuredModel} is not installed. Choose an installed model in Settings.`;
    }
    return health?.coach.ollama === "available"
      ? (zh ? "Ollama 可用。生成过程留在本机。" : "Ollama is available. Generation stays on this machine.")
      : (zh ? "Ollama 离线；将使用确定性回退。" : "Ollama is offline; deterministic fallback remains available.");
  }
  return health?.coach.openaiCompatible === "configured"
    ? (zh ? "已配置服务端 OpenAI 兼容接口。" : "OpenAI-compatible Responses provider is configured server-side.")
    : (zh ? "未配置 OpenAI 兼容接口；将使用确定性回退。" : "OpenAI-compatible provider is not configured; deterministic fallback remains available.");
}

function sameMoveFacts(analysis: GameAnalysisV2 | null, ply: number, serializedFacts: string): boolean {
  if (!analysis) return false;
  try {
    return JSON.stringify(buildMoveCoachFacts(analysis, ply)) === serializedFacts;
  } catch {
    return false;
  }
}

function sameGameFacts(analysis: GameAnalysisV2 | null, serializedFacts: string): boolean {
  return analysis ? JSON.stringify(buildGameCoachFacts(analysis)) === serializedFacts : false;
}

export function useReviewCoach(
  settings: CoachSettings,
  persistEnrichedAnalysis: (analysis: GameAnalysisV2 | null) => void,
  localAi: LocalAiHealthRuntime,
) {
  const [task, setTask] = useState<ReviewCoachTask | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const activeRequest = useRef<{ kind: "move" | "game"; controller: AbortController } | null>(null);
  const provider = settings.coachProvider;
  const language = settings.coachLanguage;
  const selectedModel = provider === "ollama" ? settings.coachModel : "";
  const zh = language === "zh-CN";

  useEffect(() => () => activeRequest.current?.controller.abort(), []);

  const generateMove = useCallback(async (ply: number) => {
    if (activeRequest.current) return;
    const analysis = useReviewStore.getState().analysis;
    if (!analysis || ply < 1 || ply > analysis.moves.length) return;
    const facts = buildMoveCoachFacts(analysis, ply);
    const serializedFacts = JSON.stringify(facts);
    const controller = new AbortController();
    activeRequest.current = { kind: "move", controller };
    setTask({ kind: "move", status: "running", ply });
    setNotice(null);
    let status: ReviewCoachTask["status"] = "complete";
    try {
      const currentHealth = localAi.health ?? await localAi.refresh(controller.signal);
      if (controller.signal.aborted) return;
      if (!coachProviderReady(currentHealth, provider, selectedModel)) {
        const connectionState: LocalAiConnectionState = currentHealth ? "online" : "offline";
        throw new Error(coachServiceText(connectionState, currentHealth, provider, selectedModel, language));
      }
      const result = await explainCoachMove(facts, {
        provider,
        ...(selectedModel.trim() === "" ? {} : { model: selectedModel }),
        language,
      }, controller.signal);
      if (controller.signal.aborted) return;
      const current = useReviewStore.getState().analysis;
      if (!sameMoveFacts(current, ply, serializedFacts)) {
        status = "stale";
        setNotice(zh ? "分析事实已变化，本次旧讲解未写入。" : "Analysis facts changed, so the stale explanation was not saved.");
        return;
      }
      persistEnrichedAnalysis(useReviewStore.getState().setMoveCoach(ply, result));
    } catch (error) {
      if (controller.signal.aborted) return;
      const reason = error instanceof Error ? error.message : "Coach provider unavailable.";
      const current = useReviewStore.getState().analysis;
      if (!sameMoveFacts(current, ply, serializedFacts)) {
        status = "stale";
        setNotice(zh ? "分析事实已变化，本次旧讲解未写入。" : "Analysis facts changed, so the stale explanation was not saved.");
        return;
      }
      status = "fallback";
      persistEnrichedAnalysis(useReviewStore.getState().setMoveCoach(ply, buildDeterministicMoveCoach(facts, language, reason)));
      setNotice(zh ? `已使用确定性中文回退：${reason}` : `Deterministic fallback used: ${reason}`);
    } finally {
      if (activeRequest.current?.controller === controller) {
        activeRequest.current = null;
        setTask({ kind: "move", status, ply });
      }
    }
  }, [language, localAi, persistEnrichedAnalysis, provider, selectedModel, zh]);

  const generateGame = useCallback(async () => {
    if (activeRequest.current) return;
    const analysis = useReviewStore.getState().analysis;
    if (!analysis) return;
    const facts = buildGameCoachFacts(analysis);
    const serializedFacts = JSON.stringify(facts);
    const controller = new AbortController();
    activeRequest.current = { kind: "game", controller };
    setTask({ kind: "game", status: "running" });
    setNotice(null);
    let status: ReviewCoachTask["status"] = "complete";
    try {
      const currentHealth = localAi.health ?? await localAi.refresh(controller.signal);
      if (controller.signal.aborted) return;
      if (!coachProviderReady(currentHealth, provider, selectedModel)) {
        const connectionState: LocalAiConnectionState = currentHealth ? "online" : "offline";
        throw new Error(coachServiceText(connectionState, currentHealth, provider, selectedModel, language));
      }
      const result = await summarizeCoachGame(facts, {
        provider,
        ...(selectedModel.trim() === "" ? {} : { model: selectedModel }),
        language,
      }, controller.signal);
      if (controller.signal.aborted) return;
      const current = useReviewStore.getState().analysis;
      if (!sameGameFacts(current, serializedFacts)) {
        status = "stale";
        setNotice(zh ? "分析事实已变化，本次旧学习计划未写入。" : "Analysis facts changed, so the stale study plan was not saved.");
        return;
      }
      persistEnrichedAnalysis(useReviewStore.getState().setGameCoachSummary(result));
    } catch (error) {
      if (controller.signal.aborted) return;
      const reason = error instanceof Error ? error.message : "Coach provider unavailable.";
      const current = useReviewStore.getState().analysis;
      if (!sameGameFacts(current, serializedFacts)) {
        status = "stale";
        setNotice(zh ? "分析事实已变化，本次旧学习计划未写入。" : "Analysis facts changed, so the stale study plan was not saved.");
        return;
      }
      status = "fallback";
      persistEnrichedAnalysis(useReviewStore.getState().setGameCoachSummary(buildDeterministicGameCoach(facts, language, reason)));
      setNotice(zh ? `已使用确定性中文回退：${reason}` : `Deterministic fallback used: ${reason}`);
    } finally {
      if (activeRequest.current?.controller === controller) {
        activeRequest.current = null;
        setTask({ kind: "game", status });
      }
    }
  }, [language, localAi, persistEnrichedAnalysis, provider, selectedModel, zh]);

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
