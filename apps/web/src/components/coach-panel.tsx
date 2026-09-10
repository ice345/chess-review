"use client";
import Link from "next/link";
import type { GameAnalysisV2, MoveAnalysisV2, } from "@chess-review/shared";
import { QUALITY_META, QualityIcon } from "@chess-review/ui";
import { coachProviderReady, coachServiceText } from "../hooks/use-review-coach";
import { formatEngineScore } from "../lib/review-format";
import { useReviewRuntime } from "./review-runtime";
export function CoachPanel({ analysis, move, onSelectPly, }: {
    analysis: GameAnalysisV2;
    move: MoveAnalysisV2 | null;
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
    ].filter((step): step is {
        key: string;
        label: string;
        value: string;
    } => Boolean(step.value)) : [];
    return (<div className="coach-tab">
      <div className="coach-heading">
        <span>Generation status</span>
        <span className={`service-dot ${coachProviderReady(health, provider, selectedModel) ? "available" : serviceState === "offline" ? "offline" : "not-installed"}`}/>
      </div>
      <p className="service-message">{coachServiceText(serviceState, health, provider, selectedModel)}</p>

      <div className="coach-configuration-summary">
        <span>{serviceState === "not-provided" ? "Browser Core" : provider === "ollama" ? "Local Ollama" : "OpenAI-compatible"} · {language === "zh-CN" ? "简体中文" : "English"}</span>
        <Link href="/settings">Configure in Settings</Link>
      </div>
      <div className="coach-actions">
        <button type="button" className="primary" disabled={running !== null} onClick={() => void runtime.generateGameCoach()}>
          {running === "game" ? "Generating whole-game study…" : serviceState === "not-provided" ? "Build grounded game summary" : "Build whole-game study"}
        </button>
        <button type="button" className="secondary" disabled={!move || running !== null} onClick={() => move && void runtime.generateMoveCoach(move.ply)}>
          {running === "move" ? "Generating move review…" : move ? (serviceState === "not-provided" ? `Review ${move.san} from facts` : `Explain ${move.san}`) : "Select a reviewed move"}
        </button>
      </div>
      {notice && <p className="coach-notice">{notice}</p>}
      <p className="coach-provenance">{provenance}</p>

      {move ? (<section className="move-evidence coach-move-facts" aria-label="Current move evidence">
          <div>
            <QualityIcon classification={move.classification} size={28}/>
            <span>
              <strong>{move.san} · {QUALITY_META[move.classification].label}</strong>
              <small>{move.annotations.length > 0 ? `Annotations · ${move.annotations.map((annotation) => annotation.replaceAll("_", " ")).join(", ")} · ` : ""}{move.phase} · Accuracy {move.accuracy.toFixed(1)}</small>
            </span>
          </div>
          <dl>
            <div><dt>Eval</dt><dd>{formatEngineScore(move.evaluationBefore)} → {formatEngineScore(move.playedMoveScore)}</dd></div>
            <div><dt>Win% loss</dt><dd>{move.classificationReason.winPercentLoss.toFixed(1)}</dd></div>
            <div><dt>Engine rank</dt><dd>{move.classificationReason.engineRank === undefined ? "Outside MultiPV" : `#${move.classificationReason.engineRank}`}</dd></div>
            <div><dt>Quality rule</dt><dd>{(move.classificationReason.qualityRule ?? move.classificationReason.precedenceRule).replaceAll("-", " ")}</dd></div>
          </dl>
          <small>These facts already exist. Generate a lesson only if you want them explained in words.</small>
        </section>) : (<section className="coach-game-facts" aria-label="Game evidence before study">
          <strong>{analysis.opening?.name ?? "Starting position"}</strong>
          <p>{`White ${analysis.white.accuracy?.toFixed(0) ?? "—"} · Black ${analysis.black.accuracy?.toFixed(0) ?? "—"} accuracy. ${analysis.criticalMoments.length} critical moment${analysis.criticalMoments.length === 1 ? "" : "s"}.`}</p>
          <small>Select a move on the board to see its Stockfish evidence, or generate a whole-game study.</small>
        </section>)}

      {coach && (<article className="coach-result">
          <div className="coach-source"><span>{coach.source.provider}</span><small>{coach.source.model} · {coach.confidence} confidence</small></div>
          <h3>{coach.headline}</h3>
          <p>{coach.summary}</p>
          {teachingSteps.length > 0 && <div className="coach-teaching-sequence">{teachingSteps.map((step, index) => <section className={`teaching-${step.key}`} key={step.key}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{step.label}</strong><p>{step.value}</p></div></section>)}</div>}
          {teachingSteps.length === 0 && coach.whyMoveWorks && <section><strong>Why it works</strong><p>{coach.whyMoveWorks}</p></section>}
          {teachingSteps.length === 0 && coach.whatWentWrong && <section><strong>What went wrong</strong><p>{coach.whatWentWrong}</p></section>}
          {teachingSteps.length === 0 && coach.betterPlan && <section><strong>Better plan</strong><p>{coach.betterPlan}</p></section>}
          {coach.humanPerspective && <section><strong>Human perspective</strong><p>{coach.humanPerspective}</p></section>}
          {coach.tacticalIdea && <section><strong>Tactical idea</strong><p>{coach.tacticalIdea}</p></section>}
          {!coach.takeaway && coach.trainingTip && <section className="training-tip"><strong>Training tip</strong><p>{coach.trainingTip}</p></section>}
          {coach.validatedLines.map((line) => (<section className="validated-line" key={`${line.start}-${line.label}`}>
              <strong>{line.label}</strong>
              <code>{line.moves.map((lineMove) => lineMove.san).join(" ")}</code>
              {line.note && <p>{line.note}</p>}
            </section>))}
          <details className="coach-grounding">
            <summary>Why this explanation?</summary>
            <span>{provenance}</span>
            <span>{`Facts v${coach.grounding.factsVersion} · ${coach.grounding.validatedLineCount} validated lines`}</span>
            <span>{`${coach.grounding.removedMoveMentions.length} ungrounded move mentions removed`}</span>
            <span>{`${coach.grounding.removedUnsupportedClaims.length} unsupported claims removed`}</span>
            {coach.source.fallbackReason && <span>Fallback: {coach.source.fallbackReason}</span>}
          </details>
        </article>)}

      {gameCoach && (<article className="game-coach-result">
          <div className="coach-source"><span>{gameCoach.source.provider}</span><small>{gameCoach.source.model} · {gameCoach.confidence} confidence</small></div>
          <h3>{gameCoach.headline}</h3>
          <p>{gameCoach.summary}</p>
          <div className="coach-two-column">
            <section><strong>Strengths</strong>{gameCoach.strengths.map((item) => <p key={item}>{item}</p>)}</section>
            <section><strong>Weaknesses</strong>{gameCoach.weaknesses.map((item) => <p key={item}>{item}</p>)}</section>
          </div>
          {gameCoach.criticalMoments.length > 0 && (<section className="coach-critical"><strong>Critical moments</strong>{gameCoach.criticalMoments.map((moment) => (<button type="button" key={moment.ply} onClick={() => onSelectPly(moment.ply)}><span>{`Ply ${moment.ply}`}</span><small>{moment.insight}</small></button>))}</section>)}
          <section className="training-list"><strong>Training recommendations</strong>{gameCoach.trainingRecommendations.map((item) => (<div key={item.title}><b>{item.title}</b><p>{item.reason}</p><small>{item.focus}</small></div>))}</section>
        </article>)}
    </div>);
}
