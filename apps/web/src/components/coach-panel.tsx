"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  buildDeterministicGameCoach,
  buildDeterministicMoveCoach,
  buildGameCoachFacts,
  buildMoveCoachFacts,
} from "@chess-review/analysis";
import type {
  CoachExplanation,
  CoachLanguage,
  GameAnalysisV1,
  GameCoachSummary,
  MoveAnalysis,
} from "@chess-review/shared";
import { QUALITY_META } from "@chess-review/ui";
import {
  explainCoachMove,
  summarizeCoachGame,
  type CoachRequestProvider,
  type LocalAiHealth,
} from "../lib/local-ai";
import { loadAppSettings } from "../lib/app-settings";
import { useLocalAiHealth } from "../lib/use-local-ai-health";

function scoreLabel(score: MoveAnalysis["evaluationBefore"]): string {
  if (score.kind === "mate") return score.mateIn > 0 ? `M${score.mateIn}` : `−M${Math.abs(score.mateIn)}`;
  const pawns = score.cp / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}

function providerReady(health: LocalAiHealth | null, provider: CoachRequestProvider, model: string): boolean {
  if (!health) return false;
  return provider === "ollama"
    ? health.coach.ollama === "available" && (health.coach.ollamaModels ?? []).includes(model || health.coach.configuredModel)
    : health.coach.openaiCompatible === "configured";
}

function serviceText(
  state: "checking" | "online" | "offline",
  health: LocalAiHealth | null,
  provider: CoachRequestProvider,
  model: string,
): string {
  if (state === "checking") return "Checking the optional coach service…";
  if (state === "offline") return "Coach offline · start pnpm dev for local generation. Grounded summaries remain available.";
  if (provider === "ollama") {
    if (health?.coach.ollama === "available" && !(health.coach.ollamaModels ?? []).includes(model || health.coach.configuredModel)) {
      return `${model || health.coach.configuredModel} is not installed. Choose an installed model in Settings.`;
    }
    return health?.coach.ollama === "available"
      ? "Ollama is available. Generation stays on this machine."
      : "Ollama is offline; deterministic fallback remains available.";
  }
  return health?.coach.openaiCompatible === "configured"
    ? "OpenAI-compatible Responses provider is configured server-side."
    : "OpenAI-compatible provider is not configured; deterministic fallback remains available.";
}

export function CoachPanel({
  analysis,
  move,
  onMoveUpdate,
  onGameUpdate,
  onSelectPly,
}: {
  analysis: GameAnalysisV1;
  move: MoveAnalysis | null;
  onMoveUpdate: (coach: CoachExplanation) => void;
  onGameUpdate: (summary: GameCoachSummary) => void;
  onSelectPly: (ply: number) => void;
}) {
  const localAi = useLocalAiHealth();
  const serviceState = localAi.state;
  const health = localAi.health;
  const [provider, setProvider] = useState<CoachRequestProvider>("ollama");
  const [ollamaModel, setOllamaModel] = useState("gemma4:12b-it-qat");
  const [openAiModel] = useState("");
  const [language, setLanguage] = useState<CoachLanguage>("zh-CN");
  const [running, setRunning] = useState<"move" | "game" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const settings = loadAppSettings();
    setProvider(settings.coachProvider);
    setLanguage(settings.coachLanguage);
    setOllamaModel(settings.coachModel);
  }, []);

  const selectedModel = provider === "ollama" ? ollamaModel : openAiModel;
  const zh = language === "zh-CN";

  async function generateMove() {
    if (!move || running) return;
    setRunning("move");
    setNotice(null);
    const facts = buildMoveCoachFacts(analysis, move.ply);
    try {
      const currentHealth = health ?? await localAi.refresh();
      if (!providerReady(currentHealth, provider, selectedModel)) throw new Error(serviceText(serviceState, currentHealth, provider, selectedModel));
      const result = await explainCoachMove(facts, {
        provider,
        ...(selectedModel.trim() === "" ? {} : { model: selectedModel }),
        language,
      });
      onMoveUpdate(result);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Coach provider unavailable.";
      onMoveUpdate(buildDeterministicMoveCoach(facts, language, reason));
      setNotice(zh ? `已使用确定性中文回退：${reason}` : `Deterministic fallback used: ${reason}`);
    } finally {
      setRunning(null);
    }
  }

  async function generateGame() {
    if (running) return;
    setRunning("game");
    setNotice(null);
    const facts = buildGameCoachFacts(analysis);
    try {
      const currentHealth = health ?? await localAi.refresh();
      if (!providerReady(currentHealth, provider, selectedModel)) throw new Error(serviceText(serviceState, currentHealth, provider, selectedModel));
      const result = await summarizeCoachGame(facts, {
        provider,
        ...(selectedModel.trim() === "" ? {} : { model: selectedModel }),
        language,
      });
      onGameUpdate(result);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Coach provider unavailable.";
      onGameUpdate(buildDeterministicGameCoach(facts, language, reason));
      setNotice(zh ? `已使用确定性中文回退：${reason}` : `Deterministic fallback used: ${reason}`);
    } finally {
      setRunning(null);
    }
  }

  const coach = move?.coach?.source.language === language ? move.coach : undefined;
  const gameCoach = analysis.coachSummary?.source.language === language ? analysis.coachSummary : undefined;
  const teachingSteps = coach ? [
    { key: "notice", label: language === "zh-CN" ? "先看什么" : "What to notice", value: coach.notice },
    { key: "idea", label: language === "zh-CN" ? "你的想法" : "Your idea", value: coach.moveIdea },
    { key: "problem", label: language === "zh-CN" ? "问题在哪里" : "The problem", value: coach.problem },
    { key: "consequence", label: language === "zh-CN" ? "接下来会发生什么" : "What happens next", value: coach.consequence },
    { key: "alternative", label: language === "zh-CN" ? "更实用的选择" : "A practical alternative", value: coach.practicalAlternative },
    { key: "takeaway", label: language === "zh-CN" ? "记住这一点" : "Remember this", value: coach.takeaway },
  ].filter((step): step is { key: string; label: string; value: string } => Boolean(step.value)) : [];

  return (
    <div className="coach-tab">
      <div className="coach-heading">
        <span>{zh ? "生成状态" : "Generation status"}</span>
        <span className={`service-dot ${providerReady(health, provider, selectedModel) ? "available" : serviceState === "offline" ? "offline" : "not-installed"}`} />
      </div>
      <p className="service-message">{serviceText(serviceState, health, provider, selectedModel)}</p>

      <div className="coach-configuration-summary">
        <span>{provider === "ollama" ? "Local Ollama" : "OpenAI-compatible"} · {language === "zh-CN" ? "简体中文" : "English"}</span>
        <Link href="/settings">{zh ? "前往设置" : "Configure in Settings"}</Link>
      </div>
      <div className="coach-actions">
        <button className="primary" disabled={!move || running !== null} onClick={() => void generateMove()}>
          {running === "move" ? (zh ? "正在生成着法讲解…" : "Generating move review…") : move ? (zh ? `讲解 ${move.san}` : `Explain ${move.san}`) : (zh ? "请选择已复盘着法" : "Select a reviewed move")}
        </button>
        <button className="secondary" disabled={running !== null} onClick={() => void generateGame()}>
          {running === "game" ? (zh ? "正在生成整盘复盘…" : "Generating game review…") : (zh ? "整盘总结与训练建议" : "Game summary & training")}
        </button>
      </div>
      {notice && <p className="coach-notice">{notice}</p>}

      {move && (
        <div className="coach-fact-boundaries">
          <section>
            <div className="eyebrow">OBJECTIVE · STOCKFISH</div>
            <strong>{QUALITY_META[move.classification].label}</strong>
            <span>White POV {scoreLabel(move.evaluationBefore)} → {scoreLabel(move.playedMoveScore)}</span>
            <small>Accuracy {move.accuracy.toFixed(1)} · canonical facts</small>
          </section>
          <section>
            <div className="eyebrow">HUMAN · MAIA</div>
            {move.human ? (
              <><strong>{(move.human.playedMoveProbability * 100).toFixed(1)}%</strong><span>{move.human.findDifficulty.label.replaceAll("-", " ")} · Policy rank #{move.human.playedMoveRank}</span><small>{move.human.model} @ {move.human.targetElo} · same persisted move facts</small></>
            ) : (
              <><strong>Not requested</strong><span>No human claim added</span></>
            )}
          </section>
        </div>
      )}

      {coach && (
        <article className="coach-result">
          <div className="coach-source"><span>{coach.source.provider}</span><small>{coach.source.model} · {coach.confidence} confidence</small></div>
          <h3>{coach.headline}</h3>
          <p>{coach.summary}</p>
          {teachingSteps.length > 0 && <div className="coach-teaching-sequence">{teachingSteps.map((step, index) => <section className={`teaching-${step.key}`} key={step.key}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{step.label}</strong><p>{step.value}</p></div></section>)}</div>}
          {teachingSteps.length === 0 && coach.whyMoveWorks && <section><strong>{zh ? "为什么有效" : "Why it works"}</strong><p>{coach.whyMoveWorks}</p></section>}
          {teachingSteps.length === 0 && coach.whatWentWrong && <section><strong>{zh ? "问题在哪里" : "What went wrong"}</strong><p>{coach.whatWentWrong}</p></section>}
          {teachingSteps.length === 0 && coach.betterPlan && <section><strong>{zh ? "更好的计划" : "Better plan"}</strong><p>{coach.betterPlan}</p></section>}
          {coach.humanPerspective && <section><strong>{zh ? "人类视角" : "Human perspective"}</strong><p>{coach.humanPerspective}</p></section>}
          {coach.tacticalIdea && <section><strong>{zh ? "战术思路" : "Tactical idea"}</strong><p>{coach.tacticalIdea}</p></section>}
          {!coach.takeaway && coach.trainingTip && <section className="training-tip"><strong>{zh ? "训练建议" : "Training tip"}</strong><p>{coach.trainingTip}</p></section>}
          {coach.validatedLines.map((line) => (
            <section className="validated-line" key={`${line.start}-${line.label}`}>
              <strong>{line.label}</strong>
              <code>{line.moves.map((lineMove) => lineMove.san).join(" ")}</code>
              {line.note && <p>{line.note}</p>}
            </section>
          ))}
          <details className="coach-grounding">
            <summary>{zh ? "事实约束报告" : "Grounding report"}</summary>
            <span>Facts v{coach.grounding.factsVersion} · {coach.grounding.validatedLineCount} validated lines</span>
            <span>{coach.grounding.removedMoveMentions.length} ungrounded move mentions removed</span>
            <span>{coach.grounding.removedUnsupportedClaims.length} unsupported claims removed</span>
            {coach.source.fallbackReason && <span>Fallback: {coach.source.fallbackReason}</span>}
          </details>
        </article>
      )}

      {gameCoach && (
        <article className="game-coach-result">
          <div className="coach-source"><span>{gameCoach.source.provider}</span><small>{gameCoach.source.model} · {gameCoach.confidence} confidence</small></div>
          <h3>{gameCoach.headline}</h3>
          <p>{gameCoach.summary}</p>
          <div className="coach-two-column">
            <section><strong>{zh ? "做得好的地方" : "Strengths"}</strong>{gameCoach.strengths.map((item) => <p key={item}>{item}</p>)}</section>
            <section><strong>{zh ? "需要改进的地方" : "Weaknesses"}</strong>{gameCoach.weaknesses.map((item) => <p key={item}>{item}</p>)}</section>
          </div>
          {gameCoach.criticalMoments.length > 0 && (
            <section className="coach-critical"><strong>{zh ? "关键节点" : "Critical moments"}</strong>{gameCoach.criticalMoments.map((moment) => (
              <button key={moment.ply} onClick={() => onSelectPly(moment.ply)}><span>{zh ? `第 ${moment.ply} 半回合` : `Ply ${moment.ply}`}</span><small>{moment.insight}</small></button>
            ))}</section>
          )}
          <section className="training-list"><strong>{zh ? "训练建议" : "Training recommendations"}</strong>{gameCoach.trainingRecommendations.map((item) => (
            <div key={item.title}><b>{item.title}</b><p>{item.reason}</p><small>{item.focus}</small></div>
          ))}</section>
        </article>
      )}
    </div>
  );
}
