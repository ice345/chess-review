export type PlatformSyncMode = "incremental" | "full-history";

export interface ChessComArchiveCursor {
  archiveIndex: number;
  offset: number;
}

export function chessComCursor(cursor?: string): ChessComArchiveCursor {
  const match = cursor?.match(/^cc:(\d+):(\d+)$/);
  if (!match) return { archiveIndex: 0, offset: 0 };
  return { archiveIndex: Number(match[1]), offset: Number(match[2]) };
}

export function encodeChessComCursor(value: ChessComArchiveCursor): string {
  return `cc:${Math.max(0, Math.floor(value.archiveIndex))}:${Math.max(0, Math.floor(value.offset))}`;
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
