import { Chess } from "chess.js";
import { fenToEpd, type NormalizedGame } from "@chess-review/chess-core";
import type { OpeningInfo } from "@chess-review/shared";
import generatedOpenings from "./generated/openings.json";

export interface OpeningLine {
  eco: string;
  name: string;
  pgn: string;
}

interface IndexedOpening {
  eco: string;
  name: string;
  variation?: string;
}

export type OpeningIndex = ReadonlyMap<string, IndexedOpening>;

function splitName(fullName: string): { name: string; variation?: string } {
  const [name, ...variation] = fullName.split(": ");
  if (!name) return { name: fullName };
  return variation.length === 0 ? { name } : { name, variation: variation.join(": ") };
}

export function createOpeningIndex(lines: OpeningLine[]): OpeningIndex {
  const index = new Map<string, IndexedOpening>();
  for (const line of lines) {
    const board = new Chess();
    board.loadPgn(line.pgn, { strict: false });
    index.set(fenToEpd(board.fen()), { eco: line.eco, ...splitName(line.name) });
  }
  return index;
}

/** Classifies by position, walking backward from the deepest known position. */
export function recognizeOpening(game: NormalizedGame, index: OpeningIndex = LICHESS_OPENING_INDEX): OpeningInfo | undefined {
  for (let listIndex = game.plies.length - 1; listIndex >= 0; listIndex -= 1) {
    const ply = game.plies[listIndex];
    if (!ply) continue;
    const match = index.get(fenToEpd(ply.fenAfter));
    if (match) {
      return {
        eco: match.eco,
        name: match.name,
        ...(match.variation === undefined ? {} : { variation: match.variation }),
        matchedPly: ply.ply,
        theoryUntilPly: ply.ply,
      };
    }
  }
  return undefined;
}

/** Small boot dataset; the full lichess TSV build is a Phase 1 data task. */
export const BUILTIN_OPENING_LINES: OpeningLine[] = [
  { eco: "B00", name: "King's Pawn Game", pgn: "1. e4" },
  { eco: "B20", name: "Sicilian Defense", pgn: "1. e4 c5" },
  { eco: "B90", name: "Sicilian Defense: Najdorf Variation", pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6" },
  { eco: "C20", name: "King's Pawn Game", pgn: "1. e4 e5" },
  { eco: "C50", name: "Italian Game", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4" },
  { eco: "C60", name: "Ruy Lopez", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5" },
  { eco: "D00", name: "Queen's Pawn Game", pgn: "1. d4 d5" },
  { eco: "D30", name: "Queen's Gambit Declined", pgn: "1. d4 d5 2. c4 e6" },
  { eco: "D37", name: "Queen's Gambit Declined: Three Knights Variation", pgn: "1. d4 d5 2. c4 e6 3. Nc3 Nf6" },
  { eco: "E60", name: "King's Indian Defense", pgn: "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7" },
];

export const BUILTIN_OPENING_INDEX = createOpeningIndex(BUILTIN_OPENING_LINES);

const generatedIndex = new Map<string, IndexedOpening>();
for (const [epd, eco, fullName] of generatedOpenings as Array<[string, string, string]>) {
  generatedIndex.set(epd, { eco, ...splitName(fullName) });
}

/** Full build-time index generated from lichess-org/chess-openings. */
export const LICHESS_OPENING_INDEX: OpeningIndex = generatedIndex;
