import { ChessImportError, normalizeFen, parsePgn } from "@chess-review/chess-core";
import type { ExternalGameReference, SyncedGame } from "@chess-review/shared";
import { openReviewDatabase, REVIEW_STORE, LOCAL_META_STORE, writeLocalData, notifyLocalDataChanged } from "./browser-storage";

import { deletedReviewKey, deletedExternalKey } from "./local-data";

import { buildReviewIdentity, type ReviewIdentity } from "./review-identity";

export type ReviewRecordKind = "pgn" | "fen";

export interface ReviewRecord {
  id: string;
  kind: ReviewRecordKind;
  input: string;
  /** Original selected PGN text; older records fall back to input. */
  originalPgn?: string;
  /** Disposable validated PGN index; rebuilt on backup import. */
  identity?: ReviewIdentity;
  title: string;
  subtitle: string;
  initialFen: string;
  totalPlies: number;
  createdAt: string;
  updatedAt: string;
  playedAt?: string;
  external?: ExternalGameReference;
  preferredOrientation?: "white" | "black";
  orientationOverride?: "white" | "black";
  sourceTimeClass?: string;
  sourceResult?: string;
  /** PGN Result header (game outcome), not a learner's win/loss. */
  pgnResult?: "1-0" | "0-1" | "1/2-1/2";
}

export async function buildReviewRecordFromSyncedGame(game: SyncedGame): Promise<ReviewRecord> {
  const base = await buildReviewRecord("pgn", game.pgn);
  return {
    ...base,
    // A connected game is a distinct library item even when an identical PGN
    // was imported manually or from another account. Keep manual PGN IDs
    // stable while making the external identity part of synced-game records.
    id: await reviewId([
      "synced",
      game.external.provider,
      game.external.accountId,
      game.external.externalGameId,
      base.id,
    ].join("\u0000")),
    playedAt: game.playedAt,
    external: game.external,
    preferredOrientation: game.accountColor,
    ...(game.timeClass ? { sourceTimeClass: game.timeClass } : {}),
    ...(game[game.accountColor].result ? { sourceResult: game[game.accountColor].result } : {}),
  };
}

function cleanSubtitle(subtitle: string): string {
  return subtitle.split(" · ").filter((part) => /\d/.test(part) || !part.includes("?")).join(" · ");
}

function meaningfulHeader(value: string | undefined): string | undefined {
  return value && /[\p{L}\p{N}]/u.test(value) ? value : undefined;
}

function pgnGameResult(header: string | undefined, original: string): "1-0" | "0-1" | "1/2-1/2" | undefined {
  if (header === "1-0" || header === "0-1" || header === "1/2-1/2") return header;
  const match = /\[Result\s+"\s*(1-0|0-1|1\/2-1\/2)\s*"\]/i.exec(original);
  return match?.[1] === "1-0" || match?.[1] === "0-1" || match?.[1] === "1/2-1/2" ? match[1] : undefined;
}

async function reviewId(identity: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  return [...new Uint8Array(digest)].slice(0, 10).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildReviewRecord(kind: ReviewRecordKind, input: string): Promise<ReviewRecord> {
  const now = new Date().toISOString();
  if (kind === "fen") {
    const fen = normalizeFen(input.trim());
    return {
      id: await reviewId(`fen\u0000${fen}`),
      kind,
      input: fen,
      title: "Position study",
      subtitle: `${fen.split(" ")[1] === "w" ? "White" : "Black"} to move`,
      initialFen: fen,
      totalPlies: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  let game;
  try {
    game = parsePgn(input.trim());
  } catch (error) {
    if (error instanceof ChessImportError) throw error;
    throw new ChessImportError("This PGN could not be parsed.", { cause: error });
  }
  if (game.plies.length === 0) throw new ChessImportError("PGN must contain at least one move.");
  const white = meaningfulHeader(game.headers.White) ?? "White";
  const black = meaningfulHeader(game.headers.Black) ?? "Black";
  const event = meaningfulHeader(game.headers.Event);
  const opening = meaningfulHeader(game.headers.Opening);
  const eco = meaningfulHeader(game.headers.ECO);
  const openingLabel = opening && eco ? `${eco} ${opening}` : opening ?? eco;
  const date = game.headers.Date && /\d/.test(game.headers.Date) ? game.headers.Date : undefined;
  const pgnResult = pgnGameResult(game.headers.Result, input);
  return {
    id: await reviewId(`pgn\u0000${game.initialFen}\u0000${game.pgn}`),
    kind,
    input: game.pgn,
    identity: buildReviewIdentity(game.pgn, game),
    originalPgn: input,
    title: `${white} vs ${black}`,
    subtitle: [openingLabel ?? event, date, `${game.plies.length} ${game.plies.length === 1 ? "ply" : "plies"}`].filter(Boolean).join(" · "),
    initialFen: game.initialFen,
    totalPlies: game.plies.length,
    createdAt: now,
    updatedAt: now,
    ...(pgnResult ? { pgnResult } : {}),
  };
}

export class DeletedReviewError extends Error {
  constructor() { super("This review was deleted. Import or open the source game explicitly to create a new review."); this.name = "DeletedReviewError"; }
}

export async function isReviewDeleted(record: ReviewRecord): Promise<boolean> {
  const db = await openReviewDatabase();
  try {
    const keys = [deletedReviewKey(record.id), ...(record.external ? [deletedExternalKey(record.external)] : [])];
    return (await Promise.all(keys.map((key) => new Promise<boolean>((resolve, reject) => {
      const req = db.transaction(LOCAL_META_STORE).objectStore(LOCAL_META_STORE).get(key);
      req.onsuccess = () => resolve(Boolean(req.result));
      req.onerror = () => reject(req.error);
    })))).some(Boolean);
  } finally { db.close(); }
}

export async function saveReviewRecord(record: ReviewRecord, options: { restoreDeleted?: boolean } = {}): Promise<ReviewRecord> {
  const database = await openReviewDatabase();
  let saved = record;
  try {
    await writeLocalData(database, REVIEW_STORE, (transaction, fail) => {
      const store = transaction.objectStore(REVIEW_STORE);
      const meta = transaction.objectStore(LOCAL_META_STORE);
      const keys = [deletedReviewKey(record.id), ...(record.external ? [deletedExternalKey(record.external)] : [])];
      const existing = store.get(record.id);
      const deleted = keys.map((key) => meta.get(key));
      let pending = deleted.length + 1;
      const ready = () => {
        if (--pending) return;
        if (deleted.some((request) => request.result) && !options.restoreDeleted) { fail(new DeletedReviewError()); return; }
        if (options.restoreDeleted) for (const key of keys) meta.delete(key);
        saved = { ...record, subtitle: cleanSubtitle(record.subtitle), createdAt: existing.result?.createdAt ?? record.createdAt, updatedAt: new Date().toISOString() };
        store.put(saved, saved.id);
      };
      existing.onsuccess = ready;
      for (const request of deleted) request.onsuccess = ready;
    });
    notifyLocalDataChanged();
    return saved;
  } finally { database.close(); }
}

export async function getReviewRecord(id: string): Promise<ReviewRecord | null> {
  const database = await openReviewDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(REVIEW_STORE, "readonly").objectStore(REVIEW_STORE).get(id);
      request.onsuccess = () => resolve((request.result as ReviewRecord | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Unable to load the review record."));
    });
  } finally {
    database.close();
  }
}

export async function listReviewRecords(): Promise<ReviewRecord[]> {
  const database = await openReviewDatabase();
  try {
    const records = await new Promise<ReviewRecord[]>((resolve, reject) => {
      const request = database.transaction(REVIEW_STORE, "readonly").objectStore(REVIEW_STORE).getAll();
      request.onsuccess = () => resolve(request.result as ReviewRecord[]);
      request.onerror = () => reject(request.error ?? new Error("Unable to list review history."));
    });
    return records.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } finally {
    database.close();
  }
}
