"use client";

import Link from "next/link";
import { formatMoveNotation, type MoveAnalysisV2, type UiLanguage } from "@chess-review/shared";
import {
  HUMAN_DIFFICULTY_LABELS,
  Icon,
  QualityIcon,
  qualityLabel,
} from "@chess-review/ui";
import { useReviewRuntime } from "../review-runtime";
import {
  annotationsLabel,
  baselineOnlyCaveat,
  engineChoiceLabel,
  moveEvidenceSentence,
  sacrificeLabel,
  verificationLabel,
  winningChancesLabel,
} from "../../lib/move-evidence-copy";
import { useUiLanguage } from "../../hooks/use-ui-language";

function percentage(value: number): string {
  return (value * 100).toFixed(value < 0.1 ? 1 : 0) + "%";
}

function modelLabel(model: string): string {
  return model.replace("maia3-", "Maia-3 ").toUpperCase();
}

type VerdictCopy = {
  aria: (label: string) => string;
  why: string;
  depth: (depth: number) => string;
  engine: string;
  winningChances: string;
  accuracy: string;
  search: string;
  sacrifice: string;
  annotations: string;
  ruledOut: string;
  internals: string;
  toFind: (label: string, difficulty: string) => string;
  reviewing: string;
  humanUnavailable: string;
  evidence: string;
  policyLine: (probability: string, rank: number, model: string, elo: number, wdl: string) => string;
  wdl: (win: string, draw: string, loss: string) => string;
  experimental: (score: string, band: string) => string;
  modelNote: (model: string, elo: number) => string;
  explainAria: (san: string) => string;
  explain: string;
  bands: Record<"common" | "plausible" | "uncommon" | "rare" | "very-rare", string>;
};

const COPY: Record<UiLanguage, VerdictCopy> = {
  en: {
    aria: (label) => "Current move " + label + " verdicts",
    why: "Why? \u00b7 engine, win chances, search",
    depth: (depth) => `Depth ${depth}`,
    engine: "Engine",
    winningChances: "Winning chances",
    accuracy: "Accuracy",
    search: "Search",
    sacrifice: "Sacrifice",
    annotations: "Annotations",
    ruledOut: "Ruled out",
    internals: "Classification internals",
    toFind: (label, difficulty) => `${label} \u00b7 ${difficulty} to find`,
    reviewing: "Reviewing this exact move\u2026",
    humanUnavailable: "Human move review not available yet",
    evidence: "Evidence",
    policyLine: (probability, rank, model, elo, wdl) => `${probability} policy probability \u00b7 rank #${rank} \u00b7 ${model} @ ${elo}${wdl}`,
    wdl: (win, draw, loss) => ` \u00b7 WDL ${win} / ${draw} / ${loss}`,
    experimental: (score, band) => `Experimental score ${score}/100 \u00b7 ${band} policy band`,
    modelNote: (model, elo) => `${model} @ ${elo} \u00b7 model prediction, never objective quality`,
    explainAria: (san) => `Explain this move: ${san}`,
    explain: "Explain this move",
    bands: {
      common: "common",
      plausible: "plausible",
      uncommon: "uncommon",
      rare: "rare",
      "very-rare": "very-rare",
    },
  },
  "zh-CN": {
    aria: (label) => `当前着法 ${label} 判定`,
    why: "为什么？· 引擎、获胜机会、搜索",
    depth: (depth) => `深度 ${depth}`,
    engine: "引擎",
    winningChances: "获胜机会",
    accuracy: "准确率",
    search: "搜索",
    sacrifice: "弃子",
    annotations: "注解",
    ruledOut: "已排除",
    internals: "分类内部信息",
    toFind: (label, difficulty) => `${label} · ${difficulty}（发现难度）`,
    reviewing: "正在审视这步棋…",
    humanUnavailable: "人类着法审视尚不可用",
    evidence: "证据",
    policyLine: (probability, rank, model, elo, wdl) => `策略概率 ${probability} · 排名 #${rank} · ${model} @ ${elo}${wdl}`,
    wdl: (win, draw, loss) => ` · WDL ${win} / ${draw} / ${loss}`,
    experimental: (score, band) => `实验分数 ${score}/100 · ${band} 策略带`,
    modelNote: (model, elo) => `${model} @ ${elo} · 模型预测，绝非客观质量`,
    explainAria: (san) => `讲解这步：${san}`,
    explain: "讲解这步",
    bands: {
      common: "常见",
      plausible: "合理",
      uncommon: "少见",
      rare: "罕见",
      "very-rare": "极为罕见",
    },
  },
};

export function CurrentMoveVerdict({ move }: { move: MoveAnalysisV2 }) {
  const language = useUiLanguage();
  const copy = COPY[language];
  const runtime = useReviewRuntime();
  const human = runtime.retro.active ? null : runtime.currentHuman;
  const showObjective = runtime.analysisMode !== "maia";
  const showHuman = runtime.analysisMode !== "stockfish";
  const label = formatMoveNotation({ fenBefore: move.fenBefore, color: move.color, san: move.san });

  return (
    <section className={"dual-verdict dual-verdict-" + runtime.analysisMode} aria-label={copy.aria(label)}>
      {showObjective && (
        <div className="move-verdict objective-verdict">
          <QualityIcon classification={move.classification} size={16} language={language} />
          <strong>{label} · {qualityLabel(move.classification, language)}</strong>
          <p className="move-verdict-sentence">{moveEvidenceSentence(move, language)}</p>
          {baselineOnlyCaveat(move, language) !== null && <p className="move-verdict-caveat">{baselineOnlyCaveat(move, language)}</p>}
          <details className="move-verdict-why review-panel-row">
            <summary>
              <Icon name="question" />
              <span className="review-row-copy"><strong>{copy.why}</strong></span>
              <span className="review-row-meta">{copy.depth(move.stockfish.depth)}</span>
              <Icon className="review-row-chevron" name="chevron-right" />
            </summary>
            <dl className="move-verdict-evidence">
              <div><dt>{copy.engine}</dt><dd>{engineChoiceLabel(move.classificationReason, language)}</dd></div>
              <div><dt>{copy.winningChances}</dt><dd>{winningChancesLabel(move.classificationReason, language)}</dd></div>
              <div><dt>{copy.accuracy}</dt><dd>{move.accuracy.toFixed(1)}</dd></div>
              <div><dt>{copy.search}</dt><dd>{verificationLabel(move, language)}</dd></div>
              {sacrificeLabel(move.classificationReason, language) !== null && (
                <div><dt>{copy.sacrifice}</dt><dd>{sacrificeLabel(move.classificationReason, language)}</dd></div>
              )}
              {move.annotations.length > 0 && (
                <div><dt>{copy.annotations}</dt><dd>{annotationsLabel(move.annotations, language)}</dd></div>
              )}
              {move.classificationReason.exclusions.length > 0 && (
                <div><dt>{copy.ruledOut}</dt><dd>{move.classificationReason.exclusions.join(", ").replaceAll("-", " ")}</dd></div>
              )}
            </dl>
            <details className="move-verdict-internals">
              <summary>{copy.internals}</summary>
              <code>{(move.classificationReason.qualityRule ?? move.classificationReason.precedenceRule)}</code>
            </details>
          </details>
        </div>
      )}
      {showHuman && (
        <details className="move-verdict human-verdict review-panel-row">
          <summary>
            <Icon name="evidence" />
            <span className="review-row-copy">
              <span>{copy.evidence}</span>
              <strong>
                {human
                  ? copy.toFind(label, HUMAN_DIFFICULTY_LABELS[language][human.findDifficulty.label])
                  : runtime.humanPositionState === "running"
                    ? copy.reviewing
                    : copy.humanUnavailable}
              </strong>
            </span>
            <Icon className="review-row-chevron" name="chevron-right" />
          </summary>
          {human ? (
            <>
              <p>
                {copy.policyLine(
                  percentage(human.playedMoveProbability),
                  human.playedMoveRank,
                  modelLabel(human.model),
                  human.targetElo,
                  human.playedMoveWdl
                    ? copy.wdl(percentage(human.playedMoveWdl.win), percentage(human.playedMoveWdl.draw), percentage(human.playedMoveWdl.loss))
                    : "",
                )}
              </p>
              <p>{copy.experimental(human.findDifficulty.score.toFixed(0), copy.bands[human.findDifficulty.evidence.probabilityBand])}</p>
            </>
          ) : (
            <p>{copy.modelNote(modelLabel(runtime.humanModel), runtime.humanTargetElo)}</p>
          )}
        </details>
      )}
      <Link
        className="explain-move-action"
        href={`/review/${runtime.gameId}/coach?ply=${move.ply}`}
        aria-label={copy.explainAria(move.san)}
      >
        {copy.explain} <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
