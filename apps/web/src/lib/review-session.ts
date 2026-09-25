import type { CriticalMoment, GameAnalysisV2, UiLanguage } from "@chess-review/shared";

type CompletionCopy = {
  noneCrossed: string;
  onlyMoment: string;
  allMoments: (total: number) => string;
  someMoments: (seen: number, total: number) => string;
  noSwing: string;
  stillUnseen: (remaining: number) => string;
  viewedIsNotSolved: string;
};

/* Counting a view is not counting a solve, and the wording has to keep saying so in
   both languages: this line is the one place the product admits that. */
const COMPLETION_COPY: Record<UiLanguage, CompletionCopy> = {
  en: {
    noneCrossed: "No key moment crossed the thresholds",
    onlyMoment: "The only key moment was viewed",
    allMoments: (total) => `All ${total} key moments viewed`,
    someMoments: (seen, total) => `${seen} of ${total} key ${total === 1 ? "moment" : "moments"} viewed`,
    noSwing: "This game had no swing large enough for a guided moment.",
    stillUnseen: (remaining) => `${remaining} ${remaining === 1 ? "moment is" : "moments are"} still unseen; they stay available in Moves and Study.`,
    viewedIsNotSolved: "Viewing a position is not the same as solving it; practice results are counted separately.",
  },
  "zh-CN": {
    noneCrossed: "没有关键节点越过阈值",
    onlyMoment: "唯一的关键节点已看过",
    allMoments: (total) => `${total} 个关键节点全部看过`,
    someMoments: (seen, total) => `${total} 个关键节点中看过 ${seen} 个`,
    noSwing: "这盘棋的波动没有大到产生引导节点。",
    stillUnseen: (remaining) => `还有 ${remaining} 个关键节点没看；它们仍可在「着法」和「学习」中找到。`,
    viewedIsNotSolved: "看过一个局面不等于解出它；训练成绩单独计算。",
  },
};

/**
 * What one review session actually did.
 *
 * Viewing a key moment and solving it are different facts, so they are counted
 * separately. Landing on a position marks it seen; only a practice outcome can
 * make it attempted. The guided review used to summarise itself with the number
 * of key moments in the analysis, which reported "5 key moments reviewed" after
 * "Finish review early" on the very first position.
 *
 * `seen` keeps plies rather than a count so a re-analysis can intersect the
 * session with the moments that still exist. Progress from an older analysis is
 * never granted to a moment the new analysis placed somewhere else.
 */
export interface ReviewSessionProgress {
  /** Key-moment plies that have been on the board at least once in this session. */
  seen: readonly number[];
  attempted: number;
  solvedUnassisted: number;
  hinted: number;
  revealed: number;
  skipped: number;
  /** Attempted positions whose answer free analysis had already shown. */
  afterExposure: number;
}

export interface ReviewSessionCounts {
  /** Key moments in the analysis under review right now. */
  total: number;
  seen: number;
  remaining: number;
  /** Every current key moment has been on the board at least once. */
  browsedEverything: boolean;
  attempted: number;
  solvedUnassisted: number;
  hinted: number;
  revealed: number;
  skipped: number;
  afterExposure: number;
}

export function emptyReviewSessionProgress(): ReviewSessionProgress {
  return { seen: [], attempted: 0, solvedUnassisted: 0, hinted: 0, revealed: 0, skipped: 0, afterExposure: 0 };
}

/** Adds a ply to the seen set. Returns the same object when it was already seen. */
export function markMomentSeen(progress: ReviewSessionProgress, ply: number): ReviewSessionProgress {
  return progress.seen.includes(ply) ? progress : { ...progress, seen: [...progress.seen, ply] };
}

/**
 * Counts the session against the moments of the current analysis.
 *
 * A seen ply with no matching moment counts for nothing: re-analysis can drop or
 * move a moment, and the review must not claim credit for a position it no
 * longer guides to.
 */
export function reviewSessionCounts(
  progress: ReviewSessionProgress,
  moments: readonly CriticalMoment[],
): ReviewSessionCounts {
  const plies = [...new Set(moments.map((moment) => moment.ply))];
  const seen = plies.filter((ply) => progress.seen.includes(ply)).length;
  return {
    total: plies.length,
    seen,
    remaining: plies.length - seen,
    browsedEverything: plies.length > 0 && seen === plies.length,
    attempted: progress.attempted,
    solvedUnassisted: progress.solvedUnassisted,
    hinted: progress.hinted,
    revealed: progress.revealed,
    skipped: progress.skipped,
    afterExposure: progress.afterExposure,
  };
}

/**
 * The completion headline states what this session did, never what the analysis
 * contains. Browsing every moment is reported as browsing, because no practice
 * result is implied by it.
 */
export function reviewCompletionHeadline(counts: ReviewSessionCounts, language: UiLanguage): string {
  const copy = COMPLETION_COPY[language];
  if (counts.total === 0) return copy.noneCrossed;
  if (counts.browsedEverything) {
    return counts.total === 1 ? copy.onlyMoment : copy.allMoments(counts.total);
  }
  return copy.someMoments(counts.seen, counts.total);
}

/** A second line that keeps the remaining work visible, or explains the state. */
export function reviewCompletionDetail(counts: ReviewSessionCounts, language: UiLanguage): string {
  const copy = COMPLETION_COPY[language];
  if (counts.total === 0) return copy.noSwing;
  if (counts.remaining > 0) return copy.stillUnseen(counts.remaining);
  return copy.viewedIsNotSolved;
}

/**
 * Where the session is stored.
 *
 * The identity includes the objective record it was made against, so progress
 * from an earlier analysis — a different engine depth, a different algorithm
 * version, a different move count — is never restored onto a new result. The seen
 * plies are intersected with the moments that still exist when the session is
 * read, which covers the case where only the moment set changed.
 */
export function reviewSessionKey(gameId: string, analysis: Pick<GameAnalysisV2, "algorithmVersion" | "engine" | "moves" | "createdAt">): string {
  const { engine } = analysis;
  return [
    "review-session",
    gameId,
    analysis.algorithmVersion,
    engine.stockfishVersion,
    engine.depth,
    engine.classificationMultiPv,
    analysis.moves.length,
    analysis.createdAt,
  ].join("|");
}

export function serializeReviewSession(progress: ReviewSessionProgress): string {
  return JSON.stringify({
    seen: progress.seen.filter((ply) => Number.isInteger(ply) && ply > 0),
    attempted: progress.attempted,
    solvedUnassisted: progress.solvedUnassisted,
    hinted: progress.hinted,
    revealed: progress.revealed,
    skipped: progress.skipped,
    afterExposure: progress.afterExposure,
  });
}

/** Returns null for anything that is not a session this build can trust. */
export function deserializeReviewSession(raw: string | null): ReviewSessionProgress | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const value = parsed as Record<string, unknown>;
  if (!Array.isArray(value.seen)) return null;
  const count = (key: string) => (typeof value[key] === "number" && Number.isFinite(value[key]) && (value[key] as number) >= 0 ? value[key] as number : 0);
  return {
    seen: value.seen.filter((ply): ply is number => typeof ply === "number" && Number.isInteger(ply) && ply > 0),
    attempted: count("attempted"),
    solvedUnassisted: count("solvedUnassisted"),
    hinted: count("hinted"),
    revealed: count("revealed"),
    skipped: count("skipped"),
    afterExposure: count("afterExposure"),
  };
}
