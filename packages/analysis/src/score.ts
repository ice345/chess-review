import type { EngineScore, EngineScorePerspective, PlayerColor } from "@chess-review/shared";

export function invertScore(score: EngineScore): EngineScore {
  return score.kind === "cp"
    ? { kind: "cp", cp: -score.cp }
    : { kind: "mate", mateIn: -score.mateIn };
}

export function normalizeToWhitePov(
  score: EngineScore,
  perspective: EngineScorePerspective,
  sideToMove: PlayerColor,
): EngineScore {
  if (perspective === "white" || sideToMove === "white") return score;
  return invertScore(score);
}

export function scoreForColor(score: EngineScore, color: PlayerColor): EngineScore {
  return color === "white" ? score : invertScore(score);
}

export function centipawnsForColor(score: EngineScore, color: PlayerColor): number | null {
  if (score.kind !== "cp") return null;
  return color === "white" ? score.cp : -score.cp;
}

export function hasForcedMateFor(score: EngineScore, color: PlayerColor): boolean {
  if (score.kind !== "mate" || score.mateIn === 0) return false;
  return color === "white" ? score.mateIn > 0 : score.mateIn < 0;
}
