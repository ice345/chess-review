import { alignPgnAnnotations, readPgnAnnotations, type GameAnalysisV2, type PlyPgnAnnotations } from "@chess-review/shared";

export interface ImportedAnnotations {
  gameComment?: string;
  /** One entry per mainline ply, always the same length as `analysis.moves`. */
  plies: PlyPgnAnnotations[];
}

/**
 * Reads the comments, NAGs and variations the imported PGN carried, aligned to
 * the analysed mainline. The analysis already stores the original PGN text, so
 * this derives everything from canonical data instead of keeping a second copy
 * of the author's notes. Returns null for a game that was never a PGN, or when
 * the reading cannot be aligned to the analysed move count.
 *
 * These annotations are display-only: they never enter classification, Accuracy
 * or the coach facts, so "why this label" stays answerable from canonical
 * evidence alone.
 */
export function importedAnnotations(analysis: GameAnalysisV2): ImportedAnnotations | null {
  if (analysis.game.pgn === undefined) return null;
  return alignPgnAnnotations(readPgnAnnotations(analysis.game.pgn), analysis.moves.length);
}

/** Remaining clock / elapsed-move-time commands. Not `[%eval]`: that is author data. */
const CLOCK_COMMAND = /\[%(?:clk|emt)\b[^\]]*]/gi;

/**
 * Author-facing text of an imported PGN comment or variation. Clock commands
 * are telemetry and do not belong in the move list; the original PGN and
 * annotated export keep them. `[%eval …]` is left intact.
 */
export function displayPgnComment(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  const cleaned = text
    .replace(CLOCK_COMMAND, " ")
    .replace(/\{\s*\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length === 0 ? undefined : cleaned;
}


