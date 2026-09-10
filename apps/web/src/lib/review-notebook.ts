import { parsePgn, replayUciLine, type NormalizedGame } from "@chess-review/chess-core";
import type { ReviewRecord } from "./review-library";

export const MAX_NOTEBOOK_ENTRIES = 200;
export const MAX_NOTEBOOK_LINE_PLIES = 64;
export const MAX_NOTE_LENGTH = 5000;
export const MAX_NOTE_TITLE_LENGTH = 100;

/** Personal annotations, never an engine result or a modification of the source PGN. */
export interface NotebookPosition { rootPly: number; line: string[] }
export interface NotebookText { title: string; note: string; bookmarked: boolean }
export interface NotebookEntry extends NotebookPosition, NotebookText {
  id: string;
  revision: string;
  createdAt: string;
  updatedAt: string;
}
export interface ReviewNotebookV1 {
  version: 1;
  id: string;
  entries: NotebookEntry[];
}

export function notebookPositionKey(position: NotebookPosition): string {
  return `${position.rootPly}:${position.line.join(" ")}`;
}
export function emptyNotebook(id: string): ReviewNotebookV1 { return { version: 1, id, entries: [] }; }

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid notebook record.");
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number): string {
  if (typeof value !== "string" || value.length > limit) throw new Error(`Notebook text must contain at most ${limit} characters.`);
  return value;
}
function date(value: unknown): string {
  const result = text(value, 64);
  if (!Number.isFinite(Date.parse(result))) throw new Error("Invalid notebook timestamp.");
  return result;
}

export function notebookSource(record: ReviewRecord): NormalizedGame | null {
  return record.kind === "pgn" ? parsePgn(record.input) : null;
}

export function notebookRootFen(record: ReviewRecord, rootPly: number, game = notebookSource(record)): string {
  if (!Number.isInteger(rootPly) || rootPly < 0 || rootPly > (game?.plies.length ?? 0)) throw new Error("This notebook position is outside its source game.");
  return rootPly === 0 ? record.initialFen : game!.plies[rootPly - 1]!.fenAfter;
}

export function validateNotebookPosition(value: unknown, record: ReviewRecord, game = notebookSource(record)): NotebookPosition {
  const raw = object(value);
  if (typeof raw.rootPly !== "number") throw new Error("Invalid notebook root ply.");
  const fen = notebookRootFen(record, raw.rootPly, game);
  if (!Array.isArray(raw.line) || raw.line.length > MAX_NOTEBOOK_LINE_PLIES || raw.line.some((uci) => typeof uci !== "string" || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci))) throw new Error(`Notebook lines support at most ${MAX_NOTEBOOK_LINE_PLIES} legal plies.`);
  const line = raw.line as string[];
  // Reconstruct every edge using the same rules as the board. Imported FEN/SAN,
  // scores, classifications and LLM text cannot supply chess facts here.
  replayUciLine(fen, line);
  return { rootPly: raw.rootPly, line: [...line] };
}

export function validateNotebookText(value: unknown): NotebookText {
  const raw = object(value);
  if (typeof raw.bookmarked !== "boolean") throw new Error("Invalid notebook bookmark.");
  return { title: text(raw.title, MAX_NOTE_TITLE_LENGTH), note: text(raw.note, MAX_NOTE_LENGTH), bookmarked: raw.bookmarked };
}

export function validateNotebook(value: unknown, record: ReviewRecord, game = notebookSource(record)): ReviewNotebookV1 {
  const raw = object(value);
  if (raw.version !== 1 || raw.id !== record.id || !Array.isArray(raw.entries) || raw.entries.length > MAX_NOTEBOOK_ENTRIES) throw new Error("Invalid notebook version, source or entry count.");
  const entries = raw.entries.map((value): NotebookEntry => {
    const entry = object(value), position = validateNotebookPosition(entry, record, game);
    const id = notebookPositionKey(position), revision = text(entry.revision, 64);
    if (entry.id !== id || !/^[a-zA-Z0-9-]{1,64}$/.test(revision)) throw new Error("Invalid notebook entry identity.");
    return { ...position, ...validateNotebookText(entry), id, revision, createdAt: date(entry.createdAt), updatedAt: date(entry.updatedAt) };
  });
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error("Duplicate notebook position.");
  return { version: 1, id: record.id, entries };
}

export function notebookPositionLabel(record: ReviewRecord, position: NotebookPosition, game = notebookSource(record)): string {
  const root = notebookRootFen(record, position.rootPly, game);
  if (position.line.length) {
    const moves = replayUciLine(root, position.line);
    return moves.map((move) => {
      const fields = move.fenBefore.split(" ");
      return `${fields[5]}${fields[1] === "w" ? "." : "…"} ${move.san}`;
    }).join(" ");
  }
  const move = game?.plies[position.rootPly - 1];
  return move ? `After ${move.moveNumber}${move.color === "white" ? "." : "…"} ${move.san}` : record.kind === "fen" ? "Imported position" : "Starting position";
}
