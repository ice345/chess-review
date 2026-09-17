/**
 * Bounds for the user-adjustable desktop review board.
 *
 * These bound the *control*, not the layout. The review workspace still clamps
 * the board against the viewport in CSS (`--review-board-max`), so a persisted
 * preference can never cause horizontal overflow on a smaller screen, and narrow
 * viewports ignore it entirely. The control therefore reports the size the layout
 * actually granted — measured from the rendered board — instead of the stored
 * intent, so it never claims a size the layout refused.
 */
export const BOARD_SIZE_MIN = 320;
// Kept above the automatic default's ceiling (`--review-board-default` caps at
// 760px) so a visitor on a large display still has headroom to grow the board
// beyond what the responsive default chose. The layout clamp still decides what
// the viewport can actually afford.
export const BOARD_SIZE_MAX = 800;
export const BOARD_SIZE_STEP = 20;

/**
 * Clamps and step-aligns a stored or requested board size. Anything that is not
 * a finite number means "automatic", which is the responsive default.
 */
export function normalizeBoardSizePreference(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const stepped = Math.round(value / BOARD_SIZE_STEP) * BOARD_SIZE_STEP;
  return Math.min(BOARD_SIZE_MAX, Math.max(BOARD_SIZE_MIN, stepped));
}
