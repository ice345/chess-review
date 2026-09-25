import type { ClassificationReason, MoveAnalysisV2, MoveAnnotation, UiLanguage } from "@chess-review/shared";
import { annotationLabel } from "@chess-review/ui";

/**
 * Plain-language sentences for a move's canonical evidence.
 *
 * These are mappings from recorded facts, never inferences: a Blunder proves a
 * large loss, not which tactic was missed, so the sentence that states the loss
 * also states that this build does not name a cause. Nothing here reads a score
 * and invents a motive.
 *
 * Every function takes the interface language. English is the source text and is
 * reproduced character for character; the translations carry the same refusal to
 * name a cause the facts do not record.
 */

type Evidence = Pick<MoveAnalysisV2, "classification" | "quality" | "annotations"> & {
  classificationReason: Pick<
    ClassificationReason,
    "winPercentLoss" | "winPercentBefore" | "winPercentAfter" | "engineRank" | "secondBestGapWinPercent" | "isForced" | "verification" | "sacrifice" | "exclusions"
  >;
};

const COSTLY_ANNOTATIONS: readonly MoveAnnotation[] = ["missed_win", "missed_mate"];

type EvidenceCopy = {
  missedMate: string;
  missedWin: string;
  brilliant: string;
  criticalOnly: string;
  criticalWithGap: (gap: string) => string;
  sacrifice: string;
  book: string;
  forced: string;
  holds: string;
  cost: (loss: string) => string;
  costWithCause: (loss: string) => string;
  baselineCaveat: (search: string) => string;
  baselineSearch: string;
  baselineDepthSearch: (depth: number) => string;
  engineFirstChoice: string;
  engineOutsideCandidates: string;
  engineCandidate: (rank: number) => string;
  searchBaseline: (depth: number) => string;
  searchVerified: (depth: number, multiPv: number) => string;
  searchNotVerified: (depth: number) => string;
  winningChances: (before: string, after: string, lost: string) => string;
  genuineSacrifice: (material: number, see: number, compensation: number) => string;
  offeredSacrifice: (see: number) => string;
};

const COPY: Record<UiLanguage, EvidenceCopy> = {
  en: {
    missedMate: "A forced mate was available here and this move let it go.",
    missedWin: "A winning continuation was available here and this move let it go.",
    brilliant: "This investing move is the engine's first choice: the material it gives survives the opponent's best answer.",
    criticalOnly: "This was the only reasonable choice; the alternatives were substantially worse.",
    criticalWithGap: (gap) => `This was the only reasonable choice: the next-best move was ${gap} win-percentage points worse.`,
    sacrifice: "It gives material away on purpose, and the engine's reply shows the compensation.",
    book: "Known opening theory rather than an independent decision.",
    forced: "The position left nothing to choose here; this move was forced.",
    holds: "It holds the engine's evaluation: the winning chances do not move.",
    cost: (loss) => `It gave up ${loss} win-percentage points of winning chances.`,
    costWithCause: (loss) => `It gave up ${loss} win-percentage points of winning chances. The analysis records the cost, not which idea was missed.`,
    baselineCaveat: (search) => `This label comes from the ${search} and this move was not re-searched at the verification depth, so it can be depth-sensitive.`,
    baselineSearch: "baseline search",
    baselineDepthSearch: (depth) => `baseline depth-${depth} search`,
    engineFirstChoice: "The engine's first choice",
    engineOutsideCandidates: "Outside the engine's top candidates; scored with a restricted search of this move",
    engineCandidate: (rank) => `Engine candidate #${rank}`,
    searchBaseline: (depth) => `Baseline search at depth ${depth}`,
    searchVerified: (depth, multiPv) => `Re-searched at depth ${depth} with MultiPV ${multiPv}`,
    searchNotVerified: (depth) => `Baseline search at depth ${depth}; this move was not re-searched`,
    winningChances: (before, after, lost) => `${before}% → ${after}% for the mover (${lost} lost)`,
    genuineSacrifice: (material, see, compensation) => `Genuine investment of ${material} centipawns; exchange value ${see}; compensation ${compensation}`,
    offeredSacrifice: (see) => `Material was offered but the exchange value ${see} shows it comes straight back`,
  },
  "zh-CN": {
    missedMate: "这里本来有强制杀棋，这一步放走了它。",
    missedWin: "这里本来有取胜的走法，这一步放走了它。",
    brilliant: "这步投入是引擎的首选：它送出的子力能挡住对手的最佳应对。",
    criticalOnly: "这里是唯一合理的选择，其他着法都明显更差。",
    criticalWithGap: (gap) => `这里是唯一合理的选择：次优着法低了 ${gap} 个胜率百分点。`,
    sacrifice: "它主动送子，而引擎的应手展示了补偿。",
    book: "这是已知的开局定式，不是独立的判断。",
    forced: "这个局面没有可选的余地，这一步是被迫的。",
    holds: "它守住了引擎的评分：胜率没有变化。",
    cost: (loss) => `它让出了 ${loss} 个胜率百分点。`,
    costWithCause: (loss) => `它让出了 ${loss} 个胜率百分点。分析记录了代价，没有记录错过了什么想法。`,
    baselineCaveat: (search) => `这个标签来自${search}，这一步没有在复核深度上重新搜索，因此可能对深度敏感。`,
    baselineSearch: "基线搜索",
    baselineDepthSearch: (depth) => `深度 ${depth} 的基线搜索`,
    engineFirstChoice: "引擎首选",
    engineOutsideCandidates: "不在引擎的前几个候选之内；用受限搜索给这一步评分",
    engineCandidate: (rank) => `引擎候选中第 ${rank} 位`,
    searchBaseline: (depth) => `深度 ${depth} 的基线搜索`,
    searchVerified: (depth, multiPv) => `在深度 ${depth}、MultiPV ${multiPv} 重新搜索`,
    searchNotVerified: (depth) => `深度 ${depth} 的基线搜索；这一步没有重新搜索`,
    winningChances: (before, after, lost) => `走子方 ${before}% → ${after}%（损失 ${lost}）`,
    genuineSacrifice: (material, see, compensation) => `真实的投入：送出 ${material} 厘兵；交换价值 ${see}；补偿 ${compensation}`,
    offeredSacrifice: (see) => `送出了子力，但交换价值 ${see} 说明它马上就会回来`,
  },
};

/** The one sentence that explains this move's label. */
export function moveEvidenceSentence(move: Evidence, language: UiLanguage): string {
  const copy = COPY[language];
  const annotations = move.annotations;
  const loss = move.classificationReason.winPercentLoss;
  if (annotations.includes("missed_mate")) return copy.missedMate;
  if (annotations.includes("missed_win")) return copy.missedWin;
  if (annotations.includes("brilliant")) return copy.brilliant;
  if (annotations.includes("critical")) {
    const gap = move.classificationReason.secondBestGapWinPercent;
    return gap === undefined ? copy.criticalOnly : copy.criticalWithGap(gap.toFixed(1));
  }
  if (annotations.includes("sacrifice")) return copy.sacrifice;
  if (annotations.includes("book")) return copy.book;
  if (annotations.includes("forced") || move.classificationReason.isForced) return copy.forced;
  if (loss <= 0.5) return copy.holds;

  const costly = ["inaccuracy", "mistake", "blunder"].includes(move.quality) || annotations.some((annotation) => COSTLY_ANNOTATIONS.includes(annotation));
  // The cost is measured; the cause is not. Saying so is the honest version of a
  // tactical explanation this build cannot produce.
  return costly ? copy.costWithCause(loss.toFixed(1)) : copy.cost(loss.toFixed(1));
}

/**
 * A caveat for a strong label that rests on the baseline search alone.
 *
 * The classification pipeline re-searches a bounded selection of moves at a higher
 * depth. A move outside that selection keeps its depth-10 classification, and in a
 * sharp position that depth can rank the objectively best move third. Saying so is
 * the honest version of a confident label: the number is real, the search behind it
 * is finite. Calibrated by the C01 investigation.
 */
export function baselineOnlyCaveat(move: Evidence, language: UiLanguage): string | null {
  const consequential = ["mistake", "blunder"].includes(move.quality)
    || move.annotations.some((annotation) => ["brilliant", "critical", "missed_win", "missed_mate"].includes(annotation));
  if (!consequential) return null;
  const verification = move.classificationReason.verification;
  if (verification?.status === "verified") return null;
  // The depth is only named when the evidence recorded one. Building the phrase
  // first keeps the sentence readable either way: substituting into a fixed
  // template left "baseline depth- search" behind when the depth was absent.
  const copy = COPY[language];
  const searchPhrase = verification?.depth === undefined ? copy.baselineSearch : copy.baselineDepthSearch(verification.depth);
  return copy.baselineCaveat(searchPhrase);
}

/** How the played move compared with the engine's own ordering. */
export function engineChoiceLabel(reason: Pick<ClassificationReason, "engineRank">, language: UiLanguage): string {
  const copy = COPY[language];
  if (reason.engineRank === 1) return copy.engineFirstChoice;
  if (reason.engineRank === undefined) return copy.engineOutsideCandidates;
  return copy.engineCandidate(reason.engineRank);
}

/** What the search behind this move actually did. */
export function verificationLabel(move: { stockfish: { depth: number }; classificationReason: Pick<ClassificationReason, "verification"> }, language: UiLanguage): string {
  const copy = COPY[language];
  const verification = move.classificationReason.verification;
  if (verification === undefined) return copy.searchBaseline(move.stockfish.depth);
  return verification.status === "verified"
    ? copy.searchVerified(verification.depth, verification.multiPv)
    : copy.searchNotVerified(verification.depth);
}

/** The winning chances the move was judged on, as the classification recorded them. */
export function winningChancesLabel(reason: Pick<ClassificationReason, "winPercentBefore" | "winPercentAfter" | "winPercentLoss">, language: UiLanguage): string {
  return COPY[language].winningChances(
    reason.winPercentBefore.toFixed(1),
    reason.winPercentAfter.toFixed(1),
    reason.winPercentLoss.toFixed(1),
  );
}

/** Sacrifice evidence, only when the detector actually recorded one. */
export function sacrificeLabel(reason: Pick<ClassificationReason, "sacrifice">, language: UiLanguage): string | null {
  const sacrifice = reason.sacrifice;
  if (sacrifice === undefined) return null;
  const copy = COPY[language];
  return sacrifice.genuine
    ? copy.genuineSacrifice(sacrifice.sacrificedMaterial, sacrifice.see, sacrifice.compensationCp)
    : copy.offeredSacrifice(sacrifice.see);
}

/** The annotation names as they are shown elsewhere in the product. */
export function annotationsLabel(annotations: readonly MoveAnnotation[], language: UiLanguage): string {
  return annotations.map((annotation) => annotationLabel(annotation, language)).join(", ");
}
