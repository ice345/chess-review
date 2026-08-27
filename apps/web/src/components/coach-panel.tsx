"use client";

import Link from "next/link";
import type {
  GameAnalysisV2,
  MoveAnalysis,
} from "@chess-review/shared";
import { coachProviderReady, coachServiceText } from "../hooks/use-review-coach";
import { useReviewRuntime } from "./review-runtime";

export function CoachPanel({
  analysis,
  move,
  onSelectPly,
}: {
  analysis: GameAnalysisV2;
  move: MoveAnalysis | null;
  onSelectPly: (ply: number) => void;
}) {
  const runtime = useReviewRuntime();
  const provider = runtime.coachProvider;
  const language = runtime.coachLanguage;
  const selectedModel = runtime.coachModel;
  const serviceState = runtime.coachServiceState;
  const health = runtime.coachHealth;
  const notice = runtime.coachNotice;
  const running = runtime.coachTask?.status === "running" ? runtime.coachTask.kind : null;
  const zh = language === "zh-CN";
  const humanProvenance = move?.human
    ? ` + ${move.human.model.replace("maia3-", "Maia-3 ").toUpperCase()} @ ${move.human.targetElo}`
    : "";
  const provenance = `Grounded by ${analysis.engine.stockfishVersion} depth ${analysis.engine.depth}${humanProvenance}`;

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
        <span className={`service-dot ${coachProviderReady(health, provider, selectedModel) ? "available" : serviceState === "offline" ? "offline" : "not-installed"}`} />
      </div>
      <p className="service-message">{coachServiceText(serviceState, health, provider, selectedModel)}</p>

      <div className="coach-configuration-summary">
        <span>{provider === "ollama" ? "Local Ollama" : "OpenAI-compatible"} · {language === "zh-CN" ? "简体中文" : "English"}</span>
        <Link href="/settings">{zh ? "前往设置" : "Configure in Settings"}</Link>
      </div>
      <div className="coach-actions">
        <button type="button" className="primary" disabled={running !== null} onClick={() => void runtime.generateGameCoach()}>
          {running === "game" ? (zh ? "正在生成整盘学习计划…" : "Generating whole-game study…") : (zh ? "生成整盘学习计划" : "Build whole-game study")}
        </button>
        <button type="button" className="secondary" disabled={!move || running !== null} onClick={() => move && void runtime.generateMoveCoach(move.ply)}>
          {running === "move" ? (zh ? "正在生成着法讲解…" : "Generating move review…") : move ? (zh ? `讲解 ${move.san}` : `Explain ${move.san}`) : (zh ? "请选择已复盘着法" : "Select a reviewed move")}
        </button>
      </div>
      {notice && <p className="coach-notice">{notice}</p>}
      <p className="coach-provenance">{provenance}</p>

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
            <summary>{zh ? "为什么可以相信这段讲解？" : "Why this explanation?"}</summary>
            <span>{provenance}</span>
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
              <button type="button" key={moment.ply} onClick={() => onSelectPly(moment.ply)}><span>{zh ? `第 ${moment.ply} 半回合` : `Ply ${moment.ply}`}</span><small>{moment.insight}</small></button>
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
