import type { CSSProperties } from "react";
import type { LegalBoardDestination } from "@chess-review/chess-core";

const SELECTED_SQUARE: CSSProperties = {
  boxShadow: "inset 0 0 0 4px rgba(157, 48, 90, .96)",
  backgroundImage: "linear-gradient(rgba(255, 239, 126, .44), rgba(255, 239, 126, .44))",
};

const QUIET_DESTINATION: CSSProperties = {
  backgroundImage: "radial-gradient(circle, rgba(157, 48, 90, .96) 0 12%, rgba(255, 253, 248, .92) 13% 19%, transparent 20%)",
};

const CAPTURE_DESTINATION: CSSProperties = {
  backgroundImage: "radial-gradient(circle, transparent 0 57%, rgba(255, 253, 248, .9) 58% 64%, rgba(157, 48, 90, .94) 65% 78%, transparent 79%)",
};

export function boardMoveHintStyles(
  selectedSquare: string | null,
  destinations: readonly LegalBoardDestination[],
): Record<string, CSSProperties> {
  if (!selectedSquare) return {};
  return {
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
