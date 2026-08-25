import { normalizeFen, parsePgn } from "@chess-review/chess-core";
import type { ExternalGameReference, SyncedGame } from "@chess-review/shared";
import { openReviewDatabase, REVIEW_STORE } from "./browser-storage";

export type ReviewRecordKind = "pgn" | "fen";

export interface ReviewRecord {
  id: string;
  kind: ReviewRecordKind;
  input: string;
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
}

export async function buildReviewRecordFromSyncedGame(game: SyncedGame): Promise<ReviewRecord> {
  return {
    ...await buildReviewRecord("pgn", game.pgn),
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

  const game = parsePgn(input.trim());
  if (game.plies.length === 0) throw new Error("PGN must contain at least one move.");
  const white = meaningfulHeader(game.headers.White) ?? "White";
  const black = meaningfulHeader(game.headers.Black) ?? "Black";
  const event = meaningfulHeader(game.headers.Event);
  const date = game.headers.Date && /\d/.test(game.headers.Date) ? game.headers.Date : undefined;
  return {
    id: await reviewId(`pgn\u0000${game.initialFen}\u0000${game.pgn}`),
    kind,
    input: game.pgn,
    title: `${white} vs ${black}`,
    subtitle: [event, date, `${game.plies.length} ${game.plies.length === 1 ? "ply" : "plies"}`].filter(Boolean).join(" · "),
    initialFen: game.initialFen,
    totalPlies: game.plies.length,
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveReviewRecord(record: ReviewRecord): Promise<ReviewRecord> {
  const database = await openReviewDatabase();
  try {
    const existing = await new Promise<ReviewRecord | undefined>((resolve, reject) => {
      const request = database.transaction(REVIEW_STORE, "readonly").objectStore(REVIEW_STORE).get(record.id);
      request.onsuccess = () => resolve(request.result as ReviewRecord | undefined);
      request.onerror = () => reject(request.error ?? new Error("Unable to read the review record."));
    });
    const saved = {
      ...record,
      subtitle: cleanSubtitle(record.subtitle),
      createdAt: existing?.createdAt ?? record.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(REVIEW_STORE, "readwrite");
      transaction.objectStore(REVIEW_STORE).put(saved, saved.id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to save the review record."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Review record write was aborted."));
    });
    return saved;
  } finally {
    database.close();
  }
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
