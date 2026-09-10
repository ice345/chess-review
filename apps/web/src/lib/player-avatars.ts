import { writeLocalData, notifyLocalDataChanged } from "./browser-storage";
import type { ExternalPlatform, PlayerColor } from "@chess-review/shared";
import { allowedAvatarUrl } from "./player-avatar-url";
import { openReviewDatabase, PLAYER_AVATAR_STORE } from "./browser-storage";

export interface CachedPlayerAvatar {
  key: string;
  provider: ExternalPlatform;
  username: string;
  avatarUrl?: string;
  fetchedAt: string;
}

const USERNAME_PATTERN = /^[\w-]{2,32}$/i;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function platformFromGameHeaders(headers: Record<string, string>): ExternalPlatform | undefined {
  const blob = [headers.Site, headers.Link, headers.Source, headers.Event].filter(Boolean).join(" ").toLowerCase();
  if (blob.includes("chess.com")) return "chesscom";
  if (blob.includes("lichess")) return "lichess";
}

export function playerAvatarKey(provider: ExternalPlatform, username: string): string {
  return `${provider}:${username.trim().toLowerCase()}`;
}

function validUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username.trim());
}

async function readCachedAvatar(key: string): Promise<CachedPlayerAvatar | undefined> {
  const database = await openReviewDatabase();
  try {
    if (!database.objectStoreNames.contains(PLAYER_AVATAR_STORE)) return undefined;
    return await new Promise((resolve, reject) => {
      const request = database.transaction(PLAYER_AVATAR_STORE, "readonly").objectStore(PLAYER_AVATAR_STORE).get(key);
      request.onsuccess = () => resolve(request.result as CachedPlayerAvatar | undefined);
      request.onerror = () => reject(request.error ?? new Error("Unable to read player avatar cache."));
    });
  } finally {
    database.close();
  }
}

async function writeCachedAvatar(entry: CachedPlayerAvatar): Promise<void> {
  const database = await openReviewDatabase();
  try {
    if (!database.objectStoreNames.contains(PLAYER_AVATAR_STORE)) return;
    await writeLocalData(database, PLAYER_AVATAR_STORE, (transaction) => {
      transaction.objectStore(PLAYER_AVATAR_STORE).put(entry, entry.key);
    });
    notifyLocalDataChanged();
  } finally {
    database.close();
  }
}

async function fetchAvatarUrl(provider: ExternalPlatform, username: string): Promise<string | undefined> {
  const response = await fetch(`/api/platforms/player-avatar?provider=${provider}&username=${encodeURIComponent(username)}`);
  if (!response.ok) return undefined;
  const body = await response.json() as { avatarUrl?: unknown };
  return typeof body.avatarUrl === "string" ? allowedAvatarUrl(provider, body.avatarUrl) : undefined;
}

export async function resolvePlayerAvatars(
  provider: ExternalPlatform,
  usernames: Record<PlayerColor, string>,
): Promise<Partial<Record<PlayerColor, string>>> {
  const result: Partial<Record<PlayerColor, string>> = {};
  await Promise.all((["white", "black"] as const).map(async (color) => {
    const username = usernames[color];
    if (!validUsername(username)) return;
    const key = playerAvatarKey(provider, username);
    const cached = await readCachedAvatar(key).catch(() => undefined);
    const fresh = cached && Date.now() - Date.parse(cached.fetchedAt) < CACHE_TTL_MS;
    if (fresh) {
      const cachedUrl = cached.avatarUrl ? allowedAvatarUrl(provider, cached.avatarUrl) : undefined;
      if (cachedUrl) result[color] = cachedUrl;
      return;
    }
    const avatarUrl = await fetchAvatarUrl(provider, username).catch(() => undefined);
    await writeCachedAvatar({
      key,
      provider,
      username,
      ...(avatarUrl ? { avatarUrl } : {}),
      fetchedAt: new Date().toISOString(),
    }).catch(() => undefined);
    if (avatarUrl) result[color] = avatarUrl;
  }));
  return result;
}
