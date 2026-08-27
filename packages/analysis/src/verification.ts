import type { GameAnalysisV2, ObjectiveVerificationReason } from "@chess-review/shared";
import { winPercentFromScore } from "./win-percent";

export interface ObjectiveVerificationRequest {
  ply: number;
  reasons: ObjectiveVerificationReason[];
}

export interface ObjectiveVerificationPlan {
  depth: number;
  multiPv: number;
  requests: ObjectiveVerificationRequest[];
}

const REASON_PRIORITY: Record<ObjectiveVerificationReason, number> = {
  "special-annotation": 0,
  "played-score-inconsistency": 1,
  "quality-threshold-boundary": 2,
  "unstable-candidate-order": 3,
  "low-depth-evidence": 4,
};

function candidateGap(move: GameAnalysisV2["moves"][number]): number | undefined {
  const first = move.stockfish.lines[0];
  const second = move.stockfish.lines[1];
  if (!first || !second) return undefined;
  return Math.abs(winPercentFromScore(first.score) - winPercentFromScore(second.score));
}

/**
 * Selects a bounded set of high-impact or unstable baseline moves for a
 * deeper/wider root plus resulting-position search. It never changes the
 * quality formula; it only requests stronger evidence for a final rebuild.
 */
export function planObjectiveVerification(analysis: GameAnalysisV2): ObjectiveVerificationPlan {
  const candidates = analysis.moves.flatMap((move) => {
    const reasons = new Set<ObjectiveVerificationReason>(move.classificationReason.verification?.reasons ?? []);
    const gap = candidateGap(move);
    if (move.stockfish.depth < 15 && gap !== undefined && gap <= 1 && move.classificationReason.engineRank !== undefined) {
      reasons.add("unstable-candidate-order");
      reasons.add("low-depth-evidence");
    }
    return reasons.size === 0 ? [] : [{ ply: move.ply, reasons: [...reasons] }];
  });
  const limit = Math.min(12, Math.max(4, Math.ceil(analysis.moves.length / 10)));
  const requests = candidates.sort((left, right) => {
    const leftPriority = Math.min(...left.reasons.map((reason) => REASON_PRIORITY[reason]));
    const rightPriority = Math.min(...right.reasons.map((reason) => REASON_PRIORITY[reason]));
    return leftPriority - rightPriority || left.ply - right.ply;
  }).slice(0, limit);
  return {
    depth: Math.min(20, Math.max(15, analysis.engine.depth + 3)),
    multiPv: 5,
    requests,
  };
}
