import type { CSSProperties } from "react";
import type { LegalBoardDestination } from "@chess-review/chess-core";

/* Board interaction must stay more visible than the theme. The origin uses the
   dusty-rose selection token with a restrained brass wash; destinations keep
   their own rose+paper rings. Colors are token-owned (tokens.css) so board
   feedback follows the Windowlight palette instead of drifting. */

const SELECTED_SQUARE: CSSProperties = {
  boxShadow: "inset 0 0 0 4px var(--board-selection)",
  backgroundImage: "linear-gradient(var(--board-selection-wash), var(--board-selection-wash))",
};

const QUIET_DESTINATION: CSSProperties = {
  backgroundImage:
    "radial-gradient(circle, color-mix(in srgb, var(--accent-rose) 94%, transparent) 0 12%, color-mix(in srgb, var(--surface-paper) 90%, transparent) 13% 19%, transparent 20%)",
};

const CAPTURE_DESTINATION: CSSProperties = {
  backgroundImage:
    "radial-gradient(circle, transparent 0 56%, color-mix(in srgb, var(--surface-paper) 90%, transparent) 57% 63%, color-mix(in srgb, var(--accent-rose) 92%, transparent) 64% 78%, transparent 79%)",
};

/* A practice hint marks the piece to move. Brass keeps it distinct from the
   rose selection, because both can be on the board at the same time. */
const HINT_SQUARE: CSSProperties = {
  boxShadow: "inset 0 0 0 4px var(--accent-brass)",
};

export function boardMoveHintStyles(
  selectedSquare: string | null,
  destinations: readonly LegalBoardDestination[],
  hintSquare: string | null = null,
): Record<string, CSSProperties> {
  const hints: Record<string, CSSProperties> = hintSquare ? { [hintSquare]: HINT_SQUARE } : {};
  if (!selectedSquare) return hints;
  return {
    ...hints,
    [selectedSquare]: SELECTED_SQUARE,
    ...Object.fromEntries(destinations.map((move) => [
      move.to,
      move.isCapture ? CAPTURE_DESTINATION : QUIET_DESTINATION,
    ])),
  };
}

export function pieceMatchesTurn(pieceType: string | undefined, fen: string): boolean {
  if (!pieceType) return false;
  const turn = fen.split(" ")[1];
  return pieceType.toLowerCase().startsWith(turn === "b" ? "b" : "w");
}
