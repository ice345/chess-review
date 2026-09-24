import { parsePgn } from "@chess-review/chess-core";
import type { ExternalGameReference, SyncedGame, SyncedGamePlayer, TrainingQueueItem, TrainingQueueItemV3 } from "@chess-review/shared";
import type { AppSettings } from "./app-settings";
import { BOARD_SIZE_MAX, BOARD_SIZE_MIN } from "./board-geometry";
import { buildReviewRecord, type ReviewRecord } from "./review-library";
import { normalizeTrainingItem, trainingPositionKey } from "./training-queue";
import { validateNotebook, type ReviewNotebookV1 } from "./review-notebook";

export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
export const MAX_BACKUP_RECORDS = 10_000;
export interface LibraryBackupV1 {
  format: "open-chess-review-backup";
  version: 1;
  exportedAt: string;
  reviews: ReviewRecord[];
  sources: SyncedGame[];
  tasks: TrainingQueueItemV3[];
  deletions: string[];
  settings: AppSettings;
}
export interface LibraryBackupV2 extends Omit<LibraryBackupV1, "version"> {
  version: 2;
  notebooks: ReviewNotebookV1[];
}
export type LibraryBackup = LibraryBackupV1 | LibraryBackupV2;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object in the backup.");
  return value as Record<string, unknown>;
}
function text(value: unknown, name: string, max = 512): string {
  if (typeof value !== "string" || !value.length || value.length > max) throw new Error(`Invalid ${name} in the backup.`);
  return value;
}
function number(value: unknown, name: string, min = 0, max = 10_000): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${name} in the backup.`);
  return value;
}
function integer(value: unknown, name: string, min = 0, max = 10_000): number {
  const result = number(value, name, min, max);
  if (!Number.isInteger(result)) throw new Error(`Invalid ${name} in the backup.`);
  return result;
}
function choice<T extends string | number>(value: unknown, choices: readonly T[], name: string): T {
  if (!choices.includes(value as T)) throw new Error(`Unsupported ${name} in the backup.`);
  return value as T;
}
function boolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Invalid ${name} in the backup.`);
  return value;
}
function date(value: unknown): string {
  const result = text(value, "timestamp", 64);
  if (!Number.isFinite(Date.parse(result))) throw new Error("Invalid timestamp in the backup.");
  return result;
}
function array(value: unknown, name: string, max = MAX_BACKUP_RECORDS): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`Invalid ${name}: at most ${max} entries are supported.`);
  return value;
}
function optional<T>(value: unknown, parse: (value: unknown) => T): T | undefined { return value === undefined ? undefined : parse(value); }
/** `null` is a real board-size value (automatic), so it must survive a round trip. */
function optionalBoardSize(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  return integer(value, "board size", BOARD_SIZE_MIN, BOARD_SIZE_MAX);
}
function field<K extends string, T>(key: K, value: T | undefined): Partial<Record<K, T>> { return (value === undefined ? {} : { [key]: value }) as Partial<Record<K, T>>; }
function unique<T extends { id: string }>(values: T[], name: string): T[] {
  if (new Set(values.map(({ id }) => id)).size !== values.length) throw new Error(`The backup contains duplicate ${name} IDs.`);
  return values;
}
function sourceText(value: unknown): string { return text(value, "PGN/FEN text", 1_048_576); }
function reviewId(value: unknown): string {
  const id = text(value, "review ID");
  if (!/^[a-f0-9]{20}$/.test(id)) throw new Error("Invalid review ID in the backup.");
  return id;
}
function external(value: unknown): ExternalGameReference {
  const v = object(value);
  const url = optional(v.url, (raw) => {
    const value = text(raw, "game URL", 2048);
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("Game URLs must use HTTPS without credentials.");
    return value;
  });
  return {
    provider: choice(v.provider, ["chesscom", "lichess"], "platform"), externalGameId: text(v.externalGameId, "source ID"),
    accountId: text(v.accountId, "account ID"), username: text(v.username, "username"), importedAt: date(v.importedAt),
    ...(url ? { url } : {}),
  };
}

/** Explicit allowlist: provider credentials and arbitrary localStorage fields never leave the browser. */
export function backupSettings(value: unknown): AppSettings {
  const v = object(value);
  return {
    uiLanguage: choice(v.uiLanguage, ["en", "zh-CN"], "interface language"),
    coachProvider: choice(v.coachProvider, ["ollama", "openai-compatible"], "coach provider"),
    coachLanguage: choice(v.coachLanguage, ["en", "zh-CN"], "coach language"), coachModel: text(v.coachModel, "model", 256),
    reviewDepth: choice(v.reviewDepth, [10, 12, 15], "review depth"), reviewMultiPv: choice(v.reviewMultiPv, [1, 2, 3, 4, 5], "engine lines"),
    continuationLines: choice(v.continuationLines, [1, 2, 3, 4, 5], "continuation lines"), continuationLength: choice(v.continuationLength, [6, 8, 10, 12, 16], "continuation length"),
    humanTargetElo: integer(v.humanTargetElo, "target Elo", 400, 3000), humanModel: choice(v.humanModel, ["maia3-5m", "maia3-23m", "maia3-79m"], "Maia model"),
    autoAnalyzeImported: choice(v.autoAnalyzeImported, [0, 1, 3, 5], "sync preference"), soundEnabled: boolean(v.soundEnabled, "sound preference"),
    soundVolume: number(v.soundVolume, "volume", 0, 1), soundTheme: choice(v.soundTheme, ["wintrchess"], "sound theme"),
    pieceSet: optional(v.pieceSet, (value) => choice(value, ["liz-blue", "classic"] as const, "piece set")) ?? "liz-blue",
    boardSize: optionalBoardSize(v.boardSize),
    boardCoordinates: optional(v.boardCoordinates, (value) => choice(value, ["inside", "off"] as const, "board coordinates")) ?? "inside",
    boardArrows: optional(v.boardArrows, (value) => boolean(value, "analysis arrows")) ?? true,
    boardQualityBadge: optional(v.boardQualityBadge, (value) => boolean(value, "Move Quality badge")) ?? true,
    pieceAnimation: optional(v.pieceAnimation, (value) => choice(value, ["off", "fast", "natural"] as const, "piece animation")) ?? "natural",
    moveEmphasis: optional(v.moveEmphasis, (value) => choice(value, ["key", "all"] as const, "move emphasis")) ?? "key",
  };
}

async function review(value: unknown): Promise<ReviewRecord> {
  const v = object(value);
  const kind = choice(v.kind, ["pgn", "fen"], "review kind");
  const input = sourceText(v.input);
  const canonical = await buildReviewRecord(kind, input);
  const originalPgn = optional(v.originalPgn, sourceText);
  if (originalPgn !== undefined) {
    if (kind !== "pgn") throw new Error("A FEN record cannot contain original PGN.");
    const original = parsePgn(originalPgn), game = parsePgn(input);
    if (original.initialFen !== game.initialFen || original.plies.map((m) => m.uci).join(" ") !== game.plies.map((m) => m.uci).join(" ")) throw new Error("Original PGN does not match its stored game.");
  }
  if (v.initialFen !== canonical.initialFen || v.totalPlies !== canonical.totalPlies) throw new Error("A review's position or move count does not match its source.");
  return {
    id: reviewId(v.id), kind, input, title: text(v.title, "review title", 1024), subtitle: typeof v.subtitle === "string" && v.subtitle.length <= 2048 ? v.subtitle : canonical.subtitle,
    ...(canonical.identity ? { identity: { ...canonical.identity, input } } : {}),
    initialFen: canonical.initialFen, totalPlies: canonical.totalPlies, createdAt: date(v.createdAt), updatedAt: date(v.updatedAt),
    ...(originalPgn === undefined ? {} : { originalPgn }),
    ...field("playedAt", optional(v.playedAt, date)), ...field("external", optional(v.external, external)),
    ...field("preferredOrientation", optional(v.preferredOrientation, (v) => choice(v, ["white", "black"] as const, "orientation"))),
    ...field("orientationOverride", optional(v.orientationOverride, (v) => choice(v, ["white", "black"] as const, "orientation"))),
    ...field("sourceTimeClass", optional(v.sourceTimeClass, (v) => text(v, "time class"))), ...field("sourceResult", optional(v.sourceResult, (v) => text(v, "result"))),
    ...(canonical.pgnResult ? { pgnResult: canonical.pgnResult } : {}),
  };
}
function player(value: unknown): SyncedGamePlayer {
  const v = object(value);
  return { username: text(v.username, "player"), ...field("rating", optional(v.rating, (v) => number(v, "rating"))), ...field("result", optional(v.result, (v) => text(v, "result"))) };
}
function synced(value: unknown): SyncedGame {
  const v = object(value), ref = external(v.external);
  const id = text(v.id, "source ID", 1024);
  if (id !== `${ref.provider}:${ref.externalGameId}`) throw new Error("A source ID does not match its platform identity.");
  // Imported sources can include provider PGNs that have not passed review validation.
  // Preserve their raw text as pending source data, never as an analyzed result.
  return {
    id, external: ref, pgn: sourceText(v.pgn), playedAt: date(v.playedAt), syncedAt: date(v.syncedAt),
    white: player(v.white), black: player(v.black), accountColor: choice(v.accountColor, ["white", "black"], "account color"), analyzed: false,
    ...field("timeClass", optional(v.timeClass, (v) => text(v, "time class"))), ...field("timeControl", optional(v.timeControl, (v) => text(v, "time control"))), ...field("rated", optional(v.rated, (v) => boolean(v, "rated state"))),
  };
}
function task(value: unknown, games: Map<string, ReturnType<typeof parsePgn>>): TrainingQueueItemV3 {
  const v = object(value);
  const version = choice(v.version, [1, 2, 3], "training version");
  const evidence = array(v.evidence, "task positions", 5).map((value) => {
    const source = object(value), gameId = reviewId(source.gameId), ply = integer(source.ply, "position ply", 1);
    const san = text(source.san, "source move", 32);
    if (games.get(gameId)?.plies[ply - 1]?.san !== san) throw new Error("A training position is missing or does not match its source game.");
    return {
      gameId, ply, san, phase: choice(source.phase, ["opening", "middlegame", "endgame"], "phase"),
      classification: choice(source.classification, ["brilliant", "great", "best", "excellent", "good", "book", "interesting", "forced", "inaccuracy", "mistake", "blunder", "miss", "missed_win", "missed_mate"], "move label"),
      winPercentLoss: number(source.winPercentLoss, "WinPercent loss", 0, 100),
    };
  });
  if (!evidence.length || new Set(evidence.map(trainingPositionKey)).size !== evidence.length) throw new Error("A task must contain unique source positions.");
  const progress = version === 1 ? {} : object(v.progress);
  const positions = version === 3 ? array(progress.positions, "reviewed positions", 5).map((value) => {
    const entry = object(value);
    const position = { gameId: reviewId(entry.gameId), ply: integer(entry.ply, "reviewed ply", 1), reviewedAt: date(entry.reviewedAt) };
    if (!evidence.some((source) => trainingPositionKey(source) === trainingPositionKey(position))) throw new Error("Reviewed progress refers to a position outside its task.");
    // What the review was worth and when it is next due: without these the restored
    // library would treat every review as due at once and lose the schedule.
    return {
      ...position,
      outcome: optional(entry.outcome, (v) => choice(v, ["unaided", "hinted", "exposed", "legacy"], "review outcome")),
      mastery: optional(entry.mastery, (v) => choice(v, ["learning", "review", "mastered"], "mastery")),
      streak: optional(entry.streak, (v) => integer(v, "streak", 0)),
      attempts: optional(entry.attempts, (v) => integer(v, "attempts", 1)),
      dueAt: optional(entry.dueAt, date),
    };
  }) : [];
  if (new Set(positions.map(trainingPositionKey)).size !== positions.length) throw new Error("Duplicate reviewed position in the backup.");
  const base = {
    version, id: text(v.id, "training ID", 1024), playerKey: text(v.playerKey, "player identity"),
    weaknessKind: choice(v.weaknessKind, ["opening-decisions", "middlegame-decisions", "endgame-decisions", "missed-opportunities"], "weakness"),
    status: choice(v.status, ["queued", "in-progress", "completed"], "training status"), priority: number(v.priority, "priority"), evidence,
    createdAt: date(v.createdAt), updatedAt: date(v.updatedAt), completedAt: optional(v.completedAt, date), sourceReportVersion: "advanced-study-v2",
    completionKind: optional(v.completionKind, (v) => choice(v, ["manual", "mastered", "reviewed"], "completion kind")),
    progress: { reviewedPositionCount: positions.length, totalPositionCount: evidence.length, positions,
      lastReviewedAt: optional(progress.lastReviewedAt, date), notes: optional(progress.notes, (v) => text(v, "notes", 10_000)) },
  };
  return normalizeTrainingItem(base as TrainingQueueItem);
}

export async function validateLibraryBackup(value: unknown): Promise<LibraryBackupV2> {
  const v = object(value);
  if (v.format !== "open-chess-review-backup" || (v.version !== 1 && v.version !== 2)) throw new Error("Unsupported backup format/version. Choose an Open Chess Review library backup v1 or v2.");
  const reviews: ReviewRecord[] = [];
  for (const raw of array(v.reviews, "reviews")) {
    reviews.push(await review(raw));
    if (reviews.length % 100 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  unique(reviews, "review");
  const games = new Map(reviews.filter((review) => review.kind === "pgn").map((record) => [record.id, parsePgn(record.input)]));
  const records = new Map(reviews.map((record) => [record.id, record]));
  const notebooks: ReviewNotebookV1[] = [];
  let yieldedAt = performance.now();
  for (const raw of array(v.version === 1 ? [] : v.notebooks, "notebooks")) {
    const record = records.get(text(object(raw).id, "notebook source ID"));
    if (!record) throw new Error("A notebook refers to a review missing from this backup.");
    notebooks.push(validateNotebook(raw, record, games.get(record.id) ?? null));
    // Long personal lines need rule replay as well as shape validation.
    if (performance.now() - yieldedAt >= 8) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      yieldedAt = performance.now();
    }
  }
  return {
    format: "open-chess-review-backup", version: 2, exportedAt: date(v.exportedAt), reviews,
    notebooks: unique(notebooks, "notebook"),
    sources: unique(array(v.sources, "source games").map(synced), "source game"),
    tasks: unique(array(v.tasks, "training tasks").map((value) => task(value, games)), "training task"), settings: backupSettings(v.settings),
    deletions: array(v.deletions ?? [], "deletion records", 20_000).map((value) => {
      const key = text(value, "deletion record", 1100);
      if (!/^deleted-review:[a-f0-9]{20}$|^deleted-source:(chesscom|lichess):.{1,1024}$/.test(key)) throw new Error("Invalid deletion record in the backup.");
      return key;
    }),
  };
}

export async function readLibraryBackup(file: Pick<File, "size" | "text">): Promise<LibraryBackupV2> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error("Choose a backup up to 50 MiB.");
  const raw = await file.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) throw new Error("Choose a backup up to 50 MiB.");
  let value: unknown;
  try { value = JSON.parse(raw); } catch (cause) { throw new Error("This is not a valid JSON backup.", { cause }); }
  return validateLibraryBackup(value);
}
