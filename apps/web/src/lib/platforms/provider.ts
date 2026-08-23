import type { ExternalPlatform, PlatformAccount, SyncedGame } from "@chess-review/shared";

export interface PlatformSyncRequest {
  account: PlatformAccount;
  since?: string;
  limit?: number;
}

export interface PlatformSyncResult {
  provider: ExternalPlatform;
  account: PlatformAccount;
  games: SyncedGame[];
  cursor?: string;
}

/** Provider-neutral boundary consumed by the browser workspace. */
export interface ChessPlatformProvider {
  readonly id: ExternalPlatform;
  link(identity?: string): Promise<PlatformAccount>;
  sync(request: PlatformSyncRequest): Promise<PlatformSyncResult>;
  disconnect(account: PlatformAccount): Promise<void>;
}

async function jsonOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as { error?: string } | T | null;
  if (!response.ok) throw new Error(body && typeof body === "object" && "error" in body && body.error ? body.error : `Platform request failed (${response.status}).`);
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
      body: JSON.stringify({ account: request.account, since: request.since, limit: request.limit }),
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
      body: JSON.stringify({ since: request.since, limit: request.limit }),
    }));
  },
  async disconnect() {
    await jsonOrThrow<{ ok: true }>(await fetch("/api/platforms/lichess/session", { method: "DELETE" }));
  },
};
