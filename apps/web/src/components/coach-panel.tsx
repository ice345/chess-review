"use client";

import Link from "next/link";
import {
  formatMoveNotation,
  formatMoveNumber,
  type CoachGrounding,
  type CoachLanguage,
  type CoachSource,
  type GameAnalysisV2,
  type MoveAnalysisV2,
} from "@chess-review/shared";
import { QualityIcon } from "@chess-review/ui";
import { coachProviderReady, coachServiceText } from "../hooks/use-review-coach";
import { useReviewRuntime } from "./review-runtime";

type Confidence = "high" | "medium" | "low";

type StudyCopy = {
  heading: string;
  intro: string;
  fallbackReady: string;
  generate: string;
  generatingGame: string;
  generateMove: (san: string) => string;
  generateMoveFromFacts: (san: string) => string;
  generatingMove: string;
  selectMove: string;
  writtenFromFacts: string;
  writtenFromStockfish: string;
  writtenWithModel: (model: string) => string;
  gameConfidenceHigh: string;
  gameConfidenceMedium: (verified: number, total: number) => string;
  gameConfidenceLow: string;
  moveConfidence: (level: Confidence) => string;
  strengths: string;
  weaknesses: string;
  criticalMoments: string;
  training: string;
  why: string;
  whyWorks: string;
  whatWentWrong: string;
  betterPlan: string;
  humanPerspective: string;
  tacticalIdea: string;
  trainingTip: string;
  notice: string;
  idea: string;
  problem: string;
  consequence: string;
  alternative: string;
  takeaway: string;
  practiceHidden: string;
  withheldFacts: string;
  withheldFactsNote: string;
  withheldMove: string;
  eval: string;
  winPercentLoss: string;
  engineRank: string;
  qualityRule: string;
  emptyGame: string;
  startingPosition: string;
  configure: string;
  languageName: string;
  lowEvidence: string;
  lowEvidenceCheck: string;
  accuracyLine: (white: string, black: string, moments: number) => string;
  browserCore: string;
  localOllama: string;
  openaiCompatible: string;
  fallbackUsed: string;
  stale: string;
  sourceRegion: string;
  factsVersion: (version: number, lines: number) => string;
  removedMentions: (count: number) => string;
  removedClaims: (count: number) => string;
  fallbackReason: (reason: string) => string;
  providerModel: (provider: string, model: string) => string;
};

const COPY: Record<CoachLanguage, StudyCopy> = {
  en: {
    heading: "This game's lesson",
    intro: "Generate a summary from this game's analysis.",
    fallbackReady: "A summary can still be built from this game's own analysis.",
    generate: "Build whole-game study",
    generatingGame: "Generating whole-game study…",
    generateMove: (san) => `Explain ${san}`,
    generateMoveFromFacts: (san) => `Review ${san} from facts`,
    generatingMove: "Generating move review…",
    selectMove: "Select a reviewed move",
    writtenFromFacts: "Written from this game's analysis",
    writtenFromStockfish: "Built from Stockfish facts",
    writtenWithModel: (model) => `Written with ${model}`,
    gameConfidenceHigh: "Confidence: high — every position was re-checked",
    gameConfidenceMedium: (verified, total) => `Confidence: medium — ${verified} of ${total} positions were re-checked`,
    gameConfidenceLow: "Confidence: low — based on the original search",
    moveConfidence: (level) => `Confidence: ${level} — remaining claims rest on this move's recorded facts`,
    strengths: "Strengths",
    weaknesses: "Weaknesses",
    criticalMoments: "Key moments",
    training: "Practice recommendations",
    why: "Why this explanation?",
    whyWorks: "Why it works",
    whatWentWrong: "What went wrong",
    betterPlan: "Better plan",
    humanPerspective: "Human perspective",
    tacticalIdea: "Tactical idea",
    trainingTip: "Training tip",
    notice: "What to notice",
    idea: "Your idea",
    problem: "The problem",
    consequence: "What happens next",
    alternative: "A practical alternative",
    takeaway: "Remember this",
    practiceHidden: "The explanation is hidden while you solve this position.",
    withheldFacts: "Withheld move evidence",
    withheldFactsNote: "Withheld while you solve this position.",
    withheldMove: "Selected move",
    eval: "Eval",
    winPercentLoss: "Win% loss",
    engineRank: "Engine rank",
    qualityRule: "Quality rule",
    emptyGame: "Select a move on the board, or generate a whole-game study.",
    startingPosition: "Starting position",
    configure: "Configure in Settings",
    languageName: "English",
    lowEvidence: "This summary is a numerical overview, not personalised guidance: there are no key moments, no human-model facts, and no re-checked lines.",
    lowEvidenceCheck: "Walk through each move on the board and compare your idea with the engine's first choice.",
    accuracyLine: (white, black, moments) => `White ${white} · Black ${black} accuracy. ${moments} key moment${moments === 1 ? "" : "s"}.`,
    browserCore: "Browser Core",
    localOllama: "Local Ollama",
    openaiCompatible: "OpenAI-compatible",
    fallbackUsed: "Built on this device from the existing analysis facts.",
    stale: "Analysis facts changed, so the stale explanation was not saved.",
    sourceRegion: "Lesson source",
    factsVersion: (version, lines) => `Facts v${version} · ${lines} validated lines`,
    removedMentions: (count) => `${count} ungrounded move mentions removed`,
    removedClaims: (count) => `${count} unsupported claims removed`,
    fallbackReason: (reason) => `Fallback: ${reason}`,
    providerModel: (provider, model) => `${provider} · ${model}`,
  },
  "zh-CN": {
    heading: "本局学习",
    intro: "根据本局分析生成学习总结。",
    fallbackReady: "即使没有本地写作服务，也可以根据本局分析生成总结。",
    generate: "生成本局总结",
    generatingGame: "正在生成本局总结…",
    generateMove: (san) => `讲解 ${san}`,
    generateMoveFromFacts: (san) => `根据棋局事实讲解 ${san}`,
    generatingMove: "正在生成本步讲解…",
    selectMove: "请先选择要讲解的一步",
    writtenFromFacts: "根据本局分析写成",
    writtenFromStockfish: "根据 Stockfish 分析写成",
    writtenWithModel: (model) => `由 ${model} 写成`,
    gameConfidenceHigh: "把握：高——每个局面都已复查",
    gameConfidenceMedium: (verified, total) => `把握：中——已复查 ${verified} / ${total} 个局面`,
    gameConfidenceLow: "把握：低——依据原始搜索，未再复查",
    moveConfidence: (level) => (
      level === "high" ? "把握：高——留下的判断都有这步记录的事实支持"
        : level === "medium" ? "把握：中——部分说法在核实时被去掉"
        : "把握：低——不少说法无法核对"
    ),
    strengths: "优点",
    weaknesses: "不足",
    criticalMoments: "关键节点",
    training: "训练建议",
    why: "为什么是这样解释？",
    whyWorks: "为什么成立",
    whatWentWrong: "问题在哪里",
    betterPlan: "更好的计划",
    humanPerspective: "人类视角",
    tacticalIdea: "战术想法",
    trainingTip: "训练提示",
    notice: "先看什么",
    idea: "你的想法",
    problem: "问题在哪里",
    consequence: "接下来会发生什么",
    alternative: "更实用的选择",
    takeaway: "记住这一点",
    practiceHidden: "解题时隐藏讲解。",
    withheldFacts: "隐藏的着法证据",
    withheldFactsNote: "解题期间隐藏这些数据。",
    withheldMove: "当前着法",
    eval: "评分",
    winPercentLoss: "胜率损失",
    engineRank: "引擎排名",
    qualityRule: "质量规则",
    emptyGame: "在棋盘上选择一步，或生成本局总结。",
    startingPosition: "起始局面",
    configure: "在设置中配置",
    languageName: "简体中文",
    lowEvidence: "这份总结只是数值概览，还不足以提供针对你的深入指导：没有关键节点、没有人类模型事实、也没有复查过的变化。",
    lowEvidenceCheck: "你可以逐步回放每一步，把自己的想法和引擎首选进行比较。",
    accuracyLine: (white, black, moments) => `白方准确率 ${white} · 黑方准确率 ${black}。${moments} 个关键节点。`,
    browserCore: "浏览器核心",
    localOllama: "本地 Ollama",
    openaiCompatible: "OpenAI 兼容",
    fallbackUsed: "已根据本局分析写成总结。",
    stale: "分析事实已变化，过期的讲解未保存。",
    sourceRegion: "总结来源",
    factsVersion: (version, lines) => `事实版本 v${version} · ${lines} 条已验证变化`,
    removedMentions: (count) => `去掉了 ${count} 处无法核对的着法提及`,
    removedClaims: (count) => `去掉了 ${count} 处缺少证据的说法`,
    fallbackReason: (reason) => `回退原因：${reason}`,
    providerModel: (provider, model) => `${provider} · ${model}`,
  },
};

function isWorkingFallbackNotice(notice: string | null): boolean {
  return notice !== null && (
    notice.startsWith("Deterministic fallback used")
    || notice.startsWith("Built on this device from the existing analysis facts.")
  );
}


function originCaption(source: CoachSource, copy: StudyCopy): string {
  if (source.provider === "deterministic") return copy.writtenFromFacts;
  return copy.writtenWithModel(source.model);
}

function gameConfidenceCaption(
  confidence: Confidence,
  verified: number,
  total: number,
  copy: StudyCopy,
): string {
  if (confidence === "high") return copy.gameConfidenceHigh;
  if (confidence === "medium") return copy.gameConfidenceMedium(verified, total);
  return copy.gameConfidenceLow;
}

function factsCannotSupportDepth(analysis: GameAnalysisV2): boolean {
  return analysis.criticalMoments.length === 0
    && analysis.engine.verifiedMoveCount === 0
    && !analysis.moves.some((move) => move.human);
}

function GroundingDetails({
  copy,
  engineLine,
  grounding,
  source,
}: {
  copy: StudyCopy;
  engineLine: string;
  grounding: CoachGrounding;
  source: CoachSource;
}) {
  return (
    <details className="coach-grounding">
      <summary>{copy.why}</summary>
      <span>{copy.writtenFromStockfish}</span>
      <span>{engineLine}</span>
      <span>{copy.providerModel(source.provider, source.model)}</span>
      <span>{copy.factsVersion(grounding.factsVersion, grounding.validatedLineCount)}</span>
      <span>{copy.removedMentions(grounding.removedMoveMentions.length)}</span>
      <span>{copy.removedClaims(grounding.removedUnsupportedClaims.length)}</span>
      {source.promptVersion && <span>{source.promptVersion}</span>}
      {source.fallbackReason && <span>{copy.fallbackReason(source.fallbackReason)}</span>}
    </details>
  );
}

export function CoachPanel({ analysis, move, onSelectPly }: {
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
  // Two languages, two jobs. The interface's own words — controls, status, the
  // grounding disclosure — follow the interface preference. The labels that caption
  // a lesson follow the language that lesson was written in, which is also the
  // language the lesson itself is selected by below.
  const uiLanguage = runtime.uiLanguage;
  const lesson = COPY[language];
  const copy = COPY[uiLanguage];
  const providerReady = coachProviderReady(health, provider, selectedModel);
  const usingFactsFallback = !providerReady
    || serviceState === "not-provided"
    || serviceState === "offline"
    || serviceState === "not-configured";
  const humanProvenance = move?.human
    ? ` + ${move.human.model.replace("maia3-", "Maia-3 ").toUpperCase()} @ ${move.human.targetElo}`
    : "";
  const engineLine = `${analysis.engine.stockfishVersion} depth ${analysis.engine.depth}${humanProvenance}`;
  const serviceText = coachServiceText(serviceState, health, provider, selectedModel);
  const coach = move?.coach?.source.language === language ? move.coach : undefined;
  const gameCoach = analysis.coachSummary?.source.language === language ? analysis.coachSummary : undefined;
  const teachingSteps = coach ? [
    { key: "notice", label: lesson.notice, value: coach.notice },
    { key: "idea", label: lesson.idea, value: coach.moveIdea },
    { key: "problem", label: lesson.problem, value: coach.problem },
    { key: "consequence", label: lesson.consequence, value: coach.consequence },
    { key: "alternative", label: lesson.alternative, value: coach.practicalAlternative },
    { key: "takeaway", label: lesson.takeaway, value: coach.takeaway },
  ].filter((step): step is { key: string; label: string; value: string } => Boolean(step.value)) : [];
  const practiceLocked = runtime.retro.locked;
  const lowEvidence = factsCannotSupportDepth(analysis);
  const verified = analysis.engine.verifiedMoveCount;
  const totalMoves = analysis.moves.length;
  const providerLabel = serviceState === "not-provided"
    ? copy.browserCore
    : provider === "ollama" ? copy.localOllama : copy.openaiCompatible;
  // Both branches exist because the raw notice is written in English: an English
  // interface shows it as it is, a Chinese one shows our own sentence for the state.
  const fallbackNotice = isWorkingFallbackNotice(notice);
  const visibleFallbackNotice = fallbackNotice
    ? (uiLanguage === "zh-CN" ? copy.fallbackUsed : notice)
    : null;
  const errorNotice = notice && !fallbackNotice
    ? (uiLanguage === "zh-CN" ? copy.stale : notice)
    : null;
  const selectedMoveLabel = move
    ? formatMoveNotation({ fenBefore: move.fenBefore, color: move.color, san: move.san })
    : null;
  const gameAction = running === "game" ? copy.generatingGame : copy.generate;
  const moveAction = running === "move"
    ? copy.generatingMove
    : move
      ? (serviceState === "not-provided" ? copy.generateMoveFromFacts(move.san) : copy.generateMove(move.san))
      : copy.selectMove;

  return (
    <div className="coach-tab">
      <div className="coach-heading">
        <div>
          <strong>{copy.heading}</strong>
          <small>{copy.intro}</small>
        </div>
      </div>
      {usingFactsFallback && <p className="coach-provenance">{copy.fallbackReady}</p>}
      <p>{analysis.opening?.name ?? copy.startingPosition}{uiLanguage === "zh-CN" ? "。" : ". "}{copy.accuracyLine(
        analysis.white.accuracy?.toFixed(0) ?? "—",
        analysis.black.accuracy?.toFixed(0) ?? "—",
        analysis.criticalMoments.length,
      )}</p>
      {selectedMoveLabel && <p className="coach-provenance">{selectedMoveLabel}</p>}
      <div className="coach-actions">
        <button type="button" className="primary" disabled={running !== null} onClick={() => void runtime.generateGameCoach()}>
          {gameAction}
        </button>
        <button type="button" className="secondary" disabled={!move || running !== null} onClick={() => move && void runtime.generateMoveCoach(move.ply)}>
          {moveAction}
        </button>
      </div>
      {!gameCoach && !coach && !practiceLocked && <p className="coach-provenance">{copy.emptyGame}</p>}

      {practiceLocked && (
        <>
          <p className="utility-note" role="status">{copy.practiceHidden}</p>
          {/* The evidence exists and stays structurally visible; only its values are
              withheld, so the visitor can see what is being held back. */}
          {move && (
            <section className="move-evidence coach-move-facts" aria-label={copy.withheldFacts}>
              <div>
                <QualityIcon classification="book" size={28} decorative />
                <span>
                  <strong>{copy.withheldMove}</strong>
                  <small>{copy.withheldFactsNote}</small>
                </span>
              </div>
              <dl>
                <div><dt>{copy.eval}</dt><dd>—</dd></div>
                <div><dt>{copy.winPercentLoss}</dt><dd>—</dd></div>
                <div><dt>{copy.engineRank}</dt><dd>—</dd></div>
                <div><dt>{copy.qualityRule}</dt><dd>—</dd></div>
              </dl>
            </section>
          )}
        </>
      )}

      {gameCoach && !practiceLocked && (
        <article className="game-coach-result">
          <p className="coach-provenance">{originCaption(gameCoach.source, copy)}</p>
          <p className="coach-provenance">{gameConfidenceCaption(gameCoach.confidence, verified, totalMoves, copy)}</p>
          <h3>{gameCoach.headline}</h3>
          <p>{gameCoach.summary}</p>
          <div className="coach-two-column">
            <section><strong>{lesson.strengths}</strong>{gameCoach.strengths.map((item) => <p key={item}>{item}</p>)}</section>
            <section><strong>{lesson.weaknesses}</strong>{gameCoach.weaknesses.map((item) => <p key={item}>{item}</p>)}</section>
          </div>
          {gameCoach.criticalMoments.length > 0 && (
            <section className="coach-critical">
              <strong>{lesson.criticalMoments}</strong>
              {gameCoach.criticalMoments.map((moment) => {
                const recorded = analysis.moves[moment.ply - 1];
                if (!recorded) return null;
                const notation = formatMoveNotation({ fenBefore: recorded.fenBefore, color: recorded.color, san: recorded.san });
                return (
                  <button
                    type="button"
                    key={moment.ply}
                    onClick={() => onSelectPly(moment.ply)}
                    aria-label={notation}
                    style={{ gridTemplateColumns: "auto minmax(0, 1fr)" }}
                  >
                    <span>{formatMoveNumber(recorded.fenBefore, recorded.color)} {recorded.san}</span>
                    <small>{moment.insight}</small>
                  </button>
                );
              })}
            </section>
          )}
          {lowEvidence ? (
            <section className="training-list">
              <strong>{lesson.training}</strong>
              <div>
                <p>{copy.lowEvidence}</p>
                <small>{copy.lowEvidenceCheck}</small>
              </div>
            </section>
          ) : (
            <section className="training-list">
              <strong>{lesson.training}</strong>
              {gameCoach.trainingRecommendations.map((item) => (
                <div key={item.title}><b>{item.title}</b><p>{item.reason}</p><small>{item.focus}</small></div>
              ))}
            </section>
          )}
          <GroundingDetails copy={copy} engineLine={engineLine} grounding={gameCoach.grounding} source={gameCoach.source} />
        </article>
      )}

      {coach && !practiceLocked && (
        <article className="coach-result">
          <p className="coach-provenance">{originCaption(coach.source, copy)}</p>
          <p className="coach-provenance">{copy.moveConfidence(coach.confidence)}</p>
          <h3>{coach.headline}</h3>
          <p>{coach.summary}</p>
          {teachingSteps.length > 0 && (
            <div className="coach-teaching-sequence">
              {teachingSteps.map((step, index) => (
                <section className={`teaching-${step.key}`} key={step.key}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{step.label}</strong><p>{step.value}</p></div>
                </section>
              ))}
            </div>
          )}
          {teachingSteps.length === 0 && coach.whyMoveWorks && <section><strong>{lesson.whyWorks}</strong><p>{coach.whyMoveWorks}</p></section>}
          {teachingSteps.length === 0 && coach.whatWentWrong && <section><strong>{lesson.whatWentWrong}</strong><p>{coach.whatWentWrong}</p></section>}
          {teachingSteps.length === 0 && coach.betterPlan && <section><strong>{lesson.betterPlan}</strong><p>{coach.betterPlan}</p></section>}
          {coach.humanPerspective && <section><strong>{lesson.humanPerspective}</strong><p>{coach.humanPerspective}</p></section>}
          {coach.tacticalIdea && <section><strong>{lesson.tacticalIdea}</strong><p>{coach.tacticalIdea}</p></section>}
          {!coach.takeaway && coach.trainingTip && <section className="training-tip"><strong>{lesson.trainingTip}</strong><p>{coach.trainingTip}</p></section>}
          {coach.validatedLines.map((line) => (
            <section className="validated-line" key={`${line.start}-${line.label}`}>
              <strong>{line.label}</strong>
              <code>{line.moves.map((lineMove) => lineMove.san).join(" ")}</code>
              {line.note && <p>{line.note}</p>}
            </section>
          ))}
          <GroundingDetails copy={copy} engineLine={engineLine} grounding={coach.grounding} source={coach.source} />
        </article>
      )}

      <section className="coach-source-panel" style={{ order: 3 }} aria-label={copy.sourceRegion}>
        <div className="coach-configuration-summary">
          {/* The one label that names a language names the lesson's, in its own script. */}
          <span>{providerLabel} · {lesson.languageName}</span>
          <Link href="/settings">{copy.configure}</Link>
        </div>
        {visibleFallbackNotice && <p className="coach-provenance">{visibleFallbackNotice}</p>}
        {errorNotice && <p className="coach-notice">{errorNotice}</p>}
        {/* The service status is written in English, so it is shown in an English interface. */}
        {uiLanguage === "en" && <p className="service-message">{serviceText}</p>}
        <details className="coach-grounding">
          <summary>{copy.sourceRegion}</summary>
          <span>{copy.writtenFromStockfish}</span>
          <span className="coach-engine-line">{engineLine}</span>
          {language !== "en" && <span className="service-message">{serviceText}</span>}
        </details>
      </section>
    </div>
  );
}
