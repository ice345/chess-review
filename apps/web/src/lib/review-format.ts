import type { EngineScore, StockfishMoveAnalysis } from "@chess-review/shared";

export function formatEngineScore(value: StockfishMoveAnalysis | EngineScore | null): string {
  if (!value) return "—";
  const score = "score" in value ? value.score : value;
  if (score.kind === "mate") return score.mateIn > 0 ? `M${score.mateIn}` : `−M${Math.abs(score.mateIn)}`;
  const pawns = score.cp / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}

/**
 * How old a cached third-party answer is, in words.
 *
 * Position lookups age, and saying how old an answer is matters more than the
 * exact timestamp, so the same wording is used wherever such an answer is shown.
 */
export function describeFetchAge(fetchedAt: string): string {
  const elapsed = Date.now() - Date.parse(fetchedAt);
  if (!Number.isFinite(elapsed) || elapsed < 60_000) return "just now";
  const minutes = Math.round(elapsed / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
