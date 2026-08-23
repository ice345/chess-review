import type { EngineScore, StockfishMoveAnalysis } from "@chess-review/shared";

export function formatEngineScore(value: StockfishMoveAnalysis | EngineScore | null): string {
  if (!value) return "—";
  const score = "score" in value ? value.score : value;
  if (score.kind === "mate") return score.mateIn > 0 ? `M${score.mateIn}` : `−M${Math.abs(score.mateIn)}`;
  const pawns = score.cp / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}
