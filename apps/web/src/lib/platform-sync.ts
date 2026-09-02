export type PlatformSyncMode = "incremental" | "full-history";

export interface ChessComArchiveCursor {
  archiveKey: string;
  offset: number;
}

const ARCHIVE_PATH = /^\/pub\/player\/([^/]+)\/games\/(\d{4})\/(\d{2})$/;
const MAX_PLATFORM_JSON_BYTES = 1_048_576;

export function archiveKeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(ARCHIVE_PATH);
    return match ? `${match[2]}-${match[3]}` : null;
  } catch {
    return null;
  }
}

export function assertChessComArchiveUrl(url: string, username: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Chess.com archive URL is invalid.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("Chess.com archive URL is invalid.");
  }
  if (parsed.hostname !== "api.chess.com") {
    throw new Error("Chess.com archive URL is invalid.");
  }
  const match = parsed.pathname.match(ARCHIVE_PATH);
  if (!match || match[1] !== username.toLowerCase()) {
    throw new Error("Chess.com archive URL is invalid.");
  }
  return url;
}

export function chessComCursor(cursor?: string): ChessComArchiveCursor {
  const v2 = cursor?.match(/^cc2:([^:]*):(\d+)$/);
  if (v2) return { archiveKey: v2[1] ?? "", offset: Number(v2[2]) };
  const v1 = cursor?.match(/^cc:(\d+):(\d+)$/);
  if (v1) return { archiveKey: `index:${v1[1]}`, offset: Number(v1[2]) };
  return { archiveKey: "", offset: 0 };
}

export function encodeChessComCursor(value: ChessComArchiveCursor): string {
  return `cc2:${value.archiveKey}:${Math.max(0, Math.floor(value.offset))}`;
}

export function locateChessComArchive(archiveUrls: readonly string[], cursor: ChessComArchiveCursor): { index: number; offset: number } {
  if (cursor.archiveKey.startsWith("index:")) {
    return { index: Number(cursor.archiveKey.slice(6)), offset: cursor.offset };
  }
  if (!cursor.archiveKey) return { index: 0, offset: 0 };
  const index = archiveUrls.findIndex((url) => archiveKeyFromUrl(url) === cursor.archiveKey);
  return { index: index === -1 ? archiveUrls.length : index, offset: cursor.offset };
}

export function chessComArchiveListTick(archiveCount: number, firstArchiveKey = "") {
  const total = Math.max(0, archiveCount);
  return {
    games: [] as const,
    done: total === 0,
    cursor: total === 0 ? undefined : encodeChessComCursor({ archiveKey: firstArchiveKey, offset: 0 }),
    progress: { completed: 0, total },
  };
}

export function lichessUntil(cursor?: string): number | null {
  const match = cursor?.match(/^li:(\d+)$/);
  return match ? Number(match[1]) : null;
}

export function encodeLichessCursor(oldestPlayedAt: number): string {
  return `li:${Math.max(0, Math.floor(oldestPlayedAt) - 1)}`;
}

export function retryAt(retryAfterHeader: string | null, now = Date.now()): string {
  const seconds = Number(retryAfterHeader);
  if (retryAfterHeader !== null && Number.isFinite(seconds) && seconds >= 0) return new Date(now + seconds * 1000).toISOString();
  const parsed = retryAfterHeader ? Date.parse(retryAfterHeader) : Number.NaN;
  return new Date(Number.isFinite(parsed) ? parsed : now + 60_000).toISOString();
}

export async function readBoundedJson<T>(request: Request, limit = MAX_PLATFORM_JSON_BYTES): Promise<T | null> {
  const text = await request.text();
  if (text.length > limit) {
    const error = new Error("Request body is too large.");
    error.name = "PayloadTooLargeError";
    throw error;
  }
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
