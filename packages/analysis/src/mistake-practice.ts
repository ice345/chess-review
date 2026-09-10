import { replayUciLine } from "@chess-review/chess-core";
import type { EngineScore, MoveAnalysisV2, PlayerColor } from "@chess-review/shared";
import { scoreForColor } from "./score";
import { winPercentFromScore } from "./win-percent";

/** Practice acceptance, not a replacement for objective move classification. */
export const PRACTICE_MAX_WIN_PERCENT_LOSS = 2;

export function practiceMoves<T extends Pick<MoveAnalysisV2, "color" | "quality" | "annotations" | "stockfish" | "fenBefore" | "uci">>(moves: readonly T[], color: PlayerColor, includeInaccuracies = false): T[] {
  return moves.filter((move) => {
    if (move.color !== color || !(["mistake", "blunder"].includes(move.quality)
      || (includeInaccuracies && move.quality === "inaccuracy")
      || move.annotations.includes("missed_win") || move.annotations.includes("missed_mate"))) return false;
    const best = move.stockfish.bestMove;
    if (move.stockfish.fen !== move.fenBefore || !best || best === move.uci) return false;
    try { return replayUciLine(move.fenBefore, [best]).length === 1; } catch { return false; }
  });
}

export function judgePracticeScore(best: EngineScore, candidate: EngineScore, color: PlayerColor): { accepted: boolean; loss: number; reason: "near-best" | "lost-mate" | "allows-mate" | "too-costly" } {
  const root = scoreForColor(best, color), answer = scoreForColor(candidate, color);
  const loss = Math.max(0, winPercentFromScore(root) - winPercentFromScore(answer));
  // Saturated WinPercent is insufficient to distinguish a forced mate from
  // a large cp advantage. Preserve the actual mate outcome explicitly.
  if (root.kind === "mate" && root.mateIn > 0 && !(answer.kind === "mate" && answer.mateIn > 0)) return { accepted: false, loss, reason: "lost-mate" };
  if (answer.kind === "mate" && answer.mateIn < 0 && !(root.kind === "mate" && root.mateIn < 0)) return { accepted: false, loss, reason: "allows-mate" };
  const accepted = loss <= PRACTICE_MAX_WIN_PERCENT_LOSS;
  return { accepted, loss, reason: accepted ? "near-best" : "too-costly" };
}
