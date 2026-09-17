import type { PlayerColor } from "./schema";

/**
 * PGN-style move number from the position a move is played from.
 * `ply / 2` is wrong when the game starts from a non-1 FEN.
 */
export function formatMoveNumber(fenBefore: string, color: PlayerColor): string {
  const raw = Number(fenBefore.split(" ")[5] ?? "1");
  const moveNumber = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
  return `${moveNumber}${color === "white" ? "." : "…"}`;
}

export function formatMoveNotation(input: { fenBefore: string; color: PlayerColor; san: string }): string {
  return `${formatMoveNumber(input.fenBefore, input.color)} ${input.san}`;
}