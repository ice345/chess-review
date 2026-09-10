import type { ExternalPlatform, PlatformAccount, SyncedGame } from "@chess-review/shared";
import type { PlatformSyncMode } from "../platform-sync";

export interface PlatformSyncRequest {
  account: PlatformAccount;
  since?: string;
  cursor?: string;
  limit?: number;
  mode?: PlatformSyncMode;
  signal?: AbortSignal;
}

export interface PlatformSyncResult {
  provider: ExternalPlatform;
  account: PlatformAccount;
  games: SyncedGame[];
  cursor?: string;
  done: boolean;
  progress?: { completed: number; total?: number };
}

export class PlatformRequestError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfter?: string) {
    super(message);
    this.name = "PlatformRequestError";
  }
}

/** Provider-neutral boundary consumed by the browser workspace. */
export interface ChessPlatformProvider {
  readonly id: ExternalPlatform;
  link(identity?: string): Promise<PlatformAccount>;
  sync(request: PlatformSyncRequest): Promise<PlatformSyncResult>;
  disconnect(account: PlatformAccount): Promise<{ remoteRevoked?: boolean } | void>;
}

async function jsonOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as { error?: string } | T | null;
  if (!response.ok) throw new PlatformRequestError(
    body && typeof body === "object" && "error" in body && body.error ? body.error : `Platform request failed (${response.status}).`,
    response.status,
    response.headers.get("Retry-After") ?? undefined,
  );
  return body as T;
}

export const chessComProvider: ChessPlatformProvider = {
  id: "chesscom",
  async link(identity) {
    if (!identity?.trim()) throw new Error("Enter a Chess.com username.");
    const result = await jsonOrThrow<{ account: PlatformAccount }>(await fetch("/api/platforms/chesscom/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: identity.trim() }),
    }));
    return result.account;
  },
  async sync(request) {
    return jsonOrThrow<PlatformSyncResult>(await fetch("/api/platforms/chesscom/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account: request.account, since: request.since, cursor: request.cursor, limit: request.limit, mode: request.mode }),
      ...(request.signal ? { signal: request.signal } : {}),
    }));
  },
  async disconnect() {},
};

export const lichessProvider: ChessPlatformProvider = {
  id: "lichess",
  async link() {
    window.location.assign("/api/platforms/lichess/oauth/start");
    return new Promise<PlatformAccount>(() => undefined);
  },
  async sync(request) {
    return jsonOrThrow<PlatformSyncResult>(await fetch("/api/platforms/lichess/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ since: request.since, cursor: request.cursor, limit: request.limit, mode: request.mode }),
      ...(request.signal ? { signal: request.signal } : {}),
    }));
  },
  async disconnect() {
    return jsonOrThrow<{ ok: true; remoteRevoked?: boolean }>(await fetch("/api/platforms/lichess/session", { method: "DELETE" }));
  },
};
